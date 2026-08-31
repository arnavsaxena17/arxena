import {
  LEGACY_GTM_SEND_WINDOW_PENDING_REASON,
  normalizeOutreachPendingReason,
  OUTREACH_SEND_WINDOW_PENDING_REASON,
} from 'src/engine/core-modules/outreach-command/utils/outreach-experiment.util';
import {
  normalizeWorkflowRunStepDeferralFields,
  readWorkflowRunStepPendingReason,
  readWorkflowRunStepScheduledAt,
} from 'src/engine/core-modules/outreach-command/utils/read-workflow-run-step-pending-fields.util';

describe('readWorkflowRunStepPendingFields', () => {
  it('normalizes legacy gtm_send_window from nested result', () => {
    expect(
      readWorkflowRunStepPendingReason({
        status: 'PENDING',
        result: {
          pendingReason: LEGACY_GTM_SEND_WINDOW_PENDING_REASON,
        },
      }),
    ).toBe(OUTREACH_SEND_WINDOW_PENDING_REASON);
  });

  it('reads scheduledAt from nested result', () => {
    expect(
      readWorkflowRunStepScheduledAt({
        result: {
          scheduledAt: '2026-09-01T02:41:30.609Z',
        },
      }),
    ).toBe('2026-09-01T02:41:30.609Z');
  });

  it('promotes normalized pending reason to top-level step info', () => {
    expect(
      normalizeWorkflowRunStepDeferralFields({
        status: 'PENDING',
        result: {
          pendingReason: LEGACY_GTM_SEND_WINDOW_PENDING_REASON,
          scheduledAt: '2026-09-01T02:41:30.609Z',
        },
      }),
    ).toEqual({
      status: 'PENDING',
      pendingReason: OUTREACH_SEND_WINDOW_PENDING_REASON,
      result: {
        pendingReason: OUTREACH_SEND_WINDOW_PENDING_REASON,
        scheduledAt: '2026-09-01T02:41:30.609Z',
      },
    });
  });
});

describe('normalizeOutreachPendingReason', () => {
  it('maps legacy gtm_send_window to outreach_send_window', () => {
    expect(
      normalizeOutreachPendingReason(LEGACY_GTM_SEND_WINDOW_PENDING_REASON),
    ).toBe(OUTREACH_SEND_WINDOW_PENDING_REASON);
  });
});
