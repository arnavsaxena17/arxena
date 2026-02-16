import { gql } from '@apollo/client';

export const CHECKOUT_SESSION = gql`
  mutation CheckoutSession(
    $recurringInterval: SubscriptionInterval!
    $successUrlPath: String
    $successReturnUrl: String
    $plan: BillingPlanKey!
    $requirePaymentMethod: Boolean!
    $razorpayPlanId: String
    $quantity: Int
  ) {
    checkoutSession(
      recurringInterval: $recurringInterval
      successUrlPath: $successUrlPath
      successReturnUrl: $successReturnUrl
      plan: $plan
      requirePaymentMethod: $requirePaymentMethod
      razorpayPlanId: $razorpayPlanId
      quantity: $quantity
    ) {
      url
      razorpaySubscriptionId
      razorpayKeyId
      razorpayCallbackUrl
    }
  }
`;
