'use strict';
const Logr = require('logr');
const logrFlat = require('logr-flat');
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

// store all intervals so we can gracefull stop them later:
const allIntervals = [];
const registerEndpoint = require('./lib/registerEndpoint');

module.exports = async(jobsPath) => {
  // load-parse the yaml joblist
  const options = { envVars: 'CRON' };
  if (jobsPath && (jobsPath.startsWith('http://') || jobsPath.startsWith('https://'))) {
    options.url = jobsPath;
  } else {
    options.configFile = jobsPath;
  }

  const specs = await confi(options);
  if (!specs.jobs) {
    throw new Error('no jobs found');
  }

  const jobNames = Object.keys(specs.jobs);
  for (let i = 0; i < jobNames.length; i++) {
    const jobName = jobNames[i];
    const registration = registerEndpoint(log, jobName, specs, allIntervals);
    if (registration instanceof Error) {
      throw registration;
    }
  }
};
const stop = () => {
  log(['notice'], 'closing all scheduled intervals');
  allIntervals.forEach((interval) => {
    interval.clear();
  });
};
module.exports.stop = stop;
process.on('exit', () => stop());
