'use strict';
const tap = require('tap');
const Hapi = require('hapi');
const cronquest = require('../index.js');

let server;

tap.beforeEach(async() => {
  server = new Hapi.Server({ port: 8080 });
  await server.start();
});

tap.afterEach(async() => {
  // clear running cronquest tasks before exiting:
  cronquest.stop();
  await server.stop();
});

tap.test('can fetch the schedule from a remote url', async(t) => {
  let x = 0;
  server.route({
    path: '/schedule',
    method: 'GET',
    handler(request, h) {
      return {
        timezone: 'America/Chicago',
        jobs: {
          dailyEmails: {
            interval: '* * * * * *',
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
  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  await wait(2000);
  // verify endpoint was called:
  t.equal(x > 0, true);
  t.end();
});
