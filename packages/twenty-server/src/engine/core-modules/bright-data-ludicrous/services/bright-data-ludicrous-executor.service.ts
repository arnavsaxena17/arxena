import { Injectable, Logger } from '@nestjs/common';

import { BrightDataBusinessSearchService } from 'src/engine/core-modules/bright-data/services/bright-data-business-search.service';
import {
  BRIGHT_DATA_CLEARLY_GOOD_SAMPLE_PRECISION,
  BRIGHT_DATA_JUDGE_SAMPLE_PER_PAGE,
  BRIGHT_DATA_LUDICROUS_MAX_OFFSET,
  BRIGHT_DATA_LUDICROUS_PAGE_SIZE,
  BRIGHT_DATA_MAX_BUDGET_PER_QUERY_USD,
  BRIGHT_DATA_MIN_JUDGED_ROWS_TO_STOP,
  BRIGHT_DATA_MIN_NEW_ROW_SHARE,
  BRIGHT_DATA_MIN_SHARD_SAMPLE_PRECISION,
  BRIGHT_DATA_MIN_PAGE_PRECISION,
  BRIGHT_DATA_MIN_ROWS_FOR_NOVELTY_STOP,
} from 'src/engine/core-modules/bright-data/ludicrous/constants/bright-data-ludicrous-pricing.const';
import {
  type BrightDataLudicrousPlan,
  type BrightDataLudicrousRunResult,
  type BrightDataLudicrousSampleDocument,
  type BrightDataLudicrousShardRunReport,
} from 'src/engine/core-modules/bright-data/ludicrous/types/bright-data-ludicrous.types';
import {
  costForRecordsUsd,
  recordsAffordableForBudget,
  roundUsd,
} from 'src/engine/core-modules/bright-data/ludicrous/utils/bright-data-ludicrous-pricing.util';
import { BrightDataBillingService } from 'src/engine/core-modules/bright-data-ludicrous/services/bright-data-billing.service';
import { BrightDataLudicrousRelevanceJudgeService } from 'src/engine/core-modules/bright-data-ludicrous/services/bright-data-ludicrous-relevance-judge.service';

export type BrightDataLudicrousExecuteInput = {
  plan: BrightDataLudicrousPlan;
  maxBudgetUsd?: number;
  targetCount?: number;
  userWorkspaceId?: string | null;
  // Rows the caller already holds, so they are neither bought nor returned twice
  excludeBrightIds?: string[];
};

// Fetches shard by shard in priority order. After every page it judges a small
// sample and stops the shard as soon as precision or novelty decays, so budget
// flows to the shards still producing accurate new rows.
@Injectable()
export class BrightDataLudicrousExecutorService {
  private readonly logger = new Logger(BrightDataLudicrousExecutorService.name);

  constructor(
    private readonly brightDataBusinessSearchService: BrightDataBusinessSearchService,
    private readonly relevanceJudge: BrightDataLudicrousRelevanceJudgeService,
    private readonly billing: BrightDataBillingService,
  ) {}

  async execute(
    input: BrightDataLudicrousExecuteInput,
  ): Promise<BrightDataLudicrousRunResult> {
    const { plan } = input;
    const budgetUsd = Math.min(
      input.maxBudgetUsd ?? BRIGHT_DATA_MAX_BUDGET_PER_QUERY_USD,
      BRIGHT_DATA_MAX_BUDGET_PER_QUERY_USD,
    );
    const seen = new Set<string>(input.excludeBrightIds ?? []);
    const kept: BrightDataLudicrousSampleDocument[] = [];
    const reports: BrightDataLudicrousShardRunReport[] = [];
    let spentRecords = 0;

    await this.billing.validateCreditsOrThrow(plan.workspaceId);

    const bestSamplePrecision = Math.max(
      0,
      ...plan.estimates.map((estimate) => estimate.samplePrecision ?? 0),
    );
    const runnable = plan.shards
      .map((shard) => ({
        shard,
        estimate: plan.estimates.find((entry) => entry.shardKey === shard.key),
      }))
      .filter(
        ({ estimate }) =>
          estimate !== undefined &&
          estimate.error === undefined &&
          estimate.fetchableRecords > 0 &&
          // Skip a shard whose paid sample was mostly wrong, but only when a
          // sibling shard looks clearly better. If every shard scores low the
          // judge is as likely wrong as the queries, so nothing is dropped.
          !(
            estimate.samplePrecision !== null &&
            estimate.sampleSize >= BRIGHT_DATA_MIN_JUDGED_ROWS_TO_STOP &&
            estimate.samplePrecision < BRIGHT_DATA_MIN_SHARD_SAMPLE_PRECISION &&
            bestSamplePrecision >= BRIGHT_DATA_CLEARLY_GOOD_SAMPLE_PRECISION
          ),
      )
      .sort((a, b) => a.shard.priority - b.shard.priority);

    for (const { shard, estimate } of runnable) {
      const report: BrightDataLudicrousShardRunReport = {
        shardKey: shard.key,
        fetched: 0,
        newRecords: 0,
        duplicates: 0,
        keptRecords: 0,
        costUsd: 0,
        pagePrecision: [],
        stoppedReason: 'exhausted',
      };

      reports.push(report);

      // Rows already bought during the estimate count as the first page
      const sampleRows = plan.sampleDocuments[shard.key] ?? [];
      let pendingFirstPage: BrightDataLudicrousSampleDocument[] | null =
        sampleRows.length > 0 ? sampleRows : null;
      let offset = sampleRows.length;
      const fetchable = estimate?.fetchableRecords ?? 0;
      // The judge only gets to drop rows or end a shard if it approved that
      // shard's estimate sample. A judge that never agreed is more likely
      // stricter than the data allows, so the structured query is trusted.
      const judgeIsReliable =
        // Title wording is always fuzzy. For companies the judge only filters
        // when the planner says the intent goes beyond the structured fields.
        (plan.entity === 'people' || plan.needsSemanticCheck) &&
        (estimate?.samplePrecision === null ||
          estimate?.samplePrecision === undefined ||
          estimate.samplePrecision >= BRIGHT_DATA_MIN_PAGE_PRECISION);

      try {
        while (offset < fetchable || pendingFirstPage !== null) {
          const reachedTarget =
            input.targetCount !== undefined && kept.length >= input.targetCount;

          if (reachedTarget) {
            report.stoppedReason = 'target_reached';
            break;
          }

          let page: BrightDataLudicrousSampleDocument[];
          const isEstimateSamplePage = pendingFirstPage !== null;

          if (pendingFirstPage !== null) {
            // Already paid for in the estimate: no new request, no new charge
            page = pendingFirstPage;
            pendingFirstPage = null;
          } else {
            const remainingRecords = recordsAffordableForBudget(
              budgetUsd - costForRecordsUsd(spentRecords),
            );
            const limit = Math.min(
              BRIGHT_DATA_LUDICROUS_PAGE_SIZE,
              fetchable - offset,
              remainingRecords,
            );

            if (limit <= 0 || offset > BRIGHT_DATA_LUDICROUS_MAX_OFFSET) {
              report.stoppedReason = limit <= 0 ? 'budget' : 'exhausted';
              break;
            }

            const response =
              await this.brightDataBusinessSearchService.searchPage({
                entity: plan.entity,
                query: shard.query,
                offset,
                limit,
                fields: plan.fields,
              });

            page = response.documents;
            offset += limit;
            spentRecords += page.length;
            report.costUsd = roundUsd(
              report.costUsd + costForRecordsUsd(page.length),
            );

            await this.billing.billRecords({
              workspaceId: plan.workspaceId,
              recordCount: page.length,
              entity: plan.entity,
              planId: plan.planId,
              userWorkspaceId: input.userWorkspaceId,
            });

            // A short page means the shard is exhausted
            if (page.length < limit) {
              offset = fetchable;
            }
          }

          report.fetched += page.length;

          const fresh = page.filter((document) => !seen.has(document.brightId));

          fresh.forEach((document) => seen.add(document.brightId));
          report.newRecords += fresh.length;
          report.duplicates += page.length - fresh.length;

          const newShare = page.length > 0 ? fresh.length / page.length : 0;

          if (!judgeIsReliable) {
            kept.push(...fresh);
            report.keptRecords += fresh.length;
            report.pagePrecision.push(null);

            if (
              !isEstimateSamplePage &&
              page.length >= BRIGHT_DATA_MIN_ROWS_FOR_NOVELTY_STOP &&
              newShare < BRIGHT_DATA_MIN_NEW_ROW_SHARE
            ) {
              report.stoppedReason = 'mostly_duplicates';
              break;
            }

            continue;
          }

          const sample = fresh.slice(0, BRIGHT_DATA_JUDGE_SAMPLE_PER_PAGE);
          const judgement = await this.relevanceJudge.judge({
            entity: plan.entity,
            documents: sample,
            relevanceCriteria: plan.relevanceCriteria,
            rubric: plan.rubric,
          });

          report.pagePrecision.push(judgement.precision);

          // Decay means a shard that was good got worse. A shard that was never
          // good points at the query or the judge, not at exhaustion.
          const wasGoodBefore = report.pagePrecision
            .slice(0, -1)
            .some(
              (precision) =>
                precision !== null &&
                precision >= BRIGHT_DATA_MIN_PAGE_PRECISION,
            );
          const pageDecayed =
            judgement.precision !== null &&
            judgement.verdicts.length >= BRIGHT_DATA_MIN_JUDGED_ROWS_TO_STOP &&
            judgement.precision < BRIGHT_DATA_MIN_PAGE_PRECISION &&
            (wasGoodBefore || !isEstimateSamplePage);
          const relevantById = new Map(
            judgement.verdicts.map((verdict) => [
              verdict.brightId,
              verdict.relevant,
            ]),
          );

          if (pageDecayed) {
            // The page is already paid for, so judge every row rather than
            // trusting the sample: keep what is relevant, then stop the shard.
            const rest = fresh.slice(sample.length);
            const restJudgement = await this.relevanceJudge.judge({
              entity: plan.entity,
              documents: rest,
              relevanceCriteria: plan.relevanceCriteria,
              rubric: plan.rubric,
            });

            restJudgement.verdicts.forEach((verdict) =>
              relevantById.set(verdict.brightId, verdict.relevant),
            );
          }

          // Unjudged rows ride on the sample's precision while the shard is
          // still above threshold; a rejected row is never returned.
          const accepted = fresh.filter((document) =>
            pageDecayed
              ? relevantById.get(document.brightId) === true
              : relevantById.get(document.brightId) !== false,
          );

          kept.push(...accepted);
          report.keptRecords += accepted.length;

          if (pageDecayed) {
            report.stoppedReason = 'low_precision';
            break;
          }

          // The estimate sample is too small to say a shard is exhausted of
          // new rows, so novelty only ends a shard on real fetched pages.
          if (
            !isEstimateSamplePage &&
            page.length >= BRIGHT_DATA_MIN_ROWS_FOR_NOVELTY_STOP &&
            newShare < BRIGHT_DATA_MIN_NEW_ROW_SHARE
          ) {
            report.stoppedReason = 'mostly_duplicates';
            break;
          }
        }
      } catch (error) {
        report.stoppedReason = 'error';
        report.error = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Shard ${shard.key} failed: ${report.error}`);
      }

      if (
        costForRecordsUsd(spentRecords) >= budgetUsd ||
        (input.targetCount !== undefined && kept.length >= input.targetCount)
      ) {
        break;
      }
    }

    const finalDocuments =
      input.targetCount !== undefined ? kept.slice(0, input.targetCount) : kept;

    return {
      planId: plan.planId,
      entity: plan.entity,
      documents: finalDocuments,
      spentUsd: roundUsd(
        costForRecordsUsd(spentRecords) + plan.estimateCostUsd,
      ),
      budgetUsd,
      shardReports: reports,
    };
  }
}
