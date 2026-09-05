import {
  collectOutreachSequencerWorkflowIdsFromProject,
  isOutreachSequencerWorkflow,
  isOutreachSequencerWorkflowName,
  OUTREACH_SEQUENCER_SEEDED_WORKFLOW_NAMES,
  resolveOutreachSequencerStageFromName,
} from 'src/engine/core-modules/outreach-command/utils/resolve-outreach-pause-resume-workflow-ids.util';
import { SEEDED_OUTREACH_WORKFLOW } from 'src/engine/workspace-manager/standard-objects-prefill-data/constants/seeded-outreach-workflow-names.const';

describe('resolve-outreach-sequencer-workflow-ids', () => {
  it('includes Stage B and Stage C seeded names plus legacy aliases', () => {
    expect(OUTREACH_SEQUENCER_SEEDED_WORKFLOW_NAMES).toContain(
      SEEDED_OUTREACH_WORKFLOW.perCandidate.name,
    );
    expect(OUTREACH_SEQUENCER_SEEDED_WORKFLOW_NAMES).toContain(
      SEEDED_OUTREACH_WORKFLOW.candidateUpdated.name,
    );
    expect(OUTREACH_SEQUENCER_SEEDED_WORKFLOW_NAMES).toContain(
      'Outreach — Per Enrolled Person',
    );
    expect(OUTREACH_SEQUENCER_SEEDED_WORKFLOW_NAMES).not.toContain(
      SEEDED_OUTREACH_WORKFLOW.harvest.name,
    );
    expect(OUTREACH_SEQUENCER_SEEDED_WORKFLOW_NAMES).not.toContain(
      SEEDED_OUTREACH_WORKFLOW.companySearch.name,
    );
  });

  it('matches sequencer workflow by seeded name', () => {
    expect(
      isOutreachSequencerWorkflowName(
        SEEDED_OUTREACH_WORKFLOW.perCandidate.name,
      ),
    ).toBe(true);
    expect(
      isOutreachSequencerWorkflow({
        workflowId: 'custom',
        workflowName: SEEDED_OUTREACH_WORKFLOW.candidateUpdated.name,
      }),
    ).toBe(true);
    expect(
      isOutreachSequencerWorkflow({
        workflowId: 'harvest',
        workflowName: SEEDED_OUTREACH_WORKFLOW.harvest.name,
      }),
    ).toBe(false);
  });

  it('resolves Stage B vs Stage C from workflow name', () => {
    expect(
      resolveOutreachSequencerStageFromName(
        SEEDED_OUTREACH_WORKFLOW.perCandidate.name,
      ),
    ).toBe('perCandidate');
    expect(
      resolveOutreachSequencerStageFromName(
        SEEDED_OUTREACH_WORKFLOW.candidateUpdated.name,
      ),
    ).toBe('candidateUpdated');
    expect(
      resolveOutreachSequencerStageFromName(
        SEEDED_OUTREACH_WORKFLOW.harvest.name,
      ),
    ).toBeNull();
  });

  it('matches custom Stage B via project pin / experiment ids', () => {
    expect(
      collectOutreachSequencerWorkflowIdsFromProject({
        outreachWorkflowId: 'pinned-stage-b',
        outreachConfig: {
          experimentConfig: {
            status: 'running',
            split: 0.5,
            workflows: {
              perCandidate: { workflowId: 'experiment-stage-b' },
              candidateUpdated: { workflowId: 'experiment-stage-c' },
              companySearch: { workflowId: 'experiment-company-search' },
            },
          },
        },
      }).sort(),
    ).toEqual(['experiment-stage-b', 'experiment-stage-c', 'pinned-stage-b']);

    expect(
      isOutreachSequencerWorkflow({
        workflowId: 'pinned-stage-b',
        workflowName: 'Custom outreach clone',
        outreachWorkflowId: 'pinned-stage-b',
      }),
    ).toBe(true);

    expect(
      isOutreachSequencerWorkflow({
        workflowId: 'experiment-company-search',
        workflowName: 'Company Created → ICP People Search',
        outreachWorkflowId: 'pinned-stage-b',
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
});
