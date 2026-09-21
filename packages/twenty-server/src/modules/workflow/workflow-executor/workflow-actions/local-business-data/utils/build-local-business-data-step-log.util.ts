import { type WorkflowRunStepLog } from 'twenty-shared/workflow';

import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';

export const buildLocalBusinessDataStepLog = ({
  output,
  durationMs,
}: {
  actionType: 'SEARCH_LOCAL_BUSINESSES' | 'GET_LOCAL_BUSINESS_DETAILS';
  query?: string;
  businessIds?: string[];
  output: ToolOutput;
  durationMs: number;
}): WorkflowRunStepLog => {
  return {
    details: {
      type: 'CODE',
      durationMs,
      status: output.success ? 'SUCCESS' : 'ERROR',
      error: output.error
        ? {
            type: 'LocalBusinessDataError',
            message: output.error,
          }
        : null,
    },
    entries: [
      {
        timestamp: new Date().toISOString(),
        level: output.success ? 'info' : 'error',
        message: output.message ?? (output.success ? 'OK' : 'Failed'),
      },
    ],
    sizeBytes: 0,
  };
};
