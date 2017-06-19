'use strict';

const Hapi = require ('hapi');
const Fitbit = require('fitbit-node');
const mongoose = require('mongoose');
const Config = require('./config/config');

mongoose.connect('mongodb://localhost/fitbitApi');
const db = mongoose.connection;

const userSchema = mongoose.Schema({
  userId: String,
  accessToken: String,
  createdAt: Date,
  expiresIn: Number,
  refreshToken: String
});

const User = mongoose.model('User', userSchema);

const client = new Fitbit(Config.fitbit_creds.clientId, Config.fitbit_creds.clientSecret);
const redirect_uri = 'http://localhost:8080/fitbit_oauth_callback';
// Define scope of access the app will request for the user's account
const scope = 'activity profile';

const server = new Hapi.Server();
server.connection({ port: 8080 });

server.route([
  {
    method: "GET",
    path: "/",
    handler: (request, reply) => {
      reply('Hello world from Hapi');
    }
  },
  {
    method: "GET",
    path: "/fitbit",
    handler: (request, reply) => {
      reply().redirect(client.getAuthorizeUrl(scope, redirect_uri));
    }
  },
  {
    method: "GET",
    path: "/fitbit_oauth_callback",
    handler: (request, reply) => {
      client.getAccessToken(request.query.code, redirect_uri)
      .then((result) => {
        updateUser(result.user_id, result.access_token, result.refresh_token, result.expires_in);
        reply().redirect(`/api/v1/users/${result.user_id}`);
      });
    }
  },
  {
    method: "GET",
    config: { json: { space: 2 } },
    path: "/api/v1/users",
    handler: (request, reply) => {
      const result = User.find();
      result.exec((err, users) => {
        const userList = [];
        users.forEach((userDoc) => {
          // Convert each user to a JS object since it comes in as a Mongo document
          const user = userDoc.toObject();

          // Explain the different user endpoints
          user._links = [
            {
              rel: 'self',
              href: `http://localhost:8080/api/v1/users/${user.userId}`,
              method: 'GET'
            },
            {
              rel: 'self',
              href: `http://localhost:8080/api/v1/users/${user.userId}`,
              method: 'DELETE'
            },
            {
              rel: 'summary',
              href: `http://localhost:8080/api/v1/users/${user.userId}/activities/summary`,
              method: 'GET'
            },
            {
              rel: 'activities',
              href: `http://localhost:8080/api/v1/users/${user.userId}/activities`,
              method: 'GET'
            },
            {
              rel: 'activities',
              href: `http://localhost:8080/api/v1/users/${user.userId}/activities`,
              method: 'POST'
            }
          ];
          userList.push(user);
        });
        reply(userList);
      });
    }
  },
  {
    method: "GET",
    path: "/api/v1/users/{fitbitId}",
    handler: (request, reply) => {
      const result = User.findOne({ userId: request.params.fitbitId });
      result.exec((err, user) => {
        if (err) {
          return err;
        }

        if (!user) {
          reply().redirect('/fitbit');
        }

        getFitbit('/profile.json', user)
        .then((result) => {
          reply(result);
        });
      });
    }
  },
  {
    method: "DELETE",
    path: "/api/v1/users/{fitbitId}",
    handler: (request, reply) => {
      User.findOneAndRemove({userId: request.params.fitbitId}, (err, response) => {
        reply().code(204);
      });
    }
  },
  {
    method: "GET",
    path: "/api/v1/users/{fitbitId}/activities/summary",
    config: { json: { space: 2 } },
    handler: (request, reply) => {
      const result = User.findOne({userId: request.params.fitbitId});
      result.exec((err, user) => {
        if (err) {
          return err;
        }

        if (!user) {
          reply().redirect('/fitbit');
        }

        const requestDate = getFitbitDate(request.query.date);
        const requestUrl = `/activities/date/${requestDate}.json`;

        getFitbit(requestUrl, user)
        .then((results) => {
          reply(results[0].summary);
        });
      });
    }
  },
  {
    method: "GET",
    path: "/api/v1/users/{fitbitId}/activities",
    config: { json: { space: 2 } },
    handler: (request, reply) => {
      const result = User.findOne({userId: request.params.fitbitId});
      result.exec((err, user) => {
        if (err) {
          return err;
        }

        if (!user) {
          reply().redirect('/fitbit');
        }

        const requestDate = getFitbitDate(request.query.date);
        const queryString = `?afterDate=${requestDate}&sort=asc&offset=0&limit=50`;
        const requestUrl = `/activities/list.json${queryString}`;

        getFitbit(requestUrl, user)
        .then((results) => {
          reply(results[0].activities);
        });
      });
    }
  },
  {
    method: "POST",
    path: "/api/v1/users/{fitbitId}/activities",
    config: { json: { space: 2 } },
    handler: (request, reply) => {
      const result = User.findOne({userId: request.params.fitbitId});
      result.exec((err, user) => {
        if (err) {
          return err;
        }

        if (!user) {
          reply().redirect('/fitbit');
        }

        const requestDate = getFitbitDate(request.query.date);
        const activity = {
          activityName: 'Cycling',
          manualCalories: 300,
          startTime: '09:00:00',
          durationMillis: 1000*60*30,
          date: requestDate
        };
        const requestUrl = '/activities.json';

        client.post(requestUrl, user.accessToken, activity)
        .then((results) => {
          reply(results);
        });
      });
    }
  },
  {
    method: "DELETE",
    path: "/api/v1/users/{fitbitId}/activities/{activityId}",
    handler: (request, reply) => {
      const result = User.findOne({userId: request.params.fitbitId});
      result.exec((err, user) => {
        if (err) {
          return err;
        }

        if (!user) {
          reply().redirect('/fitbit');
        }

        const requestUrl = `/activities/${request.params.activityid}.json`;

        client.delete(requestUrl, user.accessToken)
        .then((results, response) => {
          console.log(response);
          reply().code(204);
        });
      });
    }
  }
]);

/**
 * Gets Fitbit data from Fitbit API
 *
 * Checks whether the access token is valid, and refreshes it if necessary.
 * Performs a GET request to the Fitbit endpoint provided and returns either
 * the data or an error.
 *
 * @see tokenRefreshCheck()
 * @see refreshToken()
 * @see client.get()
 *
 * @param {String} $requestUrl - Fitbit endpoint to make the GET request to.
 * @param {Object} $user - User data object.
 * @param {String} $user.accessToken - Current access token of the user.
 *
 * @return {Promise} - Either the data requested from Fitbit or an error.
 */

const getFitbit = (requestUrl, user) => {
  if (tokenRefreshCheck(user)) {
    return new Promise((resolve, reject) => {
      refreshToken(user)
      .then((result) => {
        client.get(requestUrl, result)
        .then((results) => {
          if (results[0].errors) {
            reject(results[0].errors);
          }
          resolve(results);
        })
        .catch((error) => {
          reject(error);
        });
      }, (err) => {
        console.log(err);
        return err;
      });
    });
  }

  return new Promise((resolve, reject) => {
    client.get(requestUrl, user.accessToken)
    .then((results) => {
      if (results[0].errors) {
        reject(results[0].errors);
      }
      resolve(results);
    })
    .catch((error) => {
      reject(error);
    });
  });
};

/**
 * Changes date into format that Fitbit wants
 *
 * @param {String} $requestDate - Optional. Date string for request data.
 *
 * @return {String} - String representing date requested or date now.
 */

const getFitbitDate = (requestDate) => {
  if (requestDate) {
    return requestDate;
  }

  const d = new Date();
  const dateArray = [d.getFullYear(), d.getMonth(), d.getDate()];
  return dateArray.join('-');
};

/**
 * Gets a new access and refresh token from Fitbit
 *
 * Requests a new token from Fitbit, updates the local DB with the new values
 * and returns the new access token.
 *
 * @see client.refreshAccessToken()
 * @see updateUser()
 *
 * @param {Object} $user - User data object.
 * @param {String} $user.accessToken - Current access token of the user.
 * @param {String} $user.refreshToken - Current refresh token of the user.
 * @param {Object} $result - Returned result from Fitbit.
 * @param {String} $result.user_id - User ID of the user.
 * @param {String} $result.access_token - Access token of the user.
 * @param {String} $result.refresh_token - Refresh token of the user.
 * @param {Number} $result.expires_in - Number of milliseconds the refreshToken expires in.
 * @param {Object} $error - Error object returned from Fitbit.
 * @param {Array} $error.context.errors - Array of errors returned from Fitbit explaining error.
 *
 * @return {Promise} - Returns either the new access token or the error message.
 */

const refreshToken = (user) => {
  return new Promise((resolve, reject) => {
    client.refreshAccessToken(user.accessToken, user.refreshToken)
    .then((result) => {
      updateUser(result.user_id, result.access_token, result.refresh_token, result.expires_in);
      resolve(result.access_token);
    })
    .catch((error) => {
      console.log('error:');
      console.log(error.context.errors);
      reject(error);
    });
  });
};

/**
 * Helper function that checks whether the access token needs to be refreshed
 *
 * @param {Object} $userData - User data object.
 * @param {Date} $userData.createdAt - Date-time the user data was added to the DB.
 * @param {Number} $userData.expiresIn - Number of milliseconds the refreshToken expires in.
 * @return {Boolean} - Boolean describing whether or not the token needs to be refreshed.
 */

const tokenRefreshCheck = (userData) => {
  const now = new Date();
  return (now - userData.createdAt) > userData.expiresIn;
};

/**
 * Updates local DB with user data passed in
 *
 * @param {String} $userId - User ID of the user.
 * @param {String} $accessToken - Access token of the user.
 * @param {String} $refreshToken - Refresh token of the user.
 * @param {Number} $expiresIn - Number of milliseconds the refreshToken expires in.
 *
 * @return {Promise} - Returns either the error during DB update or the new user info.
 */

const updateUser = (userId, accessToken, refreshToken, expiresIn) => {
  const newUserInfo = {
    userId,
    accessToken,
    createdAt: new Date(),
    expiresIn,
    refreshToken
  };
  // const newUser = new User(newUserInfo);

  return new Promise((resolve, reject) => {
    User.update(
      {userId: userId},
      newUserInfo,
      {upsert:true},
      (err) => {
        if(err) {
          console.log('error updating user:');
          console.log(err);
          reject(err);
        }

        resolve(newUserInfo);
      }
    );
  });
};

server.start((err) => {
  console.log('Hapi is listening on http://localhost:8080');
});
