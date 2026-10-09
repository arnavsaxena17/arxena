import { NO_BILLING_SUBSCRIPTION } from 'src/engine/core-modules/billing/constants/no-billing-subscription.constant';
import { type BillingTreatmentOverrideService } from 'src/engine/core-modules/billing/services/billing-treatment-override.service';
import { CreditsService } from 'src/engine/core-modules/billing/services/credits.service';
import { type BillingUsageService } from 'src/engine/core-modules/billing/services/billing-usage.service';
import { type BillingService } from 'src/engine/core-modules/billing/services/billing.service';
import { USAGE_RECORDED } from 'src/engine/core-modules/usage/constants/usage-recorded.constant';
import { UsageOperationType } from 'src/engine/core-modules/usage/enums/usage-operation-type.enum';
import { UsageResourceType } from 'src/engine/core-modules/usage/enums/usage-resource-type.enum';
import { type WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { type WorkspaceEventEmitter } from 'src/engine/workspace-event-emitter/workspace-event-emitter';
import { EmailBillingService } from 'src/modules/emailing/services/email-billing.service';

const PERIOD_START = new Date('2026-10-01T00:00:00.000Z');

describe('EmailBillingService.billSentEmails', () => {
  let service: EmailBillingService;
  let emitCustomBatchEvent: jest.Mock;
  let decrementAvailableCreditsInCache: jest.Mock;
  let isBillingEnabled: jest.Mock;
  let getOrRecompute: jest.Mock;

  beforeEach(() => {
    emitCustomBatchEvent = jest.fn();
    decrementAvailableCreditsInCache = jest.fn().mockResolvedValue(1);
    isBillingEnabled = jest.fn().mockReturnValue(true);
    getOrRecompute = jest.fn().mockResolvedValue({
      currentBillingSubscription: { currentPeriodStart: PERIOD_START },
    });

    const billingUsageService = {
      decrementAvailableCreditsInCache,
    } as unknown as BillingUsageService;

    service = new EmailBillingService(
      new CreditsService(
        { emitCustomBatchEvent } as unknown as WorkspaceEventEmitter,
        { isBillingEnabled } as unknown as BillingService,
        billingUsageService,
        { getOrRecompute } as unknown as WorkspaceCacheService,
        {
          resolveTreatment: jest.fn().mockResolvedValue('CUSTOMER'),
        } as unknown as BillingTreatmentOverrideService,
      ),
      billingUsageService,
    );
  });

  it('should charge 300,000 micro-credits per 1,000 emails ($0.10 SES cost x 3 margin)', async () => {
    await service.billSentEmails({ workspaceId: 'ws-1', sentEmailCount: 1000 });

    expect(decrementAvailableCreditsInCache).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      usedCredits: 300_000,
    });
    expect(emitCustomBatchEvent).toHaveBeenCalledWith(
      USAGE_RECORDED,
      [
        expect.objectContaining({
          resourceType: UsageResourceType.EMAIL,
          operationType: UsageOperationType.EMAIL_SEND,
          creditsUsedMicro: 300_000,
          quantity: 1000,
          periodStart: PERIOD_START,
        }),
      ],
      'ws-1',
    );
  });

  it('should do nothing when no emails were sent', async () => {
    await service.billSentEmails({ workspaceId: 'ws-1', sentEmailCount: 0 });

    expect(emitCustomBatchEvent).not.toHaveBeenCalled();
    expect(decrementAvailableCreditsInCache).not.toHaveBeenCalled();
  });

  it('should still record usage without decrementing when billing is disabled', async () => {
    isBillingEnabled.mockReturnValue(false);

    await service.billSentEmails({ workspaceId: 'ws-1', sentEmailCount: 1000 });

    expect(decrementAvailableCreditsInCache).not.toHaveBeenCalled();
    expect(emitCustomBatchEvent).toHaveBeenCalledWith(
      USAGE_RECORDED,
      [
        expect.objectContaining({
          creditsUsedMicro: 300_000,
          periodStart: undefined,
        }),
      ],
      'ws-1',
    );
  });

  it('should record usage without decrementing when the workspace has no subscription', async () => {
    getOrRecompute.mockResolvedValue({
      currentBillingSubscription: NO_BILLING_SUBSCRIPTION,
    });

    await service.billSentEmails({ workspaceId: 'ws-1', sentEmailCount: 1000 });

    expect(decrementAvailableCreditsInCache).not.toHaveBeenCalled();
    expect(emitCustomBatchEvent).toHaveBeenCalledTimes(1);
  });

  it('should attribute usage to the sending user workspace', async () => {
    await service.billSentEmails({
      workspaceId: 'ws-1',
      sentEmailCount: 10,
      userWorkspaceId: 'uw-1',
    });

    expect(emitCustomBatchEvent).toHaveBeenCalledWith(
      USAGE_RECORDED,
      [expect.objectContaining({ userWorkspaceId: 'uw-1' })],
      'ws-1',
    );
  });
});
