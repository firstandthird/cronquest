'use strict';
const Logr = require('logr');
const logrFlat = require('logr-flat');
const wreck = require('wreck');
const fs = require('fs');

const log = Logr.createLogger({
  type: 'flat',
  reporters: {
    flat: {
      reporter: logrFlat
    }
  }
});

const processEndpoint = (endpointName, endpointSpec) => wreck[endpointSpec.method](endpointSpec.endpoint, {
  payload: endpointSpec.payload || {},
  headers: endpointSpec.headers || {}
}, (err, res, payload) => {
  if (err) {
    return log(['error'], err);
  }
  if (res === 200) {
    log(['notice'], payload);
  }
});

// store all intervals so we can gracefull stop them later:
const allIntervals = [];
const registerEndpoint = (later, endpointName, endpointSpec) => {
  const laterInterval = later.parse.text(endpointSpec.interval);
  allIntervals.push(later.setInterval(() => {
    processEndpoint(endpointName, endpointSpec);
  }, laterInterval));
  log(['notice'], `registered ${endpointName} to process ${endpointSpec.interval}`);
};

module.exports = (jobsPath, options) => {
  // load-parse the yaml joblist
  const allJobSpecs = require('js-yaml').safeLoad(fs.readFileSync(jobsPath, 'utf8'));
  // load a laterjs instance based on the timezone
  const later = require('later');
  require('later-timezone').timezone(later, allJobSpecs.timezone);
  Object.keys(allJobSpecs.jobs).forEach((jobName) => {
    registerEndpoint(later, jobName, allJobSpecs.jobs[jobName]);
  });
};
const stop = () => {
  log(['notice'], 'closing all scheduled intervals');
  allIntervals.forEach((interval) => {
    interval.clear();
  });
};
module.exports.stop = stop;
// process.on('exit', () => stop());
