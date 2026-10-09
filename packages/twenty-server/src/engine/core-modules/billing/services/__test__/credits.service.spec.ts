import { NO_BILLING_SUBSCRIPTION } from 'src/engine/core-modules/billing/constants/no-billing-subscription.constant';
import { type BillingTreatmentOverrideService } from 'src/engine/core-modules/billing/services/billing-treatment-override.service';
import { CreditsService } from 'src/engine/core-modules/billing/services/credits.service';
import { type BillingUsageService } from 'src/engine/core-modules/billing/services/billing-usage.service';
import { type BillingService } from 'src/engine/core-modules/billing/services/billing.service';
import { type BillingTreatment } from 'src/engine/core-modules/billing/types/billing-treatment.type';
import { UsageUnit } from 'src/engine/core-modules/usage/enums/usage-unit.enum';
import { USAGE_RECORDED } from 'src/engine/core-modules/usage/constants/usage-recorded.constant';
import { UsageOperationType } from 'src/engine/core-modules/usage/enums/usage-operation-type.enum';
import { UsageResourceType } from 'src/engine/core-modules/usage/enums/usage-resource-type.enum';
import { type WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { type WorkspaceEventEmitter } from 'src/engine/workspace-event-emitter/workspace-event-emitter';

const PERIOD_START = new Date('2026-10-01T00:00:00.000Z');

const BASE_INPUT = {
  workspaceId: 'ws-1',
  feature: 'BRIGHT_DATA_SEARCH' as const,
  quantity: 1,
  providerCostUsd: 5,
};

describe('CreditsService', () => {
  let service: CreditsService;
  let emitCustomBatchEvent: jest.Mock;
  let decrementAvailableCreditsInCache: jest.Mock;
  let hasAvailableCreditsOrThrow: jest.Mock;
  let isBillingEnabled: jest.Mock;
  let getOrRecompute: jest.Mock;
  let resolveTreatment: jest.Mock;

  beforeEach(() => {
    emitCustomBatchEvent = jest.fn();
    resolveTreatment = jest.fn().mockResolvedValue('CUSTOMER');
    decrementAvailableCreditsInCache = jest.fn().mockResolvedValue(1);
    hasAvailableCreditsOrThrow = jest.fn().mockResolvedValue(undefined);
    isBillingEnabled = jest.fn().mockReturnValue(true);
    getOrRecompute = jest.fn().mockResolvedValue({
      currentBillingSubscription: { currentPeriodStart: PERIOD_START },
    });

    service = new CreditsService(
      { emitCustomBatchEvent } as unknown as WorkspaceEventEmitter,
      { isBillingEnabled } as unknown as BillingService,
      {
        decrementAvailableCreditsInCache,
        hasAvailableCreditsOrThrow,
      } as unknown as BillingUsageService,
      { getOrRecompute } as unknown as WorkspaceCacheService,
      { resolveTreatment } as unknown as BillingTreatmentOverrideService,
    );
  });

  describe('record', () => {
    it('should deduct provider cost x the feature margin from the balance and emit a usage event', async () => {
      const result = await service.record({
        ...BASE_INPUT,
        feature: 'EMAIL_SEND',
      });

      expect(result).toEqual({
        recorded: true,
        chargedUsd: 15,
        creditsUsedMicro: 15_000_000,
      });
      expect(decrementAvailableCreditsInCache).toHaveBeenCalledWith({
        workspaceId: 'ws-1',
        usedCredits: 15_000_000,
      });
      expect(emitCustomBatchEvent).toHaveBeenCalledWith(
        USAGE_RECORDED,
        [
          expect.objectContaining({
            resourceType: UsageResourceType.EMAIL,
            operationType: UsageOperationType.EMAIL_SEND,
            unit: UsageUnit.INVOCATION,
            creditsUsedMicro: 15_000_000,
            periodStart: PERIOD_START,
            metadata: {
              feature: 'EMAIL_SEND',
              billingTreatment: 'CUSTOMER',
              providerCostMicro: 5_000_000,
            },
          }),
        ],
        'ws-1',
      );
    });

    it('should charge at cost for a feature with a 1.0 margin', async () => {
      const result = await service.record(BASE_INPUT);

      expect(result.creditsUsedMicro).toBe(5_000_000);
    });

    it.each<BillingTreatment>(['SYSTEM', 'INTERNAL'])(
      'should record %s usage at zero credits without touching the balance',
      async (treatment) => {
        const result = await service.record({ ...BASE_INPUT, treatment });

        expect(result.creditsUsedMicro).toBe(0);
        expect(decrementAvailableCreditsInCache).not.toHaveBeenCalled();
        expect(emitCustomBatchEvent).toHaveBeenCalledWith(
          USAGE_RECORDED,
          [
            expect.objectContaining({
              creditsUsedMicro: 0,
              metadata: expect.objectContaining({
                billingTreatment: treatment,
                providerCostMicro: 5_000_000,
              }),
            }),
          ],
          'ws-1',
        );
      },
    );

    it('should let a caller override the feature default treatment', async () => {
      const result = await service.record({
        ...BASE_INPUT,
        treatment: 'SYSTEM',
      });

      expect(result.creditsUsedMicro).toBe(0);
      expect(decrementAvailableCreditsInCache).not.toHaveBeenCalled();
    });

    it('should use the workspace override ahead of the feature default', async () => {
      resolveTreatment.mockResolvedValue('SYSTEM');

      const result = await service.record(BASE_INPUT);

      expect(resolveTreatment).toHaveBeenCalledWith(
        'ws-1',
        'BRIGHT_DATA_SEARCH',
      );
      expect(result.creditsUsedMicro).toBe(0);
      expect(decrementAvailableCreditsInCache).not.toHaveBeenCalled();
    });

    it('should let an explicit treatment beat the workspace override', async () => {
      resolveTreatment.mockResolvedValue('SYSTEM');

      const result = await service.record({
        ...BASE_INPUT,
        treatment: 'CUSTOMER',
      });

      expect(result.creditsUsedMicro).toBe(5_000_000);
    });

    it('should record nothing for OFF treatment', async () => {
      const result = await service.record({
        ...BASE_INPUT,
        treatment: 'OFF',
      });

      expect(result.recorded).toBe(false);
      expect(emitCustomBatchEvent).not.toHaveBeenCalled();
      expect(decrementAvailableCreditsInCache).not.toHaveBeenCalled();
    });

    it('should record without deducting when billing is disabled', async () => {
      isBillingEnabled.mockReturnValue(false);

      await service.record(BASE_INPUT);

      expect(decrementAvailableCreditsInCache).not.toHaveBeenCalled();
      expect(emitCustomBatchEvent).toHaveBeenCalledWith(
        USAGE_RECORDED,
        [
          expect.objectContaining({
            creditsUsedMicro: 5_000_000,
            periodStart: undefined,
          }),
        ],
        'ws-1',
      );
    });

    it('should record without deducting when the workspace has no subscription', async () => {
      getOrRecompute.mockResolvedValue({
        currentBillingSubscription: NO_BILLING_SUBSCRIPTION,
      });

      await service.record(BASE_INPUT);

      expect(decrementAvailableCreditsInCache).not.toHaveBeenCalled();
      expect(emitCustomBatchEvent).toHaveBeenCalledTimes(1);
    });

    it('should not deduct anything for a zero-cost customer event', async () => {
      await service.record({ ...BASE_INPUT, providerCostUsd: 0 });

      expect(decrementAvailableCreditsInCache).not.toHaveBeenCalled();
      expect(emitCustomBatchEvent).toHaveBeenCalledTimes(1);
    });

    it('should pass attribution and context through to the event', async () => {
      await service.record({
        ...BASE_INPUT,
        userWorkspaceId: 'uw-1',
        resourceId: 'res-1',
        resourceContext: 'ctx',
        metadata: { entity: 'people' },
      });

      expect(emitCustomBatchEvent).toHaveBeenCalledWith(
        USAGE_RECORDED,
        [
          expect.objectContaining({
            userWorkspaceId: 'uw-1',
            resourceId: 'res-1',
            resourceContext: 'ctx',
            metadata: expect.objectContaining({ entity: 'people' }),
          }),
        ],
        'ws-1',
      );
    });
  });

  describe('assertCanSpend', () => {
    it('should skip the credit check when the workspace override exempts the feature', async () => {
      resolveTreatment.mockResolvedValue('SYSTEM');

      await service.assertCanSpend({
        workspaceId: 'ws-1',
        feature: 'AI_CHAT',
      });

      expect(hasAvailableCreditsOrThrow).not.toHaveBeenCalled();
    });

    it('should throw through when the workspace has no credits left', async () => {
      hasAvailableCreditsOrThrow.mockRejectedValue(
        new Error('Credits exhausted'),
      );

      await expect(
        service.assertCanSpend({
          workspaceId: 'ws-1',
          feature: 'AI_CHAT',
        }),
      ).rejects.toThrow('Credits exhausted');
    });

    it.each<BillingTreatment>(['SYSTEM', 'INTERNAL', 'OFF'])(
      'should not check credits for %s treatment',
      async (treatment) => {
        await service.assertCanSpend({
          workspaceId: 'ws-1',
          feature: 'AI_CHAT',
          treatment,
        });

        expect(hasAvailableCreditsOrThrow).not.toHaveBeenCalled();
      },
    );
  });
});
