import {
  sequencerAutomatedTriggerLooksHealthy,
} from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/sync-workflow-automated-trigger-from-version.util';

describe('sequencerAutomatedTriggerLooksHealthy', () => {
  it('accepts candidateFlags-gated trigger settings', () => {
    expect(
      sequencerAutomatedTriggerLooksHealthy({
        fields: ['outreachSequenceStage', 'candidateFlags'],
        filterJson: JSON.stringify({
          stepFilters: [
            {
              stepOutputKey:
                '{{trigger.properties.after.candidateFlags.startOutreach}}',
            },
            {
              stepOutputKey:
                '{{trigger.properties.after.candidateFlags.stopOutreach}}',
            },
          ],
        }),
      }),
    ).toBe(true);
  });

  it('rejects legacy top-level startOutreach paths', () => {
    expect(
      sequencerAutomatedTriggerLooksHealthy({
        fields: ['outreachSequenceStage', 'startOutreach'],
        filterJson: JSON.stringify({
          stepFilters: [
            {
              stepOutputKey: '{{trigger.properties.after.startOutreach}}',
            },
            {
              stepOutputKey: '{{trigger.properties.after.stopOutreach}}',
            },
          ],
        }),
      }),
    ).toBe(false);
  });
});
