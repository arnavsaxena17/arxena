import { Injectable, Logger } from '@nestjs/common';

import { NO_BILLING_SUBSCRIPTION } from 'src/engine/core-modules/billing/constants/no-billing-subscription.constant';
import { BillingUsageService } from 'src/engine/core-modules/billing/services/billing-usage.service';
import { BillingService } from 'src/engine/core-modules/billing/services/billing.service';
import { BRIGHT_DATA_BILLING_MARGIN_MULTIPLIER } from 'src/engine/core-modules/bright-data/ludicrous/constants/bright-data-ludicrous-pricing.const';
import { costForRecordsUsd } from 'src/engine/core-modules/bright-data/ludicrous/utils/bright-data-ludicrous-pricing.util';
import { USAGE_RECORDED } from 'src/engine/core-modules/usage/constants/usage-recorded.constant';
import { UsageOperationType } from 'src/engine/core-modules/usage/enums/usage-operation-type.enum';
import { UsageResourceType } from 'src/engine/core-modules/usage/enums/usage-resource-type.enum';
import { UsageUnit } from 'src/engine/core-modules/usage/enums/usage-unit.enum';
import { type UsageEvent } from 'src/engine/core-modules/usage/types/usage-event.type';
import { convertDollarsToBillingCredits } from 'src/engine/metadata-modules/ai/ai-billing/utils/convert-dollars-to-billing-credits.util';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { WorkspaceEventEmitter } from 'src/engine/workspace-event-emitter/workspace-event-emitter';

@Injectable()
export class BrightDataBillingService {
  private readonly logger = new Logger(BrightDataBillingService.name);

  constructor(
    private readonly workspaceEventEmitter: WorkspaceEventEmitter,
    private readonly billingService: BillingService,
    private readonly billingUsageService: BillingUsageService,
    private readonly workspaceCacheService: WorkspaceCacheService,
  ) {}

  async validateCreditsOrThrow(workspaceId: string): Promise<void> {
    await this.billingUsageService.hasAvailableCreditsOrThrow(workspaceId);
  }

  // Charges the workspace for records Bright Data actually returned. Called
  // once per fetched page so spend is recorded even if a later page fails.
  async billRecords({
    workspaceId,
    recordCount,
    entity,
    planId,
    userWorkspaceId,
  }: {
    workspaceId: string;
    recordCount: number;
    entity: 'company' | 'people';
    planId?: string;
    userWorkspaceId?: string | null;
  }): Promise<{ chargedUsd: number }> {
    if (recordCount <= 0) {
      return { chargedUsd: 0 };
    }

    const chargedUsd =
      costForRecordsUsd(recordCount) * BRIGHT_DATA_BILLING_MARGIN_MULTIPLIER;
    const creditsUsedMicro = Math.round(
      convertDollarsToBillingCredits(chargedUsd),
    );

    let periodStart: Date | undefined;

    if (this.billingService.isBillingEnabled()) {
      const { currentBillingSubscription } =
        await this.workspaceCacheService.getOrRecompute(workspaceId, [
          'currentBillingSubscription',
        ]);

      if (currentBillingSubscription !== NO_BILLING_SUBSCRIPTION) {
        periodStart = currentBillingSubscription.currentPeriodStart;

        await this.billingUsageService.decrementAvailableCreditsInCache({
          workspaceId,
          usedCredits: creditsUsedMicro,
        });
      }
    }

    this.workspaceEventEmitter.emitCustomBatchEvent<UsageEvent>(
      USAGE_RECORDED,
      [
        {
          resourceType: UsageResourceType.API,
          operationType: UsageOperationType.BRIGHT_DATA_SEARCH,
          creditsUsedMicro,
          quantity: recordCount,
          unit: UsageUnit.INVOCATION,
          resourceId: planId ?? null,
          resourceContext: `bright_data_${entity}`,
          userWorkspaceId: userWorkspaceId ?? null,
          periodStart,
          metadata: { entity, planId, chargedUsd },
        },
      ],
      workspaceId,
    );

    this.logger.log(
      `Billed ${recordCount} Bright Data ${entity} record(s) = $${chargedUsd.toFixed(3)} workspace=${workspaceId} plan=${planId ?? '-'}`,
    );

    return { chargedUsd };
  }
}
