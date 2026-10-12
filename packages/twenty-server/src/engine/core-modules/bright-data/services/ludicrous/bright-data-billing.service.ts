import { Injectable, Logger } from '@nestjs/common';

import { BillingUsageService } from 'src/engine/core-modules/billing/services/billing-usage.service';
import { CreditsService } from 'src/engine/core-modules/billing/services/credits.service';
import { BRIGHT_DATA_BILLING_MARGIN_MULTIPLIER } from 'src/engine/core-modules/bright-data/ludicrous/constants/bright-data-ludicrous-pricing.const';
import { costForRecordsUsd } from 'src/engine/core-modules/bright-data/ludicrous/utils/bright-data-ludicrous-pricing.util';

@Injectable()
export class BrightDataBillingService {
  private readonly logger = new Logger(BrightDataBillingService.name);

  constructor(
    private readonly creditsService: CreditsService,
    private readonly billingUsageService: BillingUsageService,
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

    const providerCostUsd = costForRecordsUsd(recordCount);
    const chargedUsd = providerCostUsd * BRIGHT_DATA_BILLING_MARGIN_MULTIPLIER;

    await this.creditsService.record({
      workspaceId,
      feature: 'BRIGHT_DATA_SEARCH',
      quantity: recordCount,
      providerCostUsd,
      userWorkspaceId: userWorkspaceId ?? null,
      resourceId: planId ?? null,
      resourceContext: `bright_data_${entity}`,
      metadata: { entity, planId, chargedUsd },
    });

    this.logger.log(
      `Billed ${recordCount} Bright Data ${entity} record(s) = $${chargedUsd.toFixed(3)} workspace=${workspaceId} plan=${planId ?? '-'}`,
    );

    return { chargedUsd };
  }
}
