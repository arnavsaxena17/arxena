import { gql } from '@apollo/client';

export const CHECKOUT_SESSION = gql`
  mutation CheckoutSession(
    $recurringInterval: SubscriptionInterval!
    $successUrlPath: String
    $plan: BillingPlanKey!
    $requirePaymentMethod: Boolean!
    $engagementInterval: String
  ) {
    checkoutSession(
      recurringInterval: $recurringInterval
      successUrlPath: $successUrlPath
      plan: $plan
      requirePaymentMethod: $requirePaymentMethod
      engagementInterval: $engagementInterval
    ) {
      url
    }
  }
`;
