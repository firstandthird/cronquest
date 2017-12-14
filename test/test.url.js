'use strict';
const tap = require('tap');
const Hapi = require('hapi');
const cronquest = require('../index.js');

tap.test('can fetch the schedule from a remote url', async(t) => {
  let x = 0;
  const server = new Hapi.Server({ port: 8080 });
  await server.start();
  server.route({
    path: '/schedule',
    method: 'GET',
    handler(request, h) {
      return {
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
      };
    }
  });
  server.route({
    path: '/api/jobs/blah',
    method: 'POST',
    handler(request, h) {
      t.equal(request.payload.p1, 2);
      t.equal(request.headers.h1, '3');
      x++;
      return { success: 'true' };
    }
  });
  cronquest('http://localhost:8080/schedule');
  // wait a few seconds for the endpoint to be called by cronquest:
  setTimeout(() => {
    // verify endpoint was called:
    t.equal(x > 0, true);
    t.end();
  }, 8000);
  // clear running cronquest tasks before exiting:
  cronquest.stop();
  await server.stop();
});
