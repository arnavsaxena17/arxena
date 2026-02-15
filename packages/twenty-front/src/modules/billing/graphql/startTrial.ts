import { gql } from '@apollo/client';

export const START_TRIAL = gql`
  mutation StartTrial {
    startTrial {
      success
    }
  }
`;
