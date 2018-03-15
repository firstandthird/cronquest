const Logr = require('logr');
const logrFlat = require('logr-flat');
const wreck = require('wreck');
const humanDate = require('human-date');
const runshell = require('runshell');
const confi = require('confi');
const moment = require('moment');
const CronJob = require('cron').CronJob;
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

const processEndpoint = async(endpointName, endpointSpec) => {
  if (!endpointSpec.endpoint) {
    log([endpointName, 'error'], `${endpointName} didn't provide an endpoint`);
    return;
  }
  try {
    const { res, payload } = await wreck[endpointSpec.method || 'post'](endpointSpec.endpoint, {
      payload: endpointSpec.payload || {},
      headers: endpointSpec.headers || {}
    });
    if (res === 200) {
      log([endpointName, 'success'], payload);
    }
  } catch (err) {
    return log([endpointName, 'error'], err);
  }
};

// store all intervals so we can gracefull stop them later:
const allIntervals = [];

const registerEndpoint = (endpointName, endpointSpec) => {
  const executeInterval = () => {
    log([endpointName, 'notice', 'running'], `running ${endpointName}`);
    // 'endpoint' means it is a url to invoke:
    if (endpointSpec.endpoint) {
      return processEndpoint(endpointName, endpointSpec);
    }
    // 'script means it is a path to a shell script:
    return processScript(endpointName, endpointSpec);
  };
  const jobSpec = {
    cronTime: endpointSpec.interval,
    onTick: executeInterval,
    start: true,
    runOnInit: endpointSpec.runNow,
    timeZone: endpointSpec.timezone
  };
  const job = new CronJob(jobSpec);
  allIntervals.push(job);
  const first = moment(new Date(new Date().getTime() + job._timeout._idleTimeout));
  log([endpointName, 'notice'], {
    message: `registered ${endpointName}`,
    nextRun: first.format('MMM Do YYYY, h:mma z'),
    runIn: humanDate.relativeTime(first),
    options: endpointSpec
  });
};

module.exports = async(jobsPath) => {
  // load-parse the yaml joblist
  const options = { envVars: 'CRON' };
  if (jobsPath && (jobsPath.startsWith('http://') || jobsPath.startsWith('https://'))) {
    options.url = jobsPath;
  } else {
    options.configFile = jobsPath;
  }
  const specs = await confi(options);

  // load a laterjs instance based on the timezone
  if (!specs.jobs) {
    throw new Error('no jobs found');
  }
  const jobNames = Object.keys(specs.jobs);
  for (let i = 0; i < jobNames.length; i++) {
    const jobName = jobNames[i];
    const registration = registerEndpoint(jobName, specs.jobs[jobName]);
    if (registration instanceof Error) {
      throw registration;
    }
  }
};
const stop = () => {
  log(['notice'], 'closing all scheduled intervals');
  allIntervals.forEach((interval) => {
    interval.stop();
  });
};
module.exports.stop = stop;
process.on('exit', () => stop());
