const processEndpoint = require('./processEndpoint');
const processScript = require('./processScript');
const humanDate = require('human-date');


module.exports = (log, endpointName, specs, allIntervals) => {

  // load a laterjs instance based on the timezone
  const later = require('later');
  if (specs.timezone) {
    log(['info'], `Using timezone ${specs.timezone}`);
    require('later-timezone').timezone(later, specs.timezone);
  }
  const endpointSpec = specs.jobs[endpointName];
  const laterInterval = later.parse.text(endpointSpec.interval);
  if (laterInterval.error !== -1) {
    throw new Error(`${endpointSpec.interval} is not a valid laterjs expression`);
  }
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
  // const first = later.firstRunMoment;
  log([endpointName, 'notice'], {
    message: `registered ${endpointName}`,
    nextRun: first.format('MMM Do YYYY, h:mma z'),
    runIn: humanDate.relativeTime(first),
    options: endpointSpec
  });
};
