import { isSyntheticStripeSubscriptionId } from 'src/engine/core-modules/billing/utils/is-synthetic-stripe-subscription-id.util';

describe('isSyntheticStripeSubscriptionId', () => {
  it('should detect local seed subscription ids', () => {
    expect(
      isSyntheticStripeSubscriptionId(
        'sub_local_635976bf148342598a3beed5cd4e87f1',
      ),
    ).toBe(true);
  });

  it('should detect default seeder subscription ids', () => {
    expect(isSyntheticStripeSubscriptionId('sub_default0')).toBe(true);
  });

  it('should allow real Stripe subscription ids', () => {
    expect(isSyntheticStripeSubscriptionId('sub_1MowFRLkdIwHu7ix')).toBe(
      false,
    );
  });
});
