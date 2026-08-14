import { TWENTY_API_URL_ENV_VAR_NAME } from 'src/constants/twenty-api-url-env-var-name';
import { TWENTY_FUNCTIONS_URL_ENV_VAR_NAME } from 'src/constants/twenty-functions-url-env-var-name';
import { isNonEmptyString } from 'src/logic-functions/utils/is-non-empty-string.util';

export const resolveOwnRouteBaseUrl = (): string => {
  const injectedFunctionsUrl = process.env[TWENTY_FUNCTIONS_URL_ENV_VAR_NAME];

  if (isNonEmptyString(injectedFunctionsUrl)) {
    return injectedFunctionsUrl.replace(/\/+$/, '');
  }

  const injectedApiUrl = process.env[TWENTY_API_URL_ENV_VAR_NAME];

  if (isNonEmptyString(injectedApiUrl)) {
    return `${injectedApiUrl.replace(/\/+$/, '')}/s`;
  }

  throw new Error(
    `Unable to resolve Call Recorder own route target without ${TWENTY_FUNCTIONS_URL_ENV_VAR_NAME} or ${TWENTY_API_URL_ENV_VAR_NAME}`,
  );
};
