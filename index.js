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
        client.get(requestUrl, user.accessToken)
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

        client.get(requestUrl, user.accessToken)
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
          reply(). code(204);
        });
      });
    }
  }
]);

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

const getFitbitDate = (requestDate) => {
  if (requestDate) {
    return requestDate;
  }

  const d = new Date();
  const dateArray = [d.getFullYear(), d.getMonth(), d.getDate()];
  return dateArray.join('-');
};

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

const tokenRefreshCheck = (userData) => {
  const now = new Date();
  return (now - userData.createdAt) > userData.expiresIn;
};

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
