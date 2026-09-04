import { StepStatus } from 'twenty-shared/workflow';

import { mergeWorkflowRunStepInfo } from 'src/modules/workflow/workflow-runner/utils/merge-workflow-run-step-info.util';

describe('mergeWorkflowRunStepInfo', () => {
  it('deletes keys set to undefined so stale pause metadata does not survive', () => {
    expect(
      mergeWorkflowRunStepInfo(
        {
          status: StepStatus.PENDING,
          pendingReason: 'outreach_project_paused',
          waitMs: 0,
          result: {
            pendingReason: 'outreach_project_paused',
            draft: 'hello',
          },
        },
        {
          status: StepStatus.PENDING,
          pendingReason: undefined,
          waitMs: undefined,
          scheduledAt: undefined,
          method: undefined,
        },
      ),
    ).toEqual({
      status: StepStatus.PENDING,
      result: {
        draft: 'hello',
      },
    });
  });

  it('keeps pendingReason when the patch sets a new capacity reason', () => {
    expect(
      mergeWorkflowRunStepInfo(
        {
          status: StepStatus.PENDING,
          pendingReason: 'outreach_project_paused',
        },
        {
          status: StepStatus.PENDING,
          pendingReason: 'linkedin_rate_limit',
          waitMs: 5000,
        },
      ),
    ).toEqual({
      status: StepStatus.PENDING,
      pendingReason: 'linkedin_rate_limit',
      waitMs: 5000,
    });
  });
});
