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

tap.test('can load a schedule of intervals', (t) => {
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
  cronquest(path.join(process.cwd(), 'test', 'samples', 'recurring.yaml'));
  // wait a few seconds for the endpoint to be called by cronquest:
  setTimeout(() => {
    // verify endpoint was called:
    t.equal(x > 0, true);
    t.end();
  }, 8000);
});