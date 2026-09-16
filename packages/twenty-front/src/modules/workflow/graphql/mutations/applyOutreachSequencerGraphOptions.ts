import { gql } from '@apollo/client';

export const APPLY_OUTREACH_SEQUENCER_GRAPH_OPTIONS = gql`
  mutation ApplyOutreachSequencerGraphOptions(
    $input: ApplyOutreachSequencerGraphOptionsInput!
  ) {
    applyOutreachSequencerGraphOptions(input: $input) {
      id
      name
      status
      trigger
      steps
      createdAt
      updatedAt
    }
  }
`;
