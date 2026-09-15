import {
  collectOutreachSequencerWorkflowIdsFromProject,
  isOutreachSequencerWorkflow,
  isOutreachSequencerWorkflowName,
  mergeOutreachSequencerWorkflowIds,
  OUTREACH_SEQUENCER_SEEDED_WORKFLOW_NAMES,
  resolveOutreachSequencerStageFromName,
} from 'src/engine/core-modules/outreach-command/utils/resolve-outreach-pause-resume-workflow-ids.util';
import { SEEDED_OUTREACH_WORKFLOW } from 'src/engine/workspace-manager/standard-objects-prefill-data/constants/seeded-outreach-workflow-names.const';

describe('resolve-outreach-sequencer-workflow-ids', () => {
  it('includes Candidate Sequencer seeded name only', () => {
    expect(OUTREACH_SEQUENCER_SEEDED_WORKFLOW_NAMES).toEqual([
      SEEDED_OUTREACH_WORKFLOW.candidateSequencer.name,
    ]);
  });

  it('matches sequencer workflow by seeded name', () => {
    expect(
      isOutreachSequencerWorkflowName(
        SEEDED_OUTREACH_WORKFLOW.candidateSequencer.name,
      ),
    ).toBe(true);
    expect(
      isOutreachSequencerWorkflow({
        workflowId: 'custom',
        workflowName: SEEDED_OUTREACH_WORKFLOW.candidateSequencer.name,
      }),
    ).toBe(true);
    expect(
      isOutreachSequencerWorkflowName(
        SEEDED_OUTREACH_WORKFLOW.perCandidate.name,
      ),
    ).toBe(false);
    expect(
      isOutreachSequencerWorkflow({
        workflowId: 'harvest',
        workflowName: SEEDED_OUTREACH_WORKFLOW.harvest.name,
      }),
    ).toBe(false);
  });

  it('matches local compressed-delay name suffixes', () => {
    expect(
      resolveOutreachSequencerStageFromName(
        'Outreach — Candidate Sequencer (30 seconds)',
      ),
    ).toBe('candidateSequencer');
    expect(
      isOutreachSequencerWorkflowName(
        'Outreach — Candidate Sequencer (3 minutes)',
      ),
    ).toBe(true);
  });

  it('resolves Candidate Sequencer stage from workflow name', () => {
    expect(
      resolveOutreachSequencerStageFromName(
        SEEDED_OUTREACH_WORKFLOW.candidateSequencer.name,
      ),
    ).toBe('candidateSequencer');
    expect(
      resolveOutreachSequencerStageFromName(
        SEEDED_OUTREACH_WORKFLOW.perCandidate.name,
      ),
    ).toBeNull();
    expect(
      resolveOutreachSequencerStageFromName(
        SEEDED_OUTREACH_WORKFLOW.harvest.name,
      ),
    ).toBeNull();
  });

  it('matches custom sequencer via project pin / experiment ids', () => {
    expect(
      collectOutreachSequencerWorkflowIdsFromProject({
        outreachWorkflowId: 'pinned-sequencer',
        outreachConfig: {
          experimentConfig: {
            status: 'running',
            split: 0.5,
            workflows: {
              candidateSequencer: { workflowId: 'experiment-sequencer' },
              companySearch: { workflowId: 'experiment-company-search' },
            },
          },
        },
      }).sort(),
    ).toEqual(['experiment-sequencer', 'pinned-sequencer']);

    expect(
      isOutreachSequencerWorkflow({
        workflowId: 'pinned-sequencer',
        workflowName: 'Custom outreach clone',
        outreachWorkflowId: 'pinned-sequencer',
      }),
    ).toBe(true);

    expect(
      isOutreachSequencerWorkflow({
        workflowId: 'experiment-company-search',
        workflowName: 'Company Created → ICP People Search',
        outreachWorkflowId: 'pinned-sequencer',
        outreachConfig: {
          experimentConfig: {
            status: 'running',
            split: 0.5,
            workflows: {
              companySearch: { workflowId: 'experiment-company-search' },
            },
          },
        },
      }),
    ).toBe(false);
  });

  it('uses name match only when project pin is null', () => {
    expect(
      mergeOutreachSequencerWorkflowIds({
        projectWorkflowIds: ['pinned-sequencer'],
        workflowsMatchedByName: [{ id: 'seeded-by-name' }],
      }),
    ).toEqual(new Set(['pinned-sequencer']));

    expect(
      mergeOutreachSequencerWorkflowIds({
        projectWorkflowIds: [],
        workflowsMatchedByName: [{ id: 'seeded-by-name' }],
      }),
    ).toEqual(new Set(['seeded-by-name']));
  });
});
