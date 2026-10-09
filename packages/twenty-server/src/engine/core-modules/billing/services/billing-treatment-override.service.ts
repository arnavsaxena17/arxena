/* @license Enterprise */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import {
  BILLING_FEATURE_POLICIES,
  type BillingFeature,
} from 'src/engine/core-modules/billing/constants/billing-feature-policy.constant';
import { type BillingTreatment } from 'src/engine/core-modules/billing/types/billing-treatment.type';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';

const BILLING_TREATMENTS: BillingTreatment[] = [
  'CUSTOMER',
  'SYSTEM',
  'INTERNAL',
  'OFF',
];

// Overrides change rarely and are read on every billable call, so each process
// keeps them for a short time. A change made through setOverride is visible to
// other processes after at most this long.
const OVERRIDE_CACHE_TTL_MS = 60_000;

type OverrideMap = Partial<Record<BillingFeature, BillingTreatment>>;

export const isBillingFeature = (value: string): value is BillingFeature =>
  Object.prototype.hasOwnProperty.call(BILLING_FEATURE_POLICIES, value);

export const isBillingTreatment = (value: string): value is BillingTreatment =>
  BILLING_TREATMENTS.includes(value as BillingTreatment);

// Keeps only entries whose feature and treatment are both known, so a bad
// stored value can never change how a charge is handled.
export const sanitizeBillingTreatmentOverrides = (
  raw: Record<string, string> | null | undefined,
): OverrideMap => {
  const overrides: OverrideMap = {};

  Object.entries(raw ?? {}).forEach(([feature, treatment]) => {
    if (isBillingFeature(feature) && isBillingTreatment(treatment)) {
      overrides[feature] = treatment;
    }
  });

  return overrides;
};

@Injectable()
export class BillingTreatmentOverrideService {
  private readonly logger = new Logger(BillingTreatmentOverrideService.name);
  private readonly cache = new Map<
    string,
    { expiresAt: number; overrides: OverrideMap }
  >();

  constructor(
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
  ) {}

  async resolveTreatment(
    workspaceId: string,
    feature: BillingFeature,
  ): Promise<BillingTreatment> {
    const overrides = await this.getOverrides(workspaceId);

    return overrides[feature] ?? BILLING_FEATURE_POLICIES[feature].treatment;
  }

  async getOverrides(workspaceId: string): Promise<OverrideMap> {
    const cached = this.cache.get(workspaceId);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.overrides;
    }

    try {
      const workspace = await this.workspaceRepository.findOne({
        where: { id: workspaceId },
        select: { id: true, billingTreatmentOverrides: true },
      });
      const overrides = sanitizeBillingTreatmentOverrides(
        workspace?.billingTreatmentOverrides,
      );

      this.cache.set(workspaceId, {
        overrides,
        expiresAt: Date.now() + OVERRIDE_CACHE_TTL_MS,
      });

      return overrides;
    } catch (error) {
      // A failed lookup must not block billing; fall back to the defaults
      this.logger.error(
        `Could not read billing treatment overrides for workspace ${workspaceId}`,
        error,
      );

      return {};
    }
  }

  // Pass null to remove the override and return the feature to its default
  async setOverride({
    workspaceId,
    feature,
    treatment,
    actor,
  }: {
    workspaceId: string;
    feature: BillingFeature;
    treatment: BillingTreatment | null;
    actor: string;
  }): Promise<OverrideMap> {
    const current = await this.getOverrides(workspaceId);
    const next: OverrideMap = { ...current };

    if (treatment === null) {
      delete next[feature];
    } else {
      next[feature] = treatment;
    }

    await this.workspaceRepository.update(
      { id: workspaceId },
      { billingTreatmentOverrides: next },
    );

    this.cache.set(workspaceId, {
      overrides: next,
      expiresAt: Date.now() + OVERRIDE_CACHE_TTL_MS,
    });

    this.logger.warn(
      `Billing treatment override for ${feature} on workspace ${workspaceId} set to ${treatment ?? 'default'} by ${actor} (was ${current[feature] ?? 'default'})`,
    );

    return next;
  }
}
