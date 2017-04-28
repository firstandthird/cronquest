'use strict';
const Logr = require('logr');
const logrFlat = require('logr-flat');
const wreck = require('wreck');
const fs = require('fs');
const envload = require('envload');

const log = Logr.createLogger({
  type: 'flat',
  reporters: {
    flat: {
      reporter: logrFlat
    }
  }
});

const processEndpoint = (endpointName, endpointSpec) => {
  log(['notice', 'running', endpointName], `running ${endpointName}`);
  if (!endpointSpec.endpoint) {
    log(['error'], `${endpointName} didn't provide an endpoint`);
    return;
  }
  wreck[endpointSpec.method || 'post'](endpointSpec.endpoint, {
    payload: endpointSpec.payload || {},
    headers: endpointSpec.headers || {}
  }, (err, res, payload) => {
    if (err) {
      return log(['error', endpointName], err);
    }
    if (res === 200) {
      log(['success', endpointName], payload);
    }
  });
};

// store all intervals so we can gracefull stop them later:
const allIntervals = [];
const registerEndpoint = (later, endpointName, endpointSpec) => {
  const laterInterval = later.parse.text(endpointSpec.interval);
  allIntervals.push(later.setInterval(() => {
    processEndpoint(endpointName, endpointSpec);
  }, laterInterval));
  log(['notice', endpointName], {
    message: `registered ${endpointName}`,
    options: endpointSpec
  });
};

module.exports = (jobsPath, options) => {
  // load-parse the yaml joblist
  let specs = {};
  if (jobsPath) {
    specs = require('js-yaml').safeLoad(fs.readFileSync(jobsPath, 'utf8'));
  } else {
    specs = envload('CRON');
  }
  // load a laterjs instance based on the timezone
  const later = require('later');
  if (specs.timezone) {
    require('later-timezone').timezone(later, specs.timezone);
  }
  if (!specs.jobs) {
    throw new Error('no jobs found');
  }
  Object.keys(specs.jobs).forEach((jobName) => {
    registerEndpoint(later, jobName, specs.jobs[jobName]);
  });
};
const stop = () => {
  log(['notice'], 'closing all scheduled intervals');
  allIntervals.forEach((interval) => {
    interval.clear();
  });
};
module.exports.stop = stop;
process.on('exit', () => stop());
