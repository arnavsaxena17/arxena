import { Injectable, Logger, Optional } from '@nestjs/common';

import { generateObject, type LanguageModel } from 'ai';
import { isDefined } from 'twenty-shared/utils';

import { OUTREACH_COMPANY_ENRICHMENT_LLM_MODEL_ID } from 'src/engine/core-modules/outreach-command/constants/outreach-company-enrichment-model.const';
import {
  buildOutreachFilterProfilesUserPrompt,
  OUTREACH_FILTER_PROFILES_SYSTEM_PROMPT,
} from 'src/engine/core-modules/outreach-command/prompts/outreach-filter-profiles.prompt';
import {
  gtmFilterProfilesLlmResultSchema,
  type OutreachFilterProfilesLlmResult,
} from 'src/engine/core-modules/outreach-command/schemas/outreach-filter-profiles-llm.schema';
import {
  compactProfileJson,
  extractProfilesFromPayload,
  profileDisplayName,
} from 'src/engine/core-modules/outreach-command/utils/outreach-fake-profile-investigation.util';
import {
  isOnlyOnePersonPerCompanyEnabled,
  keepSeniorPersonPerCompany,
} from 'src/engine/core-modules/outreach-command/utils/keep-one-person-per-company.util';
import { AI_TELEMETRY_CONFIG } from 'src/engine/metadata-modules/ai/ai-models/constants/ai-telemetry.const';
import { AiModelRegistryService } from 'src/engine/metadata-modules/ai/ai-models/services/ai-model-registry.service';

const hasText = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const FILTER_PROFILES_MAX_OUTPUT_TOKENS = 2_048;
const FILTER_PROFILES_CONCURRENCY = 2;

type LlmErrorRecord = Error & {
  statusCode?: number;
  data?: { error?: { metadata?: { raw?: string } } };
  text?: string;
};

export const concurrencyForFilterProfilesModel = (modelId: string): number =>
  modelId.includes('ox-alpha') ? 1 : FILTER_PROFILES_CONCURRENCY;

export const reasoningProviderOptionsForFilterProfiles = (
  modelId: string,
): {
  openrouter: { reasoning: { effort: 'low' | 'medium' } };
  nous: { reasoning: { effort: 'low' | 'medium' } };
} => {
  const effort = modelId.includes('ox-alpha') ? 'low' : 'medium';

  return {
    openrouter: { reasoning: { effort } },
    nous: { reasoning: { effort } },
  };
};

export const repairGeneratedJsonObjectText = ({
  text,
}: {
  text: string;
}): string | null => {
  const trimmed = text.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  const candidate = (fenced?.[1] ?? trimmed).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');

  if (start < 0 || end <= start) {
    return null;
  }

  const sliced = candidate.slice(start, end + 1);

  return sliced === text ? null : sliced;
};

export const formatFilterProfilesLlmError = (error: unknown): string => {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const record = error as LlmErrorRecord;
  const parts = [error.message];

  if (typeof record.statusCode === 'number') {
    parts.push(`status=${record.statusCode}`);
  }

  const raw = record.data?.error?.metadata?.raw;

  if (hasText(raw)) {
    parts.push(raw);
  } else if (hasText(record.text)) {
    parts.push(`text=${record.text.slice(0, 240)}`);
  }

  return parts.join(' — ');
};

export type OutreachFilterProfilesInput = {
  profiles?: unknown;
  profile?: unknown;
  snapshot?: unknown;
  prompt?: string;
  modelId?: string;
  onlyOnePersonPerCompany?: boolean | string;
};

export type OutreachFilterProfilesAssessment = {
  index: number;
  matches: boolean;
  reason: string;
  name: string;
  profile: unknown;
  error?: string;
};

export type OutreachFilterProfilesResult = {
  success: boolean;
  total: number;
  matchedCount: number;
  rejectedCount: number;
  error: string;
  people: unknown[];
  rejected: unknown[];
  assessments: OutreachFilterProfilesAssessment[];
};

@Injectable()
export class OutreachFilterProfilesService {
  private readonly logger = new Logger(OutreachFilterProfilesService.name);

  constructor(
    @Optional()
    private readonly aiModelRegistryService?: AiModelRegistryService,
  ) {}

  async execute({
    workspaceId,
    input,
  }: {
    workspaceId?: string;
    input: OutreachFilterProfilesInput;
  }): Promise<OutreachFilterProfilesResult> {
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

    const assessed = await this.mapInBatches(
      profiles,
      concurrencyForFilterProfilesModel(registeredModel.modelId),
      (profile, index) =>
        this.assessOne({
          profile,
          index,
          prompt,
          model: registeredModel.model,
          modelId: registeredModel.modelId,
        }),
    );

    const assessments = isOnlyOnePersonPerCompanyEnabled(
      input.onlyOnePersonPerCompany,
    )
      ? keepSeniorPersonPerCompany(
          assessed,
          (assessment) => assessment.profile,
        )
      : assessed;

    const people = assessments
      .filter((assessment) => assessment.matches)
      .map((assessment) => assessment.profile);
    const rejected = assessments
      .filter((assessment) => !assessment.matches)
      .map((assessment) => assessment.profile);

    this.logger.log(
      `Filter-profiles model=${registeredModel.modelId} total=${assessments.length} matched=${people.length} rejected=${rejected.length} onlyOnePersonPerCompany=${isOnlyOnePersonPerCompanyEnabled(input.onlyOnePersonPerCompany)}`,
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
  }): Promise<OutreachFilterProfilesAssessment> {
    const name = profileDisplayName(input.profile);

    try {
      const { object } = await generateObject({
        model: input.model,
        schema: gtmFilterProfilesLlmResultSchema,
        system: OUTREACH_FILTER_PROFILES_SYSTEM_PROMPT,
        prompt: buildOutreachFilterProfilesUserPrompt({
          criteria: input.prompt,
          profileJson: compactProfileJson(input.profile),
        }),
        maxOutputTokens: FILTER_PROFILES_MAX_OUTPUT_TOKENS,
        providerOptions: reasoningProviderOptionsForFilterProfiles(
          input.modelId,
        ),
        experimental_repairText: repairGeneratedJsonObjectText,
        experimental_telemetry: AI_TELEMETRY_CONFIG,
      });

      return this.toAssessment({
        index: input.index,
        profile: input.profile,
        name,
        llm: object,
      });
    } catch (error) {
      const message = formatFilterProfilesLlmError(error);

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
    llm: OutreachFilterProfilesLlmResult;
  }): OutreachFilterProfilesAssessment {
    return {
      index: input.index,
      matches: input.llm.matches,
      reason: input.llm.reason,
      name: input.name,
      profile: input.profile,
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

  private emptyResult(error: string): OutreachFilterProfilesResult {
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

  private async resolveModel(input: {
    workspaceId?: string;
    modelId?: string;
  }): Promise<{ modelId: string; model: LanguageModel } | null> {
    if (!isDefined(this.aiModelRegistryService)) {
      return null;
    }

    try {
      const hy3Model = this.aiModelRegistryService.getModel(
        OUTREACH_COMPANY_ENRICHMENT_LLM_MODEL_ID,
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
