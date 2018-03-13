'use strict';
const tap = require('tap');
const Hapi = require('hapi');
const cronquest = require('../index.js');
const path = require('path');

let server;
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

tap.beforeEach(async() => {
  server = new Hapi.Server({ port: 8080 });
  await server.start();
});

tap.afterEach(async() => {
  // clear running cronquest tasks before exiting:
  cronquest.stop();
  await server.stop();
});

tap.test('can load a schedule of intervals', async(t) => {
  let x = 0;
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
  cronquest(path.join(process.cwd(), 'test', 'samples', 'recurring.yaml'));
  // wait a few seconds for the endpoint to be called by cronquest:
  await wait(4000);
  // verify endpoint was called:
  t.equal(x > 0, true);
  t.end();
});

tap.test('will augment script with env variables', async(t) => {
  let x = 0;
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
  process.env.CRON_JOBS__DAILY_EMAILS__RUN_NOW = true;
  cronquest(path.join(process.cwd(), 'test', 'samples', 'recurring.yaml'));
  // wait a few seconds for the endpoint to be called by cronquest:
  await wait(1000);
  // verify endpoint was called:
  t.equal(x > 0, true);
  t.end();
});

tap.test('processes with runNow are run immediately after registration too', async(t) => {
  let x = 0;
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
  cronquest(path.join(process.cwd(), 'test', 'samples', 'now.yaml'));
  // wait a few seconds for the endpoint to be called by cronquest:
  await wait(1000);
  // verify endpoint was called:
  t.equal(x > 0, true);
  t.end();
});

tap.test('will error if there is a bad interval', async(t) => {
  try {
    await cronquest(path.join(process.cwd(), 'test', 'samples', 'broken.yaml'));
  } catch (err) {
    t.isA(err, Error);
    return t.end();
  }
  t.fail();
});

tap.test('also runs shell scripts', async(t) => {
  cronquest(path.join(process.cwd(), 'test', 'samples', 'script.yaml'));
  // wait a few seconds for the endpoint to be called by cronquest:
  await wait(8000);
  // verify endpoint was called:
  t.end();
});

tap.test('also runs shell scripts with no payload specified', async(t) => {
  cronquest(path.join(process.cwd(), 'test', 'samples', 'noPayload.yaml'));
  // wait a few seconds for the endpoint to be called by cronquest:
  await wait(8000);
  // verify endpoint was called:
  t.end();
});
