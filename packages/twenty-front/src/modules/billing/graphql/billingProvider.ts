import { gql } from '@apollo/client';

export const BILLING_PROVIDER = gql`
  query BillingProvider {
    billingProvider {
      provider
    }
  }
`;
