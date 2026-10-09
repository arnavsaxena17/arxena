/* @license Enterprise */

import { Injectable } from '@nestjs/common';

import {
  BILLING_FEATURE_POLICIES,
  type BillingFeature,
} from 'src/engine/core-modules/billing/constants/billing-feature-policy.constant';
import { NO_BILLING_SUBSCRIPTION } from 'src/engine/core-modules/billing/constants/no-billing-subscription.constant';
import { BillingTreatmentOverrideService } from 'src/engine/core-modules/billing/services/billing-treatment-override.service';
import { BillingUsageService } from 'src/engine/core-modules/billing/services/billing-usage.service';
import { BillingService } from 'src/engine/core-modules/billing/services/billing.service';
import { type BillingTreatment } from 'src/engine/core-modules/billing/types/billing-treatment.type';
import { USAGE_RECORDED } from 'src/engine/core-modules/usage/constants/usage-recorded.constant';
import { type UsageEvent } from 'src/engine/core-modules/usage/types/usage-event.type';
import { convertDollarsToBillingCredits } from 'src/engine/metadata-modules/ai/ai-billing/utils/convert-dollars-to-billing-credits.util';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { WorkspaceEventEmitter } from 'src/engine/workspace-event-emitter/workspace-event-emitter';

export type RecordCreditUsageInput = {
  workspaceId: string;
  feature: BillingFeature;
  quantity: number;
  // What the provider charges us. The customer price is this x the feature's margin.
  providerCostUsd: number;
  // Forces a treatment for this call, ahead of the workspace override and the feature default
  treatment?: BillingTreatment;
  userWorkspaceId?: string | null;
  resourceId?: string | null;
  resourceContext?: string | null;
  metadata?: Record<string, unknown>;
};

export type RecordCreditUsageResult = {
  recorded: boolean;
  chargedUsd: number;
  creditsUsedMicro: number;
};

// Single path for turning a cost into a credit charge: price it, deduct it
// from the workspace balance, and record it as a usage event.
@Injectable()
export class CreditsService {
  constructor(
    private readonly workspaceEventEmitter: WorkspaceEventEmitter,
    private readonly billingService: BillingService,
    private readonly billingUsageService: BillingUsageService,
    private readonly workspaceCacheService: WorkspaceCacheService,
    private readonly billingTreatmentOverrideService: BillingTreatmentOverrideService,
  ) {}

  // Hard stop: throws BILLING_CREDITS_EXHAUSTED when the workspace has no credits left
  async assertCanSpend({
    workspaceId,
    feature,
    treatment,
  }: {
    workspaceId: string;
    feature: BillingFeature;
    treatment?: BillingTreatment;
  }): Promise<void> {
    const resolvedTreatment =
      treatment ??
      (await this.billingTreatmentOverrideService.resolveTreatment(
        workspaceId,
        feature,
      ));

    if (resolvedTreatment !== 'CUSTOMER') {
      return;
    }

    await this.billingUsageService.hasAvailableCreditsOrThrow(workspaceId);
  }

  async record(
    input: RecordCreditUsageInput,
  ): Promise<RecordCreditUsageResult> {
    const policy = BILLING_FEATURE_POLICIES[input.feature];
    const treatment =
      input.treatment ??
      (await this.billingTreatmentOverrideService.resolveTreatment(
        input.workspaceId,
        input.feature,
      ));
    const chargedUsd = input.providerCostUsd * policy.marginMultiplier;
    const chargeableCreditsMicro = Math.round(
      convertDollarsToBillingCredits(chargedUsd),
    );

    if (treatment === 'OFF') {
      return { recorded: false, chargedUsd: 0, creditsUsedMicro: 0 };
    }

    // Non-customer usage is recorded at zero credits so that it never counts
    // against the balance, which is summed from these events.
    const creditsUsedMicro =
      treatment === 'CUSTOMER' ? chargeableCreditsMicro : 0;

    let periodStart: Date | undefined;

    if (this.billingService.isBillingEnabled()) {
      const { currentBillingSubscription } =
        await this.workspaceCacheService.getOrRecompute(input.workspaceId, [
          'currentBillingSubscription',
        ]);

      if (currentBillingSubscription !== NO_BILLING_SUBSCRIPTION) {
        periodStart = currentBillingSubscription.currentPeriodStart;

        if (creditsUsedMicro > 0) {
          await this.billingUsageService.decrementAvailableCreditsInCache({
            workspaceId: input.workspaceId,
            usedCredits: creditsUsedMicro,
          });
        }
      }
    }

    this.workspaceEventEmitter.emitCustomBatchEvent<UsageEvent>(
      USAGE_RECORDED,
      [
        {
          resourceType: policy.resourceType,
          operationType: policy.operationType,
          creditsUsedMicro,
          quantity: input.quantity,
          unit: policy.unit,
          userWorkspaceId: input.userWorkspaceId ?? null,
          resourceId: input.resourceId ?? null,
          resourceContext: input.resourceContext ?? null,
          periodStart,
          // Kept in metadata so the usageEvent table needs no extra columns
          metadata: {
            ...input.metadata,
            feature: input.feature,
            billingTreatment: treatment,
            providerCostMicro: Math.round(
              convertDollarsToBillingCredits(input.providerCostUsd),
            ),
          },
        },
      ],
      input.workspaceId,
    );

    return { recorded: true, chargedUsd, creditsUsedMicro };
  }
}
