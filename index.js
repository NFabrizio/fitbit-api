const Hapi = require ('hapi');
const Fitbit = require('fitbit-node');
const Config = require('./config/config');

const client = new Fitbit(Config.clientId, Config.clientSecret);
const redirect_uri = 'http://localhost:8080/fitbit_oauth_callback';
const scope = 'acitivity profile';

const server = new Hapi.Server();
server.connection({ port: 8080 });

server.route([
  {
    method: "GET",
    path: "/",
    handler: (requst, reply) => {
      reply('Hello world from Hapi');
    }
  }
]);

server.start((err) => {
  console.log('Hapi is listening on http://localhost:8080');
});
