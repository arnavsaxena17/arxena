import { isDefined } from 'twenty-shared/utils';
import { DEFAULT_WORKFLOW_ACTION_ERROR_HANDLING_OPTIONS } from 'twenty-shared/workflow';

type WorkflowRunStepLike = {
  settings?: {
    errorHandlingOptions?: unknown;
  };
};

type WorkflowRunLike = {
  state?: {
    flow?: {
      steps?: WorkflowRunStepLike[];
    };
  };
};

export const withDefaultWorkflowActionErrorHandlingOptions = (
  rawRecord: unknown,
): unknown => {
  if (!isDefined(rawRecord) || typeof rawRecord !== 'object') {
    return rawRecord;
  }

  const record = rawRecord as WorkflowRunLike;
  const steps = record.state?.flow?.steps;

  if (!Array.isArray(steps)) {
    return rawRecord;
  }

  return {
    ...record,
    state: {
      ...record.state,
      flow: {
        ...record.state?.flow,
        steps: steps.map((step) => {
          if (isDefined(step?.settings?.errorHandlingOptions)) {
            return step;
          }

          return {
            ...step,
            settings: {
              ...step?.settings,
              errorHandlingOptions:
                DEFAULT_WORKFLOW_ACTION_ERROR_HANDLING_OPTIONS,
            },
          };
        }),
      },
    },
  };
};
