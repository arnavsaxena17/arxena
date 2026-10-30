import { Injectable, Logger, Optional } from '@nestjs/common';

import { randomUUID } from 'crypto';

import { isNonEmptyString } from '@sniptt/guards';
import { type LanguageModel } from 'ai';
import { isDefined } from 'twenty-shared/utils';

import { TitleExpansionService } from 'src/engine/core-modules/title-taxonomy/title-expansion.service';
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
  isToolIoLoggingEnabled,
  truncateForLog,
} from 'src/engine/core-modules/tool-provider/utils/format-tool-call-log.util';
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
import { BrightDataBillingService } from 'src/engine/core-modules/bright-data/services/ludicrous/bright-data-billing.service';
import { BrightDataLudicrousPlanStoreService } from 'src/engine/core-modules/bright-data/services/ludicrous/bright-data-ludicrous-plan-store.service';
import { BrightDataLudicrousRelevanceJudgeService } from 'src/engine/core-modules/bright-data/services/ludicrous/bright-data-ludicrous-relevance-judge.service';
import {
  buildBrightDataLudicrousPlannerPrompt,
  buildBrightDataLudicrousPlannerSystemPrompt,
} from 'src/engine/core-modules/bright-data/ludicrous/prompts/bright-data-ludicrous-planner.prompt';
import { AI_TELEMETRY_CONFIG } from 'src/engine/metadata-modules/ai/ai-models/constants/ai-telemetry.const';
import {
  AiSdkExecutionService,
  runGenerateObject,
} from 'src/engine/metadata-modules/ai/ai-billing/services/ai-sdk-execution.service';
import { AiModelRegistryService } from 'src/engine/metadata-modules/ai/ai-models/services/ai-model-registry.service';

const PLANNER_MAX_OUTPUT_TOKENS = 6_000;
const PLANNER_ATTEMPT_TIMEOUT_MS = 45_000;
const PLANNER_MAX_MODEL_ATTEMPTS = 3;
const TAXONOMY_MAX_TITLES_PER_SHARD = 12;

export type BrightDataLudicrousEstimateInput = {
  workspaceId: string;
  entity: BrightDataLudicrousEntity;
  rawQuery: string;
  targetCount?: number;
  modelId?: string;
  userWorkspaceId?: string | null;
  // A boolean title filter from the job-title taxonomy. When set, it replaces
  // the planner's title list for people searches, so a role that is a function
  // x grade (Head of Manufacturing -> VP Manufacturing) is matched as a class.
  titleExpression?: string;
  // LinkedIn industry labels resolved by the sources skill. When set, the
  // planner may not substitute a broader or made-up label.
  industryLabels?: string[];
};

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
    @Optional()
    private readonly titleExpansionService?: TitleExpansionService,
  ) {}

  // Generates shards, compiles them, then spends a few cents sampling each one
  // so the user sees real match counts, costs and precision before paying more.
  async createPlan(
    input: BrightDataLudicrousEstimateInput,
  ): Promise<BrightDataLudicrousPlan> {
    await this.billing.validateCreditsOrThrow(input.workspaceId);

    const generated = await this.generateShards(input);

    // A role set resolved by the taxonomy is a boolean title filter, not a
    // list of words: it keeps "VP Manufacturing" when the user said "Head of
    // Manufacturing". The planner still writes relevanceCriteria, but code
    // owns the title filter.
    if (input.entity === 'people' && isNonEmptyString(input.titleExpression)) {
      this.applyTitleExpression(generated, input.titleExpression);
    } else {
      await this.addTaxonomyTitles(input.entity, generated);
    }

    // The industry label is the one thing the planner most often broadens or
    // invents. When the sources skill has resolved it, it is code-owned too.
    if (input.entity === 'company' && (input.industryLabels?.length ?? 0) > 0) {
      this.applyIndustryLabels(generated, input.industryLabels ?? []);
    }

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
    const listId = randomUUID();
    const { estimates, sampleDocuments, estimateCostUsd } =
      await this.probeShards({
        input,
        listId,
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
      listId,
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

    if (isToolIoLoggingEnabled()) {
      this.logger.log(this.formatPlanLog(plan, compileErrors));
    }

    return plan;
  }

  // Readable record of how the raw request became queries: the planner's
  // reading of intent, each compiled shard query and what sampling found.
  private formatPlanLog(
    plan: BrightDataLudicrousPlan,
    compileErrors: string[],
  ): string {
    const shardLines = plan.shards.map((shard) => {
      const estimate = plan.estimates.find(
        (candidate) => candidate.shardKey === shard.key,
      );
      const stats = estimate
        ? estimate.error
          ? `ERROR ${estimate.error}`
          : `matched=${estimate.matched} fetchable=${estimate.fetchableRecords} precision=${estimate.samplePrecision ?? 'n/a'}`
        : 'not sampled';

      return [
        `  [p${shard.priority}] ${shard.key} — ${stats}`,
        `    why: ${shard.rationale}`,
        '    query:',
        truncateForLog(shard.query, 1_200)
          .split('\n')
          .map((line) => `      ${line}`)
          .join('\n'),
      ].join('\n');
    });

    return [
      `Bright Data plan ${plan.listId} (${plan.entity})`,
      `  raw query: ${plan.rawQuery}`,
      `  intent: ${plan.intentSummary}`,
      `  relevance: ${plan.relevanceCriteria}`,
      `  rubric: ${truncateForLog(plan.rubric, 600)}`,
      ...shardLines,
      compileErrors.length > 0
        ? `  dropped shards: ${compileErrors.join('; ')}`
        : null,
      `  estimate cost $${plan.estimateCostUsd}, unique records ~${plan.estimatedUniqueRecords}`,
    ]
      .filter((line): line is string => line !== null)
      .join('\n');
  }

  // The model names the titles it can think of; the job-title taxonomy adds the
  // curated titles for the same function and grade (for a CEO: chief executive,
  // managing director, founder, president). A user-written boolean title string
  // is never touched. Planning must not fail because the taxonomy is down.
  private applyTitleExpression(
    generated: BrightDataLudicrousPlanLlmOutput,
    expression: string,
  ): void {
    for (const shard of generated.shards) {
      shard.filter.booleanTitleExpression = expression;
      shard.filter.titles = [];
    }

    this.logger.log(
      `Bright Data planner: taxonomy title expression replaces the planner's titles (${expression.length} chars)`,
    );
  }

  private applyIndustryLabels(
    generated: BrightDataLudicrousPlanLlmOutput,
    labels: string[],
  ): void {
    const unique = [...new Set(labels.map((label) => label.trim()))].filter(
      (label) => label.length > 0,
    );

    for (const shard of generated.shards) {
      shard.filter.industries = unique;
    }

    // The relevance judge must accept the same industry the query asks for;
    // otherwise a correct row can be sampled as "wrong industry" and the
    // estimate reads 0% precision.
    generated.rubric.industryIncludePatterns = unique.map(escapeRegExp);

    this.logger.log(
      `Bright Data planner: industry label${unique.length === 1 ? '' : 's'} forced to ${unique.join(', ')}`,
    );
  }

  private async addTaxonomyTitles(
    entity: BrightDataLudicrousEntity,
    generated: BrightDataLudicrousPlanLlmOutput,
  ): Promise<void> {
    if (entity !== 'people' || !isDefined(this.titleExpansionService)) {
      return;
    }

    for (const shard of generated.shards) {
      const { titles, booleanTitleExpression } = shard.filter;

      if (titles.length === 0 || booleanTitleExpression.trim() !== '') {
        continue;
      }

      try {
        const expansion = await this.titleExpansionService.expandTitles(
          titles,
          { maxTitles: TAXONOMY_MAX_TITLES_PER_SHARD },
        );

        if (expansion.added.length > 0) {
          shard.filter.titles = expansion.titles;
          this.logger.log(
            `Shard ${shard.key}: job-title taxonomy added ${expansion.added.join(', ')}`,
          );
        }
      } catch (error) {
        this.logger.warn(
          `Job-title taxonomy expansion skipped for shard ${shard.key}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
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

  // Primary model first (explicit, else the workspace fast model), then the
  // workspace smart model, then other recommended models. Distinct ids only.
  private getPlannerModelIds(input: { modelId?: string }): string[] {
    if (!isDefined(this.aiModelRegistryService)) {
      return [];
    }

    const registry = this.aiModelRegistryService;
    const candidates = [
      input.modelId,
      registry.getDefaultSpeedModel().modelId,
      registry.getDefaultPerformanceModel().modelId,
      ...registry.getRecommendedModelIds(),
    ].filter((modelId): modelId is string => isNonEmptyString(modelId));

    return [...new Set(candidates)]
      .filter((modelId) => isDefined(registry.getModel(modelId)))
      .slice(0, PLANNER_MAX_MODEL_ATTEMPTS);
  }

  // A slow or empty answer from one model must not fail the whole estimate, so
  // each attempt is time-boxed and the next model is tried on any failure.
  private async generateShards(
    input: BrightDataLudicrousEstimateInput,
  ): Promise<BrightDataLudicrousPlanLlmOutput> {
    const modelIds = this.getPlannerModelIds(input);

    if (modelIds.length === 0) {
      throw new Error('No AI model is available for query planning');
    }

    let lastError: unknown;

    for (const modelId of modelIds) {
      try {
        return await this.generateShardsWithModel(input, modelId);
      } catch (error) {
        lastError = error;
        this.logger.warn(
          `Planner model ${modelId} failed (${error instanceof Error ? error.message : String(error)}); ${modelId === modelIds[modelIds.length - 1] ? 'no models left' : 'trying the next model'}`,
        );
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error('Query planning failed on every model');
  }

  private async generateShardsWithModel(
    input: BrightDataLudicrousEstimateInput,
    modelId: string,
  ): Promise<BrightDataLudicrousPlanLlmOutput> {
    const { model } = await this.resolveModel({ ...input, modelId });
    const result = await runGenerateObject(this.aiSdkExecutionService, {
      workspaceId: input.workspaceId,
      modelId,
      options: {
        model,
        schema: brightDataLudicrousPlanLlmSchema,
        system: buildBrightDataLudicrousPlannerSystemPrompt(input.entity),
        prompt: buildBrightDataLudicrousPlannerPrompt({
          entity: input.entity,
          rawQuery: input.rawQuery,
          targetCount: input.targetCount,
        }),
        maxOutputTokens: PLANNER_MAX_OUTPUT_TOKENS,
        abortSignal: AbortSignal.timeout(PLANNER_ATTEMPT_TIMEOUT_MS),
        // Planning is structured extraction. With reasoning on, deepseek flash
        // spent ~12k thinking tokens (~2 minutes) and blew the 90s REST timeout;
        // off it answers in a few seconds. Keyed by provider name, so other
        // providers ignore it.
        providerOptions: { openrouter: { reasoning: { enabled: false } } },
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
    listId,
    shards,
    fields,
    generated,
    rubric,
  }: {
    input: BrightDataLudicrousEstimateInput;
    listId: string;
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
              listId,
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
