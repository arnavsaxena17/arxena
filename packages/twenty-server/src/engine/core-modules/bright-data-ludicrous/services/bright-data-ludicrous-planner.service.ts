import { Injectable, Logger, Optional } from '@nestjs/common';

import { randomUUID } from 'crypto';

import { type LanguageModel } from 'ai';
import { isDefined } from 'twenty-shared/utils';

import { BrightDataBusinessSearchService } from 'src/engine/core-modules/bright-data/services/bright-data-business-search.service';
import {
  BRIGHT_DATA_ESTIMATE_BUDGET_USD,
  BRIGHT_DATA_ESTIMATE_SAMPLE_SIZE,
  BRIGHT_DATA_LUDICROUS_MAX_SHARDS,
  BRIGHT_DATA_LUDICROUS_SHARD_CONCURRENCY,
} from 'src/engine/core-modules/bright-data/ludicrous/constants/bright-data-ludicrous-pricing.const';
import { BRIGHT_DATA_LUDICROUS_DEFAULT_VIEW_FIELDS } from 'src/engine/core-modules/bright-data/ludicrous/constants/bright-data-ludicrous-field-registry.const';
import {
  brightDataLudicrousPlanLlmSchema,
  type BrightDataLudicrousPlanLlmOutput,
} from 'src/engine/core-modules/bright-data/ludicrous/schemas/bright-data-ludicrous-plan-llm.schema';
import {
  type BrightDataLudicrousEntity,
  type BrightDataLudicrousPlan,
  type BrightDataLudicrousRubric,
  type BrightDataLudicrousSampleDocument,
  type BrightDataLudicrousShard,
  type BrightDataLudicrousShardEstimate,
} from 'src/engine/core-modules/bright-data/ludicrous/types/bright-data-ludicrous.types';
import {
  costForRecordsUsd,
  fetchableRecordsForMatched,
  recordsAffordableForBudget,
  roundUsd,
} from 'src/engine/core-modules/bright-data/ludicrous/utils/bright-data-ludicrous-pricing.util';
import { compileShardFilter } from 'src/engine/core-modules/bright-data/ludicrous/utils/bright-data-ludicrous-shard-compiler.util';
import { BrightDataBillingService } from 'src/engine/core-modules/bright-data-ludicrous/services/bright-data-billing.service';
import { BrightDataLudicrousPlanStoreService } from 'src/engine/core-modules/bright-data-ludicrous/services/bright-data-ludicrous-plan-store.service';
import { BrightDataLudicrousRelevanceJudgeService } from 'src/engine/core-modules/bright-data-ludicrous/services/bright-data-ludicrous-relevance-judge.service';
import {
  BRIGHT_DATA_LUDICROUS_PLANNER_SYSTEM_PROMPT,
  buildBrightDataLudicrousPlannerPrompt,
} from 'src/engine/core-modules/bright-data-ludicrous/prompts/bright-data-ludicrous-planner.prompt';
import { AI_TELEMETRY_CONFIG } from 'src/engine/metadata-modules/ai/ai-models/constants/ai-telemetry.const';
import {
  AiSdkExecutionService,
  runGenerateObject,
} from 'src/engine/metadata-modules/ai/ai-billing/services/ai-sdk-execution.service';
import { AiModelRegistryService } from 'src/engine/metadata-modules/ai/ai-models/services/ai-model-registry.service';

const PLANNER_MAX_OUTPUT_TOKENS = 3_000;

export type BrightDataLudicrousEstimateInput = {
  workspaceId: string;
  entity: BrightDataLudicrousEntity;
  rawQuery: string;
  targetCount?: number;
  modelId?: string;
  userWorkspaceId?: string | null;
};

const toRubric = (
  rubric: BrightDataLudicrousPlanLlmOutput['rubric'],
): BrightDataLudicrousRubric => ({
  ...rubric,
  countryCodes: rubric.countryCodes.map((code) => code.toUpperCase()),
  companySizeFromBuckets: rubric.companySizeFromBuckets.map(Number),
});

@Injectable()
export class BrightDataLudicrousPlannerService {
  private readonly logger = new Logger(BrightDataLudicrousPlannerService.name);

  constructor(
    private readonly brightDataBusinessSearchService: BrightDataBusinessSearchService,
    private readonly planStore: BrightDataLudicrousPlanStoreService,
    private readonly relevanceJudge: BrightDataLudicrousRelevanceJudgeService,
    private readonly billing: BrightDataBillingService,
    @Optional()
    private readonly aiModelRegistryService?: AiModelRegistryService,
    @Optional()
    private readonly aiSdkExecutionService?: AiSdkExecutionService,
  ) {}

  // Generates shards, compiles them, then spends a few cents sampling each one
  // so the user sees real match counts, costs and precision before paying more.
  async createPlan(
    input: BrightDataLudicrousEstimateInput,
  ): Promise<BrightDataLudicrousPlan> {
    await this.billing.validateCreditsOrThrow(input.workspaceId);

    const generated = await this.generateShards(input);
    const { shards, compileErrors } = this.compileShards(
      input.entity,
      generated,
    );

    if (shards.length === 0) {
      throw new Error(
        `The planner produced no valid shards${compileErrors.length ? `: ${compileErrors.join('; ')}` : ''}`,
      );
    }

    const fields = BRIGHT_DATA_LUDICROUS_DEFAULT_VIEW_FIELDS[input.entity];
    const rubric = toRubric(generated.rubric);
    const planId = randomUUID();
    const { estimates, sampleDocuments, estimateCostUsd } =
      await this.probeShards({
        input,
        planId,
        shards,
        fields,
        generated,
        rubric,
      });

    const live = estimates.filter((estimate) => !estimate.error);
    const totalFetchableRecords = live.reduce(
      (sum, estimate) => sum + estimate.fetchableRecords,
      0,
    );
    const sampleIds = Object.values(sampleDocuments).flat();
    const overlapRatio =
      sampleIds.length > 0
        ? 1 -
          new Set(sampleIds.map((doc) => doc.brightId)).size / sampleIds.length
        : 0;
    const estimatedUniqueRecords = Math.round(
      totalFetchableRecords * (1 - overlapRatio),
    );
    const estimatedAccurateRecords = Math.round(
      live.reduce(
        (sum, estimate) =>
          sum + estimate.fetchableRecords * (estimate.samplePrecision ?? 0.7),
        0,
      ) *
        (1 - overlapRatio),
    );

    const plan: BrightDataLudicrousPlan = {
      planId,
      workspaceId: input.workspaceId,
      entity: input.entity,
      rawQuery: input.rawQuery,
      intentSummary: generated.intentSummary,
      relevanceCriteria: generated.relevanceCriteria,
      needsSemanticCheck: generated.needsSemanticCheck,
      rubric,
      shards,
      estimates,
      sampleDocuments,
      fields,
      totalFetchableRecords,
      estimatedUniqueRecords,
      estimatedAccurateRecords,
      totalEstimatedCostUsd: costForRecordsUsd(estimatedUniqueRecords),
      estimateCostUsd,
      createdAt: new Date().toISOString(),
    };

    await this.planStore.save(plan);

    return plan;
  }

  private async resolveModel(input: {
    workspaceId: string;
    modelId?: string;
  }): Promise<{ modelId: string; model: LanguageModel }> {
    if (!isDefined(this.aiModelRegistryService)) {
      throw new Error('No AI model registry is available for query planning');
    }

    const modelId =
      input.modelId ??
      this.aiModelRegistryService.getDefaultSpeedModel().modelId;

    return this.aiModelRegistryService.resolveModelForAgentInWorkspace(
      { modelId },
      input.workspaceId,
    );
  }

  private async generateShards(
    input: BrightDataLudicrousEstimateInput,
  ): Promise<BrightDataLudicrousPlanLlmOutput> {
    const { modelId, model } = await this.resolveModel(input);
    const result = await runGenerateObject(this.aiSdkExecutionService, {
      workspaceId: input.workspaceId,
      modelId,
      options: {
        model,
        schema: brightDataLudicrousPlanLlmSchema,
        system: BRIGHT_DATA_LUDICROUS_PLANNER_SYSTEM_PROMPT,
        prompt: buildBrightDataLudicrousPlannerPrompt({
          entity: input.entity,
          rawQuery: input.rawQuery,
          targetCount: input.targetCount,
        }),
        maxOutputTokens: PLANNER_MAX_OUTPUT_TOKENS,
        experimental_telemetry: AI_TELEMETRY_CONFIG,
      },
    });

    return brightDataLudicrousPlanLlmSchema.parse(result.object);
  }

  private compileShards(
    entity: BrightDataLudicrousEntity,
    generated: BrightDataLudicrousPlanLlmOutput,
  ): { shards: BrightDataLudicrousShard[]; compileErrors: string[] } {
    const compileErrors: string[] = [];
    const shards: BrightDataLudicrousShard[] = [];
    const seenQueries = new Set<string>();

    for (const shard of [...generated.shards].sort(
      (a, b) => a.priority - b.priority,
    )) {
      try {
        const { query } = compileShardFilter({ entity, filter: shard.filter });
        const fingerprint = JSON.stringify(query);

        // Identical compiled queries would be bought twice for the same rows
        if (seenQueries.has(fingerprint)) {
          continue;
        }

        seenQueries.add(fingerprint);
        shards.push({
          key: shard.key,
          rationale: shard.rationale,
          priority: shard.priority,
          query,
        });
      } catch (error) {
        compileErrors.push(
          `${shard.key}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return {
      shards: shards.slice(0, BRIGHT_DATA_LUDICROUS_MAX_SHARDS),
      compileErrors,
    };
  }

  private async probeShards({
    input,
    planId,
    shards,
    fields,
    generated,
    rubric,
  }: {
    input: BrightDataLudicrousEstimateInput;
    planId: string;
    shards: BrightDataLudicrousShard[];
    fields: string[];
    generated: BrightDataLudicrousPlanLlmOutput;
    rubric: BrightDataLudicrousRubric;
  }): Promise<{
    estimates: BrightDataLudicrousShardEstimate[];
    sampleDocuments: Record<string, BrightDataLudicrousSampleDocument[]>;
    estimateCostUsd: number;
  }> {
    const sampleDocuments: Record<string, BrightDataLudicrousSampleDocument[]> =
      {};
    const estimates: BrightDataLudicrousShardEstimate[] = [];
    let spentRecords = 0;
    const affordable = recordsAffordableForBudget(
      BRIGHT_DATA_ESTIMATE_BUDGET_USD,
    );

    for (
      let start = 0;
      start < shards.length;
      start += BRIGHT_DATA_LUDICROUS_SHARD_CONCURRENCY
    ) {
      const batch = shards.slice(
        start,
        start + BRIGHT_DATA_LUDICROUS_SHARD_CONCURRENCY,
      );
      const sampleSize = Math.max(
        1,
        Math.min(
          BRIGHT_DATA_ESTIMATE_SAMPLE_SIZE,
          Math.floor((affordable - spentRecords) / batch.length),
        ),
      );

      if (affordable - spentRecords < batch.length) {
        break;
      }

      const results = await Promise.all(
        batch.map(async (shard) => {
          try {
            const page = await this.brightDataBusinessSearchService.searchPage({
              entity: input.entity,
              query: shard.query,
              offset: 0,
              limit: sampleSize,
              fields,
            });

            await this.billing.billRecords({
              workspaceId: input.workspaceId,
              recordCount: page.documents.length,
              entity: input.entity,
              planId,
              userWorkspaceId: input.userWorkspaceId,
            });

            const judgement = await this.relevanceJudge.judge({
              entity: input.entity,
              documents: page.documents,
              relevanceCriteria: generated.relevanceCriteria,
              rubric,
            });

            return { shard, page, judgement };
          } catch (error) {
            return {
              shard,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        }),
      );

      for (const result of results) {
        if ('error' in result) {
          this.logger.warn(
            `Shard ${result.shard.key} probe failed: ${result.error}`,
          );
          estimates.push({
            shardKey: result.shard.key,
            rationale: result.shard.rationale,
            priority: result.shard.priority,
            matched: 0,
            coveragePercent: 0,
            fetchableRecords: 0,
            estimatedCostUsd: 0,
            sampleSize: 0,
            samplePrecision: null,
            error: result.error,
          });
          continue;
        }

        spentRecords += result.page.documents.length;
        sampleDocuments[result.shard.key] = result.page.documents;

        // Zero-match shards are kept in the report but never fetched
        const fetchable = fetchableRecordsForMatched(result.page.matched);

        estimates.push({
          shardKey: result.shard.key,
          rationale: result.shard.rationale,
          priority: result.shard.priority,
          matched: result.page.matched,
          coveragePercent: result.page.coveragePercent,
          fetchableRecords: fetchable,
          estimatedCostUsd: costForRecordsUsd(fetchable),
          sampleSize: result.page.documents.length,
          samplePrecision: result.judgement.precision,
        });
      }
    }

    return {
      estimates,
      sampleDocuments,
      estimateCostUsd: roundUsd(costForRecordsUsd(spentRecords)),
    };
  }
}
