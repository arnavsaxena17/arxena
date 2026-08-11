import { BillingSubscriptionService } from 'src/engine/core-modules/billing/services/billing-subscription.service';
import { SubscriptionStatus } from 'src/engine/core-modules/billing/enums/billing-subscription-status.enum';
import { type StripeSubscriptionService } from 'src/engine/core-modules/billing/stripe/services/stripe-subscription.service';

describe('BillingSubscriptionService', () => {
  const createService = () => {
    const stripeSubscriptionService = {
      cancelSubscription: jest.fn(),
    } as unknown as jest.Mocked<StripeSubscriptionService>;

    const billingSubscriptionRepository = {
      update: jest.fn(),
    };

    const workspaceCacheService = {
      invalidateAndRecompute: jest.fn(),
    };

    const service = new BillingSubscriptionService(
      {} as never,
      {} as never,
      stripeSubscriptionService,
      {} as never,
      {} as never,
      {} as never,
      billingSubscriptionRepository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      billingSubscriptionRepository as never,
      {} as never,
      workspaceCacheService as never,
      {} as never,
    );

    return {
      service,
      stripeSubscriptionService,
      billingSubscriptionRepository,
      workspaceCacheService,
    };
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should skip Stripe cancellation and mark local canceled when there is no Stripe id', async () => {
    const {
      service,
      stripeSubscriptionService,
      billingSubscriptionRepository,
      workspaceCacheService,
    } = createService();

    jest.spyOn(service, 'getCurrentBillingSubscription').mockResolvedValue({
      id: 'billing-sub-id',
      stripeSubscriptionId: null,
    } as never);

    await service.cancelSubscription('workspace-id');

    expect(
      stripeSubscriptionService.cancelSubscription,
    ).not.toHaveBeenCalled();
    expect(billingSubscriptionRepository.update).toHaveBeenCalledWith(
      'workspace-id',
      { id: 'billing-sub-id' },
      expect.objectContaining({
        status: SubscriptionStatus.Canceled,
      }),
    );
    expect(workspaceCacheService.invalidateAndRecompute).toHaveBeenCalledWith(
      'workspace-id',
      ['currentBillingSubscription'],
    );
  });

  it('should skip Stripe cancellation for synthetic local subscription ids', async () => {
    const {
      service,
      stripeSubscriptionService,
      billingSubscriptionRepository,
    } = createService();

    jest.spyOn(service, 'getCurrentBillingSubscription').mockResolvedValue({
      id: 'billing-sub-id',
      stripeSubscriptionId: 'sub_local_635976bf148342598a3beed5cd4e87f1',
    } as never);

    await service.cancelSubscription('workspace-id');

    expect(
      stripeSubscriptionService.cancelSubscription,
    ).not.toHaveBeenCalled();
    expect(billingSubscriptionRepository.update).toHaveBeenCalledWith(
      'workspace-id',
      { id: 'billing-sub-id' },
      expect.objectContaining({
        status: SubscriptionStatus.Canceled,
      }),
    );
  });

  it('should cancel the Stripe subscription when the Stripe id exists', async () => {
    const {
      service,
      stripeSubscriptionService,
      billingSubscriptionRepository,
    } = createService();

    jest.spyOn(service, 'getCurrentBillingSubscription').mockResolvedValue({
      id: 'billing-sub-id',
      stripeSubscriptionId: 'sub_123',
    } as never);

    await service.cancelSubscription('workspace-id');

    expect(stripeSubscriptionService.cancelSubscription).toHaveBeenCalledWith(
      'sub_123',
    );
    expect(billingSubscriptionRepository.update).toHaveBeenCalledWith(
      'workspace-id',
      { id: 'billing-sub-id' },
      expect.objectContaining({
        status: SubscriptionStatus.Canceled,
      }),
    );
  });

  it('should mark local subscription canceled when Stripe reports resource_missing', async () => {
    const {
      service,
      stripeSubscriptionService,
      billingSubscriptionRepository,
    } = createService();

    jest.spyOn(service, 'getCurrentBillingSubscription').mockResolvedValue({
      id: 'billing-sub-id',
      stripeSubscriptionId: 'sub_missing',
    } as never);

    stripeSubscriptionService.cancelSubscription.mockRejectedValue({
      type: 'StripeInvalidRequestError',
      code: 'resource_missing',
    });

    await service.cancelSubscription('workspace-id');

    expect(billingSubscriptionRepository.update).toHaveBeenCalledWith(
      'workspace-id',
      { id: 'billing-sub-id' },
      expect.objectContaining({
        status: SubscriptionStatus.Canceled,
      }),
    );
  });
});
