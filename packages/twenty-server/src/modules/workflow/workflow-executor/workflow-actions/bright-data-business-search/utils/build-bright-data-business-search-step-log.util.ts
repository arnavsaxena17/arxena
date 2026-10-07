import { type WorkflowRunStepLog } from 'twenty-shared/workflow';

import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';

export const buildBrightDataBusinessSearchStepLog = ({
  output,
  durationMs,
}: {
  query?: string;
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
            type: 'BrightDataBusinessSearchError',
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
