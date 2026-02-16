import { gql } from '@apollo/client';

export const CREDIT_PACKS = gql`
  query CreditPacks {
    creditPacks {
      key
      name
      credits
      amountSubunits
      currency
    }
  }
`;
