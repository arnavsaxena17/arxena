import { Injectable } from '@nestjs/common';

import { BillingUsageService } from 'src/engine/core-modules/billing/services/billing-usage.service';
import { CreditsService } from 'src/engine/core-modules/billing/services/credits.service';
import { SES_EMAIL_COST_PER_THOUSAND_DOLLARS } from 'src/modules/emailing/constants/ses-email-cost-per-thousand-dollars';

@Injectable()
export class EmailBillingService {
  constructor(
    private readonly creditsService: CreditsService,
    private readonly billingUsageService: BillingUsageService,
  ) {}

  async hasEmailCredits(workspaceId: string): Promise<boolean> {
    return this.billingUsageService.hasAvailableCredits(workspaceId);
  }

  async validateEmailCreditsOrThrow(workspaceId: string): Promise<void> {
    await this.billingUsageService.hasAvailableCreditsOrThrow(workspaceId);
  }

  async billSentEmails({
    workspaceId,
    sentEmailCount,
    userWorkspaceId,
  }: {
    workspaceId: string;
    sentEmailCount: number;
    userWorkspaceId?: string | null;
  }): Promise<void> {
    if (sentEmailCount <= 0) {
      return;
    }

    await this.creditsService.record({
      workspaceId,
      feature: 'EMAIL_SEND',
      quantity: sentEmailCount,
      providerCostUsd:
        (sentEmailCount / 1000) * SES_EMAIL_COST_PER_THOUSAND_DOLLARS,
      userWorkspaceId: userWorkspaceId || null,
    });
  }
}
