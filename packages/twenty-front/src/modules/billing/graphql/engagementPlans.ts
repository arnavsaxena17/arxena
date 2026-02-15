import { gql } from '@apollo/client';

export const ENGAGEMENT_PLANS = gql`
  query EngagementPlans {
    engagementPlans {
      intervalKey
      name
      amountSubunits
      currency
      planId
    }
  }
`;
