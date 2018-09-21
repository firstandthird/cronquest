const logall = require('logr-all');
const wreck = require('wreck');
const humanDate = require('human-date');
const runshell = require('runshell');
const confi = require('confi');
const CronJob = require('cron').CronJob;

const log = logall({});

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
      headers: endpointSpec.headers || {},
      json: true
    });
    if (res.statusCode === 200) {
      log([endpointName, 'success'], payload);
    }
  } catch (err) {
    return log([endpointName, 'error'], err);
  }
};

// store all intervals so we can gracefull stop them later:
const allIntervals = [];

const registerEndpoint = (endpointName, endpointSpec, timezone) => {
  const executeInterval = () => {
    log([endpointName, 'running'], `running ${endpointName}`);
    // 'endpoint' means it is a url to invoke:
    if (endpointSpec.endpoint) {
      return processEndpoint(endpointName, endpointSpec);
    }
    // 'script means it is a path to a shell script:
    return processScript(endpointName, endpointSpec);
  };
  if (endpointSpec.enabled === false) {
    return log([endpointName, 'not registered'], {
      message: `${endpointName} is marked as disabled and will not run`,
      options: endpointSpec
    });
  }
  const jobSpec = {
    cronTime: endpointSpec.interval,
    onTick: executeInterval,
    start: true,
    runOnInit: endpointSpec.runNow,
    timeZone: timezone
  };
  const job = new CronJob(jobSpec);
  allIntervals.push(job);
  const first = job.nextDate();
  log([endpointName, 'registered'], {
    message: `registered ${endpointName}`,
    nextRun: first.format('MMM Do YYYY, h:mma z'),
    runIn: humanDate.relativeTime(first),
    options: endpointSpec
  });
};

module.exports = async(jobsPath, delay = 0) => {
  // load-parse the yaml joblist
  log(['starting'], 'starting cronquest...');
  const options = { envVars: 'CRON' };
  if (jobsPath && (jobsPath.startsWith('http://') || jobsPath.startsWith('https://'))) {
    options.url = jobsPath;
  } else {
    options.configFile = jobsPath;
  }
  const specs = await confi(options);
  if (specs.startDelay) {
    await new Promise(resolve => setTimeout(resolve, specs.startDelay));
  }
  // load a laterjs instance based on the timezone
  if (!specs.jobs) {
    throw new Error('no jobs found');
  }
  const jobNames = Object.keys(specs.jobs);
  for (let i = 0; i < jobNames.length; i++) {
    const jobName = jobNames[i];
    const registration = registerEndpoint(jobName, specs.jobs[jobName], specs.timezone);
    if (registration instanceof Error) {
      throw registration;
    }
  }
};
const stop = () => {
  log(['closing'], 'closing all scheduled intervals');
  allIntervals.forEach((interval) => {
    interval.stop();
  });
};
module.exports.stop = stop;
process.on('exit', () => stop());
