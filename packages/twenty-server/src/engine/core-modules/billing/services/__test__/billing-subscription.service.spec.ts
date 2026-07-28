import { BillingSubscriptionService } from 'src/engine/core-modules/billing/services/billing-subscription.service';
import { type StripeSubscriptionService } from 'src/engine/core-modules/billing/stripe/services/stripe-subscription.service';

describe('BillingSubscriptionService', () => {
  const createService = () => {
    const stripeSubscriptionService = {
      cancelSubscription: jest.fn(),
    } as unknown as jest.Mocked<StripeSubscriptionService>;

    const service = new BillingSubscriptionService(
      {} as never,
      {} as never,
      stripeSubscriptionService,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    return {
      service,
      stripeSubscriptionService,
    };
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should skip Stripe cancellation when the subscription has no Stripe id', async () => {
    const { service, stripeSubscriptionService } = createService();

    jest.spyOn(service, 'getCurrentBillingSubscription').mockResolvedValue({
      stripeSubscriptionId: null,
    } as never);

    await service.cancelSubscription('workspace-id');

    expect(
      stripeSubscriptionService.cancelSubscription,
    ).not.toHaveBeenCalled();
  });

  it('should cancel the Stripe subscription when the Stripe id exists', async () => {
    const { service, stripeSubscriptionService } = createService();

    jest.spyOn(service, 'getCurrentBillingSubscription').mockResolvedValue({
      stripeSubscriptionId: 'sub_123',
    } as never);

    await service.cancelSubscription('workspace-id');

    expect(stripeSubscriptionService.cancelSubscription).toHaveBeenCalledWith(
      'sub_123',
    );
  });
});
