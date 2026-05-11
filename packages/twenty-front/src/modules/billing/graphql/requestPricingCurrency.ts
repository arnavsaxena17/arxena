import { gql } from '@apollo/client';

export const REQUEST_PRICING_CURRENCY = gql`
  query RequestPricingCurrency {
    requestPricingCurrency
  }
`;
