import { gql } from '@apollo/client';

export const ENGAGEMENT_PLANS = gql`
  query EngagementPlans {
    engagementPlans {
      id
      name
      amount
      currency
      period
      interval
    }
  }
`;
