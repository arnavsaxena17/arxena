import { Injectable, Logger, Optional } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { type LanguageModel } from 'ai';
import { isDefined } from 'twenty-shared/utils';

import {
  buildOrgchartUnipileShardPlannerPrompt,
  ORGCHART_UNIPILE_SHARD_PLANNER_SYSTEM_PROMPT,
} from 'src/engine/core-modules/candidate-search/prompts/orgchart-unipile-shard-planner.prompt';
import {
  orgchartUnipileShardPlanLlmSchema,
  type OrgchartUnipileShardPlanLlmOutput,
} from 'src/engine/core-modules/candidate-search/schemas/orgchart-unipile-shard-plan.schema';
import {
  compileOrgchartUnipileShards,
  type OrgchartUnipileCompiledShard,
  type ResolveOrgchartUnipileLabelResult,
} from 'src/engine/core-modules/candidate-search/utils/compile-orgchart-unipile-shards.util';
import { LinkedinParameterResolver } from 'src/engine/core-modules/candidate-search/utils/linkedin-parameter-resolver.util';
import { getOrgChartUnipileUnlimitedMaxCandidatesPerShard } from 'src/engine/core-modules/org-chart/utils/orgchart-linkedin-scope.util';
import { AI_TELEMETRY_CONFIG } from 'src/engine/metadata-modules/ai/ai-models/constants/ai-telemetry.const';
import {
  AiSdkExecutionService,
  runGenerateObject,
} from 'src/engine/metadata-modules/ai/ai-billing/services/ai-sdk-execution.service';
import { AiModelRegistryService } from 'src/engine/metadata-modules/ai/ai-models/services/ai-model-registry.service';

const PLANNER_MAX_OUTPUT_TOKENS = 4_000;
const PLANNER_ATTEMPT_TIMEOUT_MS = 45_000;
const PLANNER_MAX_MODEL_ATTEMPTS = 3;

export type OrgchartUnipileShardPlanInput = {
  workspaceId: string;
  companyName: string;
  linkedinCompanyUrl?: string;
  country?: string;
  industry?: string;
  totalCount: number;
  linkedInAccountId: string;
  parentDimension?: string;
  parentExcludedLabels?: string[];
  modelId?: string;
};

export type OrgchartUnipileShardPlanResult = {
  plan: OrgchartUnipileShardPlanLlmOutput;
  compiledShards: OrgchartUnipileCompiledShard[];
  droppedLabels: string[];
};

@Injectable()
export class OrgchartUnipileShardPlannerService {
  private readonly logger = new Logger(OrgchartUnipileShardPlannerService.name);

  constructor(
    private readonly linkedinParameterResolver: LinkedinParameterResolver,
    @Optional()
    private readonly aiModelRegistryService?: AiModelRegistryService,
    @Optional()
    private readonly aiSdkExecutionService?: AiSdkExecutionService,
  ) {}

  async planAndCompile(
    input: OrgchartUnipileShardPlanInput,
  ): Promise<OrgchartUnipileShardPlanResult> {
    const plan = await this.generatePlan(input);
    const resolvedByLabel = await this.resolveLabels({
      plan,
      linkedInAccountId: input.linkedInAccountId,
    });
    const { shards, droppedLabels } = compileOrgchartUnipileShards({
      plan,
      resolvedByLabel,
    });

    if (droppedLabels.length > 0) {
      this.logger.warn(
        `Orgchart Unipile shard planner dropped unresolved labels: ${droppedLabels.join(', ')}`,
      );
    }

    if (shards.length === 0) {
      throw new Error(
        'Orgchart Unipile shard planner produced no runnable shards',
      );
    }

    return { plan, compiledShards: shards, droppedLabels };
  }

  private async generatePlan(
    input: OrgchartUnipileShardPlanInput,
  ): Promise<OrgchartUnipileShardPlanLlmOutput> {
    const modelIds = this.getPlannerModelIds(input.modelId);

    if (modelIds.length === 0) {
      throw new Error('No AI model is available for Unipile shard planning');
    }

    let lastError: unknown;

    for (const modelId of modelIds) {
      try {
        return await this.generatePlanWithModel(input, modelId);
      } catch (error) {
        lastError = error;
        this.logger.warn(
          `Unipile shard planner model ${modelId} failed (${error instanceof Error ? error.message : String(error)})`,
        );
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error('Unipile shard planning failed on every model');
  }

  private async generatePlanWithModel(
    input: OrgchartUnipileShardPlanInput,
    modelId: string,
  ): Promise<OrgchartUnipileShardPlanLlmOutput> {
    const { model } = await this.resolveModel(input.workspaceId, modelId);
    const maxPerShard = getOrgChartUnipileUnlimitedMaxCandidatesPerShard();
    const result = await runGenerateObject(this.aiSdkExecutionService, {
      workspaceId: input.workspaceId,
      modelId,
      options: {
        model,
        schema: orgchartUnipileShardPlanLlmSchema,
        system: ORGCHART_UNIPILE_SHARD_PLANNER_SYSTEM_PROMPT,
        prompt: buildOrgchartUnipileShardPlannerPrompt({
          companyName: input.companyName,
          linkedinCompanyUrl: input.linkedinCompanyUrl,
          country: input.country,
          industry: input.industry,
          totalCount: input.totalCount,
          maxPerShard,
          parentDimension: input.parentDimension,
          parentExcludedLabels: input.parentExcludedLabels,
        }),
        maxOutputTokens: PLANNER_MAX_OUTPUT_TOKENS,
        abortSignal: AbortSignal.timeout(PLANNER_ATTEMPT_TIMEOUT_MS),
        providerOptions: { openrouter: { reasoning: { enabled: false } } },
        experimental_telemetry: AI_TELEMETRY_CONFIG,
      },
    });

    const parsed = orgchartUnipileShardPlanLlmSchema.parse(result.object);
    const remainingCount = parsed.shards.filter(
      (shard) => shard.remaining === true,
    ).length;

    if (remainingCount !== 1) {
      throw new Error(
        `Shard plan must have exactly one remaining shard (got ${remainingCount})`,
      );
    }

    return parsed;
  }

  private async resolveLabels(input: {
    plan: OrgchartUnipileShardPlanLlmOutput;
    linkedInAccountId: string;
  }): Promise<Map<string, ResolveOrgchartUnipileLabelResult>> {
    const resolvedByLabel = new Map<string, ResolveOrgchartUnipileLabelResult>();
    const labels = new Set<string>();

    for (const shard of input.plan.shards) {
      if (shard.remaining === true) {
        continue;
      }
      for (const label of shard.includeLabels) {
        const trimmed = label.trim();
        if (trimmed) {
          labels.add(trimmed);
        }
      }
    }

    const dimension = input.plan.primaryDimension;
    const needsLocationResolve =
      dimension === 'city' ||
      dimension === 'country' ||
      dimension === 'region';

    for (const label of labels) {
      const key = label.toLowerCase();
      if (resolvedByLabel.has(key)) {
        continue;
      }

      if (needsLocationResolve) {
        const resolved = await this.linkedinParameterResolver.resolveLocationName(
          label,
          input.linkedInAccountId,
        );
        resolvedByLabel.set(
          key,
          resolved
            ? { id: resolved.id, title: resolved.title }
            : null,
        );
        continue;
      }

      // function / seniority / titleFamily: keep label as value; optional
      // future resolvers can populate ids here
      resolvedByLabel.set(key, { id: label, title: label });
    }

    return resolvedByLabel;
  }

  private async resolveModel(
    workspaceId: string,
    modelId: string,
  ): Promise<{ modelId: string; model: LanguageModel }> {
    if (!isDefined(this.aiModelRegistryService)) {
      throw new Error('No AI model registry is available for shard planning');
    }

    return this.aiModelRegistryService.resolveModelForAgentInWorkspace(
      { modelId },
      workspaceId,
    );
  }

  private getPlannerModelIds(modelId?: string): string[] {
    if (!isDefined(this.aiModelRegistryService)) {
      return [];
    }

    const registry = this.aiModelRegistryService;
    const candidates = [
      modelId,
      registry.getDefaultSpeedModel().modelId,
      registry.getDefaultPerformanceModel().modelId,
      ...registry.getRecommendedModelIds(),
    ].filter((id): id is string => isNonEmptyString(id));

    return [...new Set(candidates)]
      .filter((id) => isDefined(registry.getModel(id)))
      .slice(0, PLANNER_MAX_MODEL_ATTEMPTS);
  }
}
