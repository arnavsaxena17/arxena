// Local/dev seeds and non-Stripe providers store placeholder ids in
// stripeSubscriptionId (e.g. sub_local_*, sub_default0). Those must not be
// sent to the Stripe API.
export const isSyntheticStripeSubscriptionId = (
  stripeSubscriptionId: string,
): boolean =>
  stripeSubscriptionId.startsWith('sub_local_') ||
  stripeSubscriptionId.startsWith('sub_default') ||
  stripeSubscriptionId.startsWith('razorpay_');
