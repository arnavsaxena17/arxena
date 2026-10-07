import { Injectable } from '@nestjs/common';

import {
  BRIGHT_DATA_ESTIMATE_BUDGET_USD,
  BRIGHT_DATA_MAX_BUDGET_PER_QUERY_USD,
} from 'src/engine/core-modules/bright-data/ludicrous/constants/bright-data-ludicrous-pricing.const';
import {
  type BrightDataLudicrousEntity,
  type BrightDataLudicrousPlan,
  type BrightDataLudicrousRunResult,
} from 'src/engine/core-modules/bright-data/ludicrous/types/bright-data-ludicrous.types';
import {
  costForRecordsUsd,
  formatUsd,
} from 'src/engine/core-modules/bright-data/ludicrous/utils/bright-data-ludicrous-pricing.util';
import { BrightDataLudicrousExecutorService } from 'src/engine/core-modules/bright-data-ludicrous/services/bright-data-ludicrous-executor.service';
import { BrightDataLudicrousPlannerService } from 'src/engine/core-modules/bright-data-ludicrous/services/bright-data-ludicrous-planner.service';
import { BrightDataLudicrousPlanStoreService } from 'src/engine/core-modules/bright-data-ludicrous/services/bright-data-ludicrous-plan-store.service';

export type BrightDataLudicrousBudgetSummary = {
  planId: string;
  entity: BrightDataLudicrousEntity;
  intentSummary: string;
  shards: Array<{
    key: string;
    rationale: string;
    matched: number;
    coveragePercent: number;
    fetchableRecords: number;
    estimatedCostUsd: number;
    samplePrecision: number | null;
    error?: string;
  }>;
  totalFetchableRecords: number;
  estimatedUniqueRecords: number;
  estimatedAccurateRecords: number;
  estimatedCostUsd: number;
  estimateCostUsd: number;
  maxBudgetUsd: number;
  // What the user can buy at a few price points, so they pick a budget first
  budgetOptions: Array<{ records: number; costUsd: number }>;
  message: string;
};

const BUDGET_OPTION_RECORDS = [100, 250, 500, 1000, 2500, 5000];

export const summarizeBrightDataLudicrousPlan = (
  plan: BrightDataLudicrousPlan,
): BrightDataLudicrousBudgetSummary => {
  const cap = Math.round(
    BRIGHT_DATA_MAX_BUDGET_PER_QUERY_USD / costForRecordsUsd(1),
  );
  const options = BUDGET_OPTION_RECORDS.filter(
    (records) => records < plan.estimatedUniqueRecords && records <= cap,
  ).map((records) => ({ records, costUsd: costForRecordsUsd(records) }));

  options.push({
    records: Math.min(plan.estimatedUniqueRecords, cap),
    costUsd: costForRecordsUsd(Math.min(plan.estimatedUniqueRecords, cap)),
  });

  const accuracy =
    plan.estimatedUniqueRecords > 0
      ? Math.round(
          (plan.estimatedAccurateRecords / plan.estimatedUniqueRecords) * 100,
        )
      : 0;

  return {
    planId: plan.planId,
    entity: plan.entity,
    intentSummary: plan.intentSummary,
    shards: plan.estimates.map((estimate) => ({
      key: estimate.shardKey,
      rationale: estimate.rationale,
      matched: estimate.matched,
      coveragePercent: estimate.coveragePercent,
      fetchableRecords: estimate.fetchableRecords,
      estimatedCostUsd: estimate.estimatedCostUsd,
      samplePrecision: estimate.samplePrecision,
      error: estimate.error,
    })),
    totalFetchableRecords: plan.totalFetchableRecords,
    estimatedUniqueRecords: plan.estimatedUniqueRecords,
    estimatedAccurateRecords: plan.estimatedAccurateRecords,
    estimatedCostUsd: plan.totalEstimatedCostUsd,
    estimateCostUsd: plan.estimateCostUsd,
    maxBudgetUsd: BRIGHT_DATA_MAX_BUDGET_PER_QUERY_USD,
    budgetOptions: options,
    message: `About ${plan.estimatedUniqueRecords.toLocaleString()} unique records are reachable across ${plan.estimates.filter((e) => !e.error && e.fetchableRecords > 0).length} slices (~${accuracy}% expected accurate). Fetching all of them costs ${formatUsd(plan.totalEstimatedCostUsd)} at $0.002 per record; the estimate itself cost ${formatUsd(plan.estimateCostUsd)} (limit ${formatUsd(BRIGHT_DATA_ESTIMATE_BUDGET_USD)}). Per-query cap is ${formatUsd(BRIGHT_DATA_MAX_BUDGET_PER_QUERY_USD)}. ${accuracy < 50 ? 'Warning: sampled accuracy looks low, so consider refining the request before paying for the full fetch. ' : ''}Confirm a budget to fetch.`,
  };
};

@Injectable()
export class BrightDataLudicrousSearchService {
  constructor(
    private readonly planner: BrightDataLudicrousPlannerService,
    private readonly executor: BrightDataLudicrousExecutorService,
    private readonly planStore: BrightDataLudicrousPlanStoreService,
  ) {}

  async estimate(input: {
    workspaceId: string;
    entity: BrightDataLudicrousEntity;
    rawQuery: string;
    targetCount?: number;
    userWorkspaceId?: string | null;
  }): Promise<BrightDataLudicrousBudgetSummary> {
    const plan = await this.planner.createPlan(input);

    return summarizeBrightDataLudicrousPlan(plan);
  }

  async executePlan(input: {
    workspaceId: string;
    planId: string;
    maxBudgetUsd?: number;
    targetCount?: number;
    userWorkspaceId?: string | null;
    excludeBrightIds?: string[];
  }): Promise<BrightDataLudicrousRunResult> {
    const plan = await this.planStore.load(input.planId, input.workspaceId);

    return this.executor.execute({ ...input, plan });
  }

  // Non-interactive path for workflows, org chart and legacy callers: plan,
  // then fetch inside maxBudgetUsd without a confirmation step.
  async searchNaturalLanguage(input: {
    workspaceId: string;
    entity: BrightDataLudicrousEntity;
    rawQuery: string;
    maxBudgetUsd?: number;
    targetCount?: number;
    userWorkspaceId?: string | null;
  }): Promise<{
    summary: BrightDataLudicrousBudgetSummary;
    result: BrightDataLudicrousRunResult;
  }> {
    const plan = await this.planner.createPlan(input);
    const result = await this.executor.execute({ ...input, plan });

    return { summary: summarizeBrightDataLudicrousPlan(plan), result };
  }
}
