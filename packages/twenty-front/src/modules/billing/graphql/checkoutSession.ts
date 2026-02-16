import { gql } from '@apollo/client';

export const CHECKOUT_SESSION = gql`
  mutation CheckoutSession(
    $recurringInterval: SubscriptionInterval!
    $successUrlPath: String
    $successReturnUrl: String
    $plan: BillingPlanKey!
    $requirePaymentMethod: Boolean!
    $razorpayPlanId: String
  ) {
    checkoutSession(
      recurringInterval: $recurringInterval
      successUrlPath: $successUrlPath
      successReturnUrl: $successReturnUrl
      plan: $plan
      requirePaymentMethod: $requirePaymentMethod
      razorpayPlanId: $razorpayPlanId
    ) {
      url
      razorpaySubscriptionId
      razorpayKeyId
      razorpayCallbackUrl
    }
  }
`;
