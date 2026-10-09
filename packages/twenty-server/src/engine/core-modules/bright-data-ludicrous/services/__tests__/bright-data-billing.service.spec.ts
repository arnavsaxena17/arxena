import { NO_BILLING_SUBSCRIPTION } from 'src/engine/core-modules/billing/constants/no-billing-subscription.constant';
import { type BillingTreatmentOverrideService } from 'src/engine/core-modules/billing/services/billing-treatment-override.service';
import { CreditsService } from 'src/engine/core-modules/billing/services/credits.service';
import { type BillingUsageService } from 'src/engine/core-modules/billing/services/billing-usage.service';
import { type BillingService } from 'src/engine/core-modules/billing/services/billing.service';
import { BrightDataBillingService } from 'src/engine/core-modules/bright-data-ludicrous/services/bright-data-billing.service';
import { USAGE_RECORDED } from 'src/engine/core-modules/usage/constants/usage-recorded.constant';
import { UsageOperationType } from 'src/engine/core-modules/usage/enums/usage-operation-type.enum';
import { type WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { type WorkspaceEventEmitter } from 'src/engine/workspace-event-emitter/workspace-event-emitter';

const PERIOD_START = new Date('2026-10-01T00:00:00.000Z');

describe('BrightDataBillingService.billRecords', () => {
  let service: BrightDataBillingService;
  let emitCustomBatchEvent: jest.Mock;
  let decrementAvailableCreditsInCache: jest.Mock;
  let getOrRecompute: jest.Mock;

  beforeEach(() => {
    emitCustomBatchEvent = jest.fn();
    decrementAvailableCreditsInCache = jest.fn().mockResolvedValue(1);
    getOrRecompute = jest.fn().mockResolvedValue({
      currentBillingSubscription: { currentPeriodStart: PERIOD_START },
    });

    const billingUsageService = {
      decrementAvailableCreditsInCache,
    } as unknown as BillingUsageService;

    service = new BrightDataBillingService(
      new CreditsService(
        { emitCustomBatchEvent } as unknown as WorkspaceEventEmitter,
        { isBillingEnabled: () => true } as unknown as BillingService,
        billingUsageService,
        { getOrRecompute } as unknown as WorkspaceCacheService,
        {
          resolveTreatment: jest.fn().mockResolvedValue('CUSTOMER'),
        } as unknown as BillingTreatmentOverrideService,
      ),
      billingUsageService,
    );
  });

  it('should charge $0.002 per record, so 500 records is one million micro-credits', async () => {
    const { chargedUsd } = await service.billRecords({
      workspaceId: 'ws-1',
      recordCount: 500,
      entity: 'people',
    });

    expect(chargedUsd).toBeCloseTo(1, 6);
    expect(decrementAvailableCreditsInCache).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      usedCredits: 1_000_000,
    });
    expect(emitCustomBatchEvent).toHaveBeenCalledWith(
      USAGE_RECORDED,
      [
        expect.objectContaining({
          operationType: UsageOperationType.BRIGHT_DATA_SEARCH,
          creditsUsedMicro: 1_000_000,
          quantity: 500,
          resourceContext: 'bright_data_people',
          periodStart: PERIOD_START,
        }),
      ],
      'ws-1',
    );
  });

  it('should charge nothing and emit nothing for zero records', async () => {
    const { chargedUsd } = await service.billRecords({
      workspaceId: 'ws-1',
      recordCount: 0,
      entity: 'company',
    });

    expect(chargedUsd).toBe(0);
    expect(emitCustomBatchEvent).not.toHaveBeenCalled();
  });

  it('should record usage without decrementing when the workspace has no subscription', async () => {
    getOrRecompute.mockResolvedValue({
      currentBillingSubscription: NO_BILLING_SUBSCRIPTION,
    });

    await service.billRecords({
      workspaceId: 'ws-1',
      recordCount: 100,
      entity: 'company',
    });

    expect(decrementAvailableCreditsInCache).not.toHaveBeenCalled();
    expect(emitCustomBatchEvent).toHaveBeenCalledTimes(1);
  });
});
