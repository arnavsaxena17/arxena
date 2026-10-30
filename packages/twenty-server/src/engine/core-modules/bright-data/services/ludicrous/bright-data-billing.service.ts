import { Injectable, Logger } from '@nestjs/common';

import { BillingUsageService } from 'src/engine/core-modules/billing/services/billing-usage.service';
import { CreditsService } from 'src/engine/core-modules/billing/services/credits.service';
import {
  BRIGHT_DATA_BILLING_MARGIN_MULTIPLIER,
  BRIGHT_DATA_SERP_COST_PER_REQUEST_USD,
} from 'src/engine/core-modules/bright-data/ludicrous/constants/bright-data-ludicrous-pricing.const';
import { costForRecordsUsd } from 'src/engine/core-modules/bright-data/ludicrous/utils/bright-data-ludicrous-pricing.util';

@Injectable()
export class BrightDataBillingService {
  private readonly logger = new Logger(BrightDataBillingService.name);

  constructor(
    private readonly creditsService: CreditsService,
    private readonly billingUsageService: BillingUsageService,
  ) {}

  get serpCostPerRequestUsd(): number {
    const configured = Number(process.env.BRIGHT_DATA_SERP_COST_USD);

    return Number.isFinite(configured) && configured > 0
      ? configured
      : BRIGHT_DATA_SERP_COST_PER_REQUEST_USD;
  }

  async validateCreditsOrThrow(workspaceId: string): Promise<void> {
    await this.billingUsageService.hasAvailableCreditsOrThrow(workspaceId);
  }

  // Charges the workspace for records Bright Data actually returned. Called
  // once per fetched page so spend is recorded even if a later page fails.
  async billRecords({
    workspaceId,
    recordCount,
    entity,
    projectId,
    userWorkspaceId,
  }: {
    workspaceId: string;
    recordCount: number;
    entity: 'company' | 'people';
    projectId?: string;
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
      resourceId: projectId ?? null,
      resourceContext: `bright_data_${entity}`,
      metadata: { entity, projectId, chargedUsd },
    });

    this.logger.log(
      `Billed ${recordCount} Bright Data ${entity} record(s) = $${chargedUsd.toFixed(3)} workspace=${workspaceId} project=${projectId ?? '-'}`,
    );

    return { chargedUsd };
  }

  // Fast SERP / Google News: one charge per successful request ($1.50/1K PAYG).
  async billSerpRequest({
    workspaceId,
    resourceContext,
    resourceId,
    userWorkspaceId,
    requestCount = 1,
  }: {
    workspaceId: string;
    resourceContext: string;
    resourceId?: string | null;
    userWorkspaceId?: string | null;
    requestCount?: number;
  }): Promise<{ chargedUsd: number }> {
    if (requestCount <= 0) {
      return { chargedUsd: 0 };
    }

    await this.creditsService.assertCanSpend({
      workspaceId,
      feature: 'BRIGHT_DATA_SEARCH',
    });

    const providerCostUsd = this.serpCostPerRequestUsd * requestCount;
    const chargedUsd = providerCostUsd * BRIGHT_DATA_BILLING_MARGIN_MULTIPLIER;

    await this.creditsService.record({
      workspaceId,
      feature: 'BRIGHT_DATA_SEARCH',
      quantity: requestCount,
      providerCostUsd,
      userWorkspaceId: userWorkspaceId ?? null,
      resourceId: resourceId ?? null,
      resourceContext,
      metadata: { chargedUsd, requestCount },
    });

    this.logger.log(
      `Billed ${requestCount} Bright Data SERP request(s) = $${chargedUsd.toFixed(4)} workspace=${workspaceId} context=${resourceContext}`,
    );

    return { chargedUsd };
  }
}
