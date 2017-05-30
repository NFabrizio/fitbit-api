const Hapi = require ('hapi');
const Fitbit = require('fitbit-node');
const Config = require('./config/config');

const client = new Fitbit(Config.fitbit_creds.clientId, Config.fitbit_creds.clientSecret);
const redirect_uri = 'http://localhost:8080/fitbit_oauth_callback';
const scope = 'activity profile';

const server = new Hapi.Server();
server.connection({ port: 8080 });

server.route([
  {
    method: "GET",
    path: "/",
    handler: (requst, reply) => {
      reply('Hello world from Hapi');
    }
  },
  {
    method: "GET",
    path: "/fitbit",
    handler: (requst, reply) => {
      reply().redirect(client.getAuthorizeUrl(scope, redirect_uri));
    }
  },
  {
    method: "GET",
    path: "/fitbit_oauth_callback",
    handler: (request, reply) => {
      client.getAccessToken(request.query.code, redirect_uri)
      .then((result) => {
        client.get('/profile.json', result.access_token)
        .then((profile) => {
          reply(profile)
        });
      });
    }
  }
]);

server.start((err) => {
  console.log('Hapi is listening on http://localhost:8080');
});
