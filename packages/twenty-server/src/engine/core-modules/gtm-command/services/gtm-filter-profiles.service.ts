import { Injectable, Logger, Optional } from '@nestjs/common';

import { generateObject, type LanguageModel } from 'ai';
import { isDefined } from 'twenty-shared/utils';

import { GTM_COMPANY_ENRICHMENT_LLM_MODEL_ID } from 'src/engine/core-modules/gtm-command/constants/gtm-company-enrichment-model.const';
import {
  buildGtmFilterProfilesUserPrompt,
  GTM_FILTER_PROFILES_SYSTEM_PROMPT,
} from 'src/engine/core-modules/gtm-command/prompts/gtm-filter-profiles.prompt';
import {
  gtmFilterProfilesLlmResultSchema,
  type GtmFilterProfilesLlmResult,
} from 'src/engine/core-modules/gtm-command/schemas/gtm-filter-profiles-llm.schema';
import {
  compactProfileJson,
  extractProfilesFromPayload,
  profileDisplayName,
} from 'src/engine/core-modules/gtm-command/utils/gtm-fake-profile-investigation.util';
import { AI_TELEMETRY_CONFIG } from 'src/engine/metadata-modules/ai/ai-models/constants/ai-telemetry.const';
import { AiModelRegistryService } from 'src/engine/metadata-modules/ai/ai-models/services/ai-model-registry.service';

const hasText = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const ASSESS_CONCURRENCY = 3;

export type GtmFilterProfilesInput = {
  profiles?: unknown;
  profile?: unknown;
  snapshot?: unknown;
  prompt?: string;
  modelId?: string;
};

export type GtmFilterProfilesAssessment = {
  index: number;
  matches: boolean;
  reason: string;
  name: string;
  profile: unknown;
  error?: string;
};

export type GtmFilterProfilesResult = {
  success: boolean;
  total: number;
  matchedCount: number;
  rejectedCount: number;
  error: string;
  people: unknown[];
  rejected: unknown[];
  assessments: GtmFilterProfilesAssessment[];
};

@Injectable()
export class GtmFilterProfilesService {
  private readonly logger = new Logger(GtmFilterProfilesService.name);

  constructor(
    @Optional()
    private readonly aiModelRegistryService?: AiModelRegistryService,
  ) {}

  async execute({
    workspaceId,
    input,
  }: {
    workspaceId?: string;
    input: GtmFilterProfilesInput;
  }): Promise<GtmFilterProfilesResult> {
    const prompt = hasText(input.prompt) ? input.prompt.trim() : '';

    if (!hasText(prompt)) {
      return this.emptyResult('Pass a prompt with the filter criteria.');
    }

    const profiles = extractProfilesFromPayload(input);

    if (profiles.length === 0) {
      return this.emptyResult(
        'Pass profiles (array of LinkedIn profiles or search hits).',
      );
    }

    const registeredModel = await this.resolveModel({
      workspaceId,
      modelId: input.modelId,
    });

    if (!registeredModel) {
      return this.emptyResult(
        'No AI model is configured. Need Nous HY3 (nous/tencent/hy3:free) or another registered model.',
      );
    }

    const assessments = await this.mapInBatches(
      profiles,
      ASSESS_CONCURRENCY,
      (profile, index) =>
        this.assessOne({
          profile,
          index,
          prompt,
          model: registeredModel.model,
          modelId: registeredModel.modelId,
        }),
    );

    const people = assessments
      .filter((assessment) => assessment.matches)
      .map((assessment) => assessment.profile);
    const rejected = assessments
      .filter((assessment) => !assessment.matches)
      .map((assessment) => assessment.profile);

    this.logger.log(
      `Filter-profiles model=${registeredModel.modelId} total=${assessments.length} matched=${people.length} rejected=${rejected.length}`,
    );

    return {
      success: true,
      total: assessments.length,
      matchedCount: people.length,
      rejectedCount: rejected.length,
      error: '',
      people,
      rejected,
      assessments,
    };
  }

  private async assessOne(input: {
    profile: unknown;
    index: number;
    prompt: string;
    model: LanguageModel;
    modelId: string;
  }): Promise<GtmFilterProfilesAssessment> {
    const name = profileDisplayName(input.profile);

    try {
      const { object } = await generateObject({
        model: input.model,
        schema: gtmFilterProfilesLlmResultSchema,
        system: GTM_FILTER_PROFILES_SYSTEM_PROMPT,
        prompt: buildGtmFilterProfilesUserPrompt({
          criteria: input.prompt,
          profileJson: compactProfileJson(input.profile),
        }),
        experimental_telemetry: AI_TELEMETRY_CONFIG,
      });

      return this.toAssessment({
        index: input.index,
        profile: input.profile,
        name,
        llm: object,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.warn(
        `Filter-profiles assessment failed index=${input.index} model=${input.modelId}: ${message}`,
      );

      return {
        index: input.index,
        matches: false,
        reason: '',
        name,
        profile: input.profile,
        error: message,
      };
    }
  }

  private toAssessment(input: {
    index: number;
    profile: unknown;
    name: string;
    llm: GtmFilterProfilesLlmResult;
  }): GtmFilterProfilesAssessment {
    return {
      index: input.index,
      matches: input.llm.matches,
      reason: input.llm.reason,
      name: input.name,
      profile: input.profile,
    };
  }

  private emptyResult(error: string): GtmFilterProfilesResult {
    return {
      success: false,
      total: 0,
      matchedCount: 0,
      rejectedCount: 0,
      error,
      people: [],
      rejected: [],
      assessments: [],
    };
  }

  private async mapInBatches<T, R>(
    items: T[],
    batchSize: number,
    mapper: (item: T, index: number) => Promise<R>,
  ): Promise<R[]> {
    const results: R[] = [];

    for (let offset = 0; offset < items.length; offset += batchSize) {
      const batch = items.slice(offset, offset + batchSize);
      const mapped = await Promise.all(
        batch.map((item, batchIndex) => mapper(item, offset + batchIndex)),
      );

      results.push(...mapped);
    }

    return results;
  }

  private async resolveModel(input: {
    workspaceId?: string;
    modelId?: string;
  }): Promise<{ modelId: string; model: LanguageModel } | null> {
    if (!isDefined(this.aiModelRegistryService)) {
      return null;
    }

    try {
      const hy3Model = this.aiModelRegistryService.getModel(
        GTM_COMPANY_ENRICHMENT_LLM_MODEL_ID,
      );
      const defaultFastModel =
        hy3Model ?? this.aiModelRegistryService.getDefaultSpeedModel();
      const modelId = hasText(input.modelId)
        ? input.modelId
        : defaultFastModel.modelId;

      if (hasText(input.workspaceId)) {
        return await this.aiModelRegistryService.resolveModelForAgentInWorkspace(
          { modelId },
          input.workspaceId,
        );
      }

      return this.aiModelRegistryService.getModel(modelId) ?? defaultFastModel;
    } catch (error) {
      this.logger.warn(
        `Failed to resolve AI model for filter-profiles: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return null;
    }
  }
}
