import { DEFAULT_OUTREACH_SEQUENCER_GRAPH_OPTIONS } from 'src/engine/workspace-manager/standard-objects-prefill-data/data/outreach-workflow-graphs';
import { buildSubstitutedCandidateSequencerGraph } from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/build-substituted-candidate-sequencer-graph.util';

const fieldMetadataIds = {
  candidateId: '11111111-1111-4111-8111-111111111111',
  personId: '22222222-2222-4222-8222-222222222222',
  outreachSequenceStage: '33333333-3333-4333-8333-333333333333',
  candidateFlags: '44444444-4444-4444-8444-444444444444',
  jobCompanyName: '55555555-5555-4555-8555-555555555555',
  projectId: '66666666-6666-4666-8666-666666666666',
  createdAt: '77777777-7777-4777-8777-777777777777',
  chatCandidateId: '88888888-8888-4888-8888-888888888888',
  chatCreatedAt: '99999999-9999-4999-8999-999999999999',
};

describe('buildSubstitutedCandidateSequencerGraph', () => {
  // Regression: personId was omitted from replacements, so personFind's
  // __FIELD_person.id__ survived substitution and threw for every
  // applyOutreachSequencerGraphOptions call.
  it('substitutes every field token the Candidate Sequencer graph uses', () => {
    expect(() =>
      buildSubstitutedCandidateSequencerGraph({
        workspaceId: 'workspace-id',
        fieldMetadataIds,
        options: DEFAULT_OUTREACH_SEQUENCER_GRAPH_OPTIONS,
      }),
    ).not.toThrow();
  });

  it('resolves person filters with the person id field metadata', () => {
    const { steps } = buildSubstitutedCandidateSequencerGraph({
      workspaceId: 'workspace-id',
      fieldMetadataIds,
      options: DEFAULT_OUTREACH_SEQUENCER_GRAPH_OPTIONS,
    });
    const personFinds = JSON.stringify(steps);

    expect(personFinds).toContain(fieldMetadataIds.personId);
    expect(personFinds).not.toContain('__FIELD_person.id__');
  });
});
