import { isObject } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';

import {
  GTM_SEARCH_PEOPLE_FOR_COMPANY_LOGIC_FUNCTION_NAME,
  isNativeGtmLogicFunction,
} from '@/workflow/workflow-steps/workflow-actions/logic-function-action/constants/gtmNativeLogicFunctionSampleOutput';

export const shouldDefaultLogicFunctionSampleOutput = ({
  logicFunctionName,
  expectedOutputSchema,
}: {
  logicFunctionName?: string | null;
  expectedOutputSchema: unknown;
}): boolean => {
  const hasSample =
    isDefined(expectedOutputSchema) &&
    isObject(expectedOutputSchema) &&
    Object.keys(expectedOutputSchema).length > 0;

  if (!hasSample) {
    return true;
  }

  if (!isNativeGtmLogicFunction(logicFunctionName)) {
    return false;
  }

  if (logicFunctionName === GTM_SEARCH_PEOPLE_FOR_COMPANY_LOGIC_FUNCTION_NAME) {
    return !Array.isArray(
      (expectedOutputSchema as { people?: unknown }).people,
    );
  }

  return false;
};
