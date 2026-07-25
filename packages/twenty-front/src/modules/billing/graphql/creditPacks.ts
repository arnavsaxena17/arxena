import { gql } from '@apollo/client';

export const CREDIT_PACKS = gql`
  query CreditPacks {
    creditPacks {
      key
      name
      credits
      amountSubunits
      currency
      planId
      intent
      mapsCount
      mapType
      mapTypeLabel
      tagline
      inheritedFromPlanId
      ownFeatures
      includedEmailCredits
      includedPhoneCredits
      creditsDisplay
      pricesSubunitsJson
    }
  }
`;
