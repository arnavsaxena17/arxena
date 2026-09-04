import { StepStatus } from 'twenty-shared/workflow';

import {
  buildFailedRunSummaryFields,
  extractWorkflowRunFailedStepSummary,
} from 'src/engine/core-modules/outreach-command/utils/extract-workflow-run-failed-step.util';
import { type WorkflowRunState } from 'src/modules/workflow/common/standard-objects/workflow-run.workspace-entity';

const buildFailedState = (error: string): WorkflowRunState =>
  ({
    flow: {
      steps: [
        {
          id: 'step-1',
          name: 'Fetch LinkedIn messages',
          type: 'LOGIC_FUNCTION',
          valid: true,
          settings: {},
        },
      ],
      trigger: {
        type: 'DATABASE_EVENT',
        settings: {},
        nextStepIds: [],
      },
    },
    stepInfos: {
      'step-1': {
        status: StepStatus.FAILED,
        error,
      },
    },
  }) as WorkflowRunState;

describe('extractWorkflowRunFailedStepSummary', () => {
  it('reads the first failed step name and truncated error', () => {
    const summary = extractWorkflowRunFailedStepSummary({
      state: buildFailedState(
        'The requested resource were not found.\nAttendee not found',
      ),
    });

    expect(summary).toEqual({
      stepId: 'step-1',
      stepName: 'Fetch LinkedIn messages',
      errorMessage: 'The requested resource were not found.',
    });
  });

  it('maps failed run summary fields for journey payloads', () => {
    const fields = buildFailedRunSummaryFields({
      state: buildFailedState('Attendee not found'),
    });

    expect(fields).toEqual({
      currentStepName: 'Fetch LinkedIn messages',
      currentStepKind: 'FAILED',
      errorMessage: 'Attendee not found',
    });
  });
});
