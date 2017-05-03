'use strict';
const Logr = require('logr');
const logrFlat = require('logr-flat');
const wreck = require('wreck');
const fs = require('fs');
const envload = require('envload');
const humanDate = require('human-date');
const runshell = require('runshell');

const log = Logr.createLogger({
  type: 'flat',
  reporters: {
    flat: {
      reporter: logrFlat,
      options: {
        timestamp: false,
        appColor: true
      }
    }
  }
});
const processScript = (scriptName, scriptSpec) => {
  runshell(scriptSpec.script, scriptSpec.payload, (err, data) => {
    if (err) {
      return log([scriptName, 'error'], err);
    }
    log([scriptName, 'success'], data);
  });
};

const processEndpoint = (endpointName, endpointSpec) => {
  log([endpointName, 'notice', 'running'], `running ${endpointName}`);
  if (!endpointSpec.endpoint) {
    log([endpointName, 'error'], `${endpointName} didn't provide an endpoint`);
    return;
  }
  wreck[endpointSpec.method || 'post'](endpointSpec.endpoint, {
    payload: endpointSpec.payload || {},
    headers: endpointSpec.headers || {}
  }, (err, res, payload) => {
    if (err) {
      return log([endpointName, 'error'], err);
    }
    if (res === 200) {
      log([endpointName, 'success'], payload);
    }
  });
};

// store all intervals so we can gracefull stop them later:
const allIntervals = [];
const registerEndpoint = (later, endpointName, endpointSpec) => {
  const laterInterval = later.parse.text(endpointSpec.interval);
  if (laterInterval.error !== -1) {
    throw new Error(`${endpointSpec.interval} is not a valid laterjs expression`);
  }
  const first = later.schedule(laterInterval).next(1);
  allIntervals.push(later.setInterval(() => {
    // 'endpoint' means it is a url to invoke:
    if (endpointSpec.endpoint) {
      return processEndpoint(endpointName, endpointSpec);
    }
    // 'script means it is a path to a shell script:
    return processScript(endpointName, endpointSpec);
  }, laterInterval));
  log([endpointName, 'notice'], {
    message: `registered ${endpointName}`,
    nextRun: first,
    runIn: humanDate.relativeTime(first),
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
    log(['info'], `Using timezone ${specs.timezone}`);
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
