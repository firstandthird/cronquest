const wreck = require('wreck');

module.exports = async(log, endpointName, endpointSpec) => {
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
