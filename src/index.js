const core = require('@actions/core');
const SSM = require('aws-sdk/clients/ssm');

(async () => {
  const ssmParams = core.getInput('SSM_PARAMETERS', { required: true });

  core.startGroup('Injecting secret environment variables');

  const ssm = new SSM();

  try {
    const regex = /(?<envKey>\w+)=\s*(?<ssmParam>[^,\s*]*)/gi;
    const params = {};

    let match;
    while ((match = regex.exec(ssmParams)) !== null) {
      params[match.groups.ssmParam] = match.groups.envKey.toUpperCase();
    }

    const getParametersRequest = {
      Names: Object.keys(params),
      WithDecryption: true,
    };

    const response = await ssm.getParameters(getParametersRequest).promise();

    for (const parameter of response?.Parameters ?? []) {
      const { Name: name, Value: value } = parameter;
      if (!(name && value)) {
        core.warning(`Value unset for ${name ?? 'param'} in getParameters response`);
        continue;
      }
      const envKey = params[name];
      core.setSecret(value);
      core.exportVariable(envKey, value);
      core.info(`Secret ${envKey} injected`);
    }
    if (response?.InvalidParameters.length) {
      core.warning(`could not retrieve the following parameters: ${response.InvalidParameters.join(' ')}`);
    }
  } catch (error) {
    core.setFailed(error.message);
    throw error;
  }

  core.endGroup();
})();
