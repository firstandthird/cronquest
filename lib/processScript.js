const runshell = require('runshell');

module.exports = (log, scriptName, scriptSpec) => {
  runshell(scriptSpec.script, scriptSpec.payload || {}, (err, data) => {
    if (err) {
      return log([scriptName, 'error'], err);
    }
    log([scriptName, 'success'], data);
  });
};
