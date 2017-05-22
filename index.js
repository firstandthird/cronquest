'use strict';
const Logr = require('logr');
const logrFlat = require('logr-flat');
const wreck = require('wreck');
const humanDate = require('human-date');
const runshell = require('runshell');
const confi = require('confi');

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
  runshell(scriptSpec.script, scriptSpec.payload || {}, (err, data) => {
    if (err) {
      return log([scriptName, 'error'], err);
    }
    log([scriptName, 'success'], data);
  });
};

const processEndpoint = (endpointName, endpointSpec) => {
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
    return new Error(`${endpointSpec.interval} is not a valid laterjs expression`);
  }
  const first = later.schedule(laterInterval).next(1);
  const executeInterval = () => {
    log([endpointName, 'notice', 'running'], `running ${endpointName}`);
    // 'endpoint' means it is a url to invoke:
    if (endpointSpec.endpoint) {
      return processEndpoint(endpointName, endpointSpec);
    }
    // 'script means it is a path to a shell script:
    return processScript(endpointName, endpointSpec);
  };
  // if marked 'now' then fire it immediately:
  if (endpointSpec.runNow) {
    executeInterval();
  }
  allIntervals.push(later.setInterval(executeInterval, laterInterval));
  log([endpointName, 'notice'], {
    message: `registered ${endpointName}`,
    nextRun: first,
    runIn: humanDate.relativeTime(first),
    options: endpointSpec
  });
};

module.exports = (jobsPath, callback) => {
  // load-parse the yaml joblist
  const options = { envVars: 'CRON' };
  if (jobsPath && (jobsPath.startsWith('http://') || jobsPath.startsWith('https://'))) {
    options.url = jobsPath;
  } else {
    options.configFile = jobsPath;
  }
  confi(options, (err, specs) => {
    if (err) {
      return callback(err);
    }
    // load a laterjs instance based on the timezone
    const later = require('later');
    if (specs.timezone) {
      log(['info'], `Using timezone ${specs.timezone}`);
      require('later-timezone').timezone(later, specs.timezone);
    }
    if (!specs.jobs) {
      return callback(new Error('no jobs found'));
    }
    const jobNames = Object.keys(specs.jobs);
    for (let i = 0; i < jobNames.length; i++) {
      const jobName = jobNames[i];
      const registration = registerEndpoint(later, jobName, specs.jobs[jobName]);
      if (registration instanceof Error) {
        return callback(registration);
      }
    }
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
