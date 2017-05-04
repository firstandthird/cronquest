'use strict';
const tap = require('tap');
const Hapi = require('hapi');
const cronquest = require('../index.js');
const path = require('path');
let server;

tap.beforeEach((done) => {
  server = new Hapi.Server();
  server.connection({ port: 8080 });
  server.start(done);
});

tap.afterEach((done) => {
  // clear running cronquest tasks before exiting:
  cronquest.stop();
  server.stop(done);
});

tap.test('can get spec from a remote url', (t) => {
  // a spec server, cronquest will get the yaml from here:
  server.route({
    path: '/spec',
    method: 'GET',
    handler(request, reply) {
      reply({
        timezone: 'America/Chicago',
        jobs: {
          dailyEmails: {
            interval: 'every 2 seconds',
            endpoint: 'http://localhost:8080/api/jobs/blah',
            method: 'post',
            payload: {
              p1: 2
            },
            headers: {
              h1: 3
            }
          }
        }
      });
    }
  });
  let x = 0;
  server.route({
    path: '/api/jobs/blah',
    method: 'POST',
    handler(request, reply) {
      t.equal(request.payload.p1, 2);
      t.equal(request.headers.h1, '3');
      x++;
      reply({ success: 'true' });
    }
  });
  // tell cronquest to get the yaml from the spec server:
  cronquest('http://localhost:8080/spec');
  // wait a few seconds for the endpoint to be called by cronquest:
  setTimeout(() => {
    // verify endpoint was called:
    t.equal(x > 0, true);
    t.end();
  }, 8000);
});
