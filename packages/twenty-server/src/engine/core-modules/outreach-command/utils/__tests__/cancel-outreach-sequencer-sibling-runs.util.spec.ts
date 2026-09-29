import {
  isOlderWorkflowRunThan,
  isOutreachSequencerSiblingCancelEntryStage,
  readOutreachSequenceStageFromTriggerPayload,
  shouldCancelOutreachSequencerSiblingRuns,
} from 'src/engine/core-modules/outreach-command/utils/cancel-outreach-sequencer-sibling-runs.util';
import { SEEDED_OUTREACH_WORKFLOW } from 'src/engine/workspace-manager/standard-objects-prefill-data/constants/seeded-outreach-workflow-names.const';

describe('cancel-outreach-sequencer-sibling-runs.util', () => {
  it('recognizes CONNECTION_ACCEPTED and REPLIED entry stages only', () => {
    expect(isOutreachSequencerSiblingCancelEntryStage('REPLIED')).toBe(true);
    expect(
      isOutreachSequencerSiblingCancelEntryStage('CONNECTION_ACCEPTED'),
    ).toBe(true);
    expect(isOutreachSequencerSiblingCancelEntryStage('QUEUED')).toBe(false);
    expect(isOutreachSequencerSiblingCancelEntryStage('WAITING_REPLY')).toBe(
      false,
    );
  });

  it('reads stage from database-event after payload', () => {
    expect(
      readOutreachSequenceStageFromTriggerPayload({
        properties: { after: { outreachSequenceStage: 'REPLIED' } },
      }),
    ).toBe('REPLIED');
  });

  it('reads stage from top-level or nested manual payload', () => {
    expect(
      readOutreachSequenceStageFromTriggerPayload({
        outreachSequenceStage: 'CONNECTION_ACCEPTED',
      }),
    ).toBe('CONNECTION_ACCEPTED');
    expect(
      readOutreachSequenceStageFromTriggerPayload({
        payload: { outreachSequenceStage: 'REPLIED' },
      }),
    ).toBe('REPLIED');
  });

  it('only cancels for Candidate Sequencer + cancel entry stages + candidate', () => {
    expect(
      shouldCancelOutreachSequencerSiblingRuns({
        workflowName: SEEDED_OUTREACH_WORKFLOW.candidateSequencer.name,
        entryStage: 'REPLIED',
        candidateId: 'candidate-1',
      }),
    ).toBe(true);

    expect(
      shouldCancelOutreachSequencerSiblingRuns({
        workflowName: `${SEEDED_OUTREACH_WORKFLOW.candidateSequencer.name} (30 seconds)`,
        entryStage: 'CONNECTION_ACCEPTED',
        candidateId: 'candidate-1',
      }),
    ).toBe(true);

    expect(
      shouldCancelOutreachSequencerSiblingRuns({
        workflowName: SEEDED_OUTREACH_WORKFLOW.harvest.name,
        entryStage: 'REPLIED',
        candidateId: 'candidate-1',
      }),
    ).toBe(false);

    expect(
      shouldCancelOutreachSequencerSiblingRuns({
        workflowName: SEEDED_OUTREACH_WORKFLOW.candidateSequencer.name,
        entryStage: 'QUEUED',
        candidateId: 'candidate-1',
      }),
    ).toBe(false);

    expect(
      shouldCancelOutreachSequencerSiblingRuns({
        workflowName: SEEDED_OUTREACH_WORKFLOW.candidateSequencer.name,
        entryStage: 'REPLIED',
        candidateId: null,
      }),
    ).toBe(false);
  });

  it('compares createdAt for older sibling detection', () => {
    expect(
      isOlderWorkflowRunThan({
        siblingCreatedAt: '2026-09-24T04:00:00.000Z',
        currentCreatedAt: '2026-09-24T05:00:00.000Z',
      }),
    ).toBe(true);
    expect(
      isOlderWorkflowRunThan({
        siblingCreatedAt: '2026-09-24T05:00:00.000Z',
        currentCreatedAt: '2026-09-24T05:00:00.000Z',
      }),
    ).toBe(false);
  });
});
