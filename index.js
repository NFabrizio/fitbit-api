const Hapi = require ('hapi');
const Fitbit = require('fitbit-node');
const mongoose = require('mongoose');
const Config = require('./config/config');

mongoose.connect('mongodb://localhost/fitbitApi');
const db = mongoose.connection;

const userSchema = mongoose.Schema({
  userId: String,
  accessToken: String,
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
    config: { json: { space: 2 } },
    path: "/api/v1/users",
    handler: (request, reply) => {
      const result = User.find();
      result.exec((err, users) => {
        const userList = [];
        users.forEach((userDoc) => {
          const user = userDoc.toObject();
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
        client.get('profile.json', user.accessToken)
        .then((profile) => {
          reply(profile);
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
    path: "/fitbit_oauth_callback",
    handler: (request, reply) => {
      client.getAccessToken(request.query.code, redirect_uri)
      .then((result) => {
        updateUser(result.user_id, result.access_token, result.refresh_token);
        client.get('/profile.json', result.access_token)
        .then((results) => {
          reply().redirect(`/api/v1/users/${result.user_id}`);
        });
      });
    }
  }
]);

const updateUser = (userId, accessToken, refreshToken) => {
  const newUserInfo = {
    userId,
    accessToken,
    refreshToken
  };
  const newUser = new User(newUserInfo);

  User.update({userId: userId}, newUser, {upsert:true}, (err) => {
    return;
  });
};

server.start((err) => {
  console.log('Hapi is listening on http://localhost:8080');
});
