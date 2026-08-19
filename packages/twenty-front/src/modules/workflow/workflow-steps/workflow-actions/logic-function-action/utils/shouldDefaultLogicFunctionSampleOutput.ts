import { isObject } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';

import {
  getGtmNativeLogicFunctionSampleOutput,
  isNativeGtmLogicFunction,
} from '@/workflow/workflow-steps/workflow-actions/logic-function-action/constants/gtmNativeLogicFunctionSampleOutput';

const containsCanonicalKeys = (
  actual: unknown,
  canonical: unknown,
): boolean => {
  if (Array.isArray(canonical)) {
    if (!Array.isArray(actual) || actual.length === 0) {
      return false;
    }

    return containsCanonicalKeys(actual[0], canonical[0]);
  }

  if (isObject(canonical) && !Array.isArray(canonical)) {
    if (!isObject(actual) || Array.isArray(actual)) {
      return false;
    }

    return Object.keys(canonical).every((key) =>
      containsCanonicalKeys(
        (actual as Record<string, unknown>)[key],
        (canonical as Record<string, unknown>)[key],
      ),
    );
  }

  return isDefined(actual);
};

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

  const canonical = getGtmNativeLogicFunctionSampleOutput(logicFunctionName);

  if (!isDefined(canonical)) {
    return false;
  }

  return !containsCanonicalKeys(expectedOutputSchema, canonical);
};
