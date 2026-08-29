import { Injectable, Logger, Optional } from '@nestjs/common';

import { generateObject, type LanguageModel } from 'ai';
import { isDefined } from 'twenty-shared/utils';

import { OUTREACH_COMPANY_ENRICHMENT_LLM_MODEL_ID } from 'src/engine/core-modules/outreach-command/constants/outreach-company-enrichment-model.const';
import {
  buildOutreachCompanyProfileSummarizerUserPrompt,
  OUTREACH_COMPANY_PROFILE_SUMMARIZER_SYSTEM_PROMPT,
} from 'src/engine/core-modules/outreach-command/prompts/outreach-company-profile-summarizer.prompt';
import {
  gtmCompanyProfileLlmResultSchema,
  type OutreachCompanyProfileLlmResult,
} from 'src/engine/core-modules/outreach-command/schemas/outreach-company-profile-llm.schema';
import type { OutreachCollectedCompanyEnrichment } from 'src/engine/core-modules/outreach-command/utils/outreach-company-enrichment-source.types';
import { AI_TELEMETRY_CONFIG } from 'src/engine/metadata-modules/ai/ai-models/constants/ai-telemetry.const';
import { AiModelRegistryService } from 'src/engine/metadata-modules/ai/ai-models/services/ai-model-registry.service';

const hasText = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.trim().length > 0;

@Injectable()
export class OutreachCompanyProfileSummarizerService {
  private readonly logger = new Logger(OutreachCompanyProfileSummarizerService.name);

  constructor(
    @Optional()
    private readonly aiModelRegistryService?: AiModelRegistryService,
  ) {}

  async summarizeFromEnrichmentSources(input: {
    domain: string;
    workspaceDisplayName?: string | null;
    enrichment: OutreachCollectedCompanyEnrichment;
    workspaceId?: string;
    // Override model; default comes from AI_MODELS_DEFAULT_FAST
    modelId?: string;
  }): Promise<OutreachCompanyProfileLlmResult | null> {
    const { enrichment } = input;
    const hasAnySource =
      isDefined(enrichment.linkedInCompanyProfile) ||
      isDefined(enrichment.linkedInSearchHit) ||
      isDefined(enrichment.wikidataCompany) ||
      isDefined(enrichment.wikiCompany) ||
      isDefined(enrichment.webSearchCompany);

    if (!hasAnySource) {
      return null;
    }

    const registeredModel = await this.resolveModel({
      workspaceId: input.workspaceId,
      modelId: input.modelId,
    });

    if (!registeredModel) {
      return null;
    }

    try {
      const { object } = await generateObject({
        model: registeredModel.model,
        schema: gtmCompanyProfileLlmResultSchema,
        system: OUTREACH_COMPANY_PROFILE_SUMMARIZER_SYSTEM_PROMPT,
        prompt: buildOutreachCompanyProfileSummarizerUserPrompt({
          domain: input.domain,
          workspaceDisplayName: input.workspaceDisplayName,
          linkedInSearchHit: enrichment.linkedInSearchHit,
          linkedInCompanyProfile: enrichment.linkedInCompanyProfile,
          wikidataCompany: enrichment.wikidataCompany,
          companiesIndexWiki: enrichment.wikiCompany,
          webSearchCompany: enrichment.webSearchCompany,
        }),
        experimental_telemetry: AI_TELEMETRY_CONFIG,
      });

      this.logger.log(
        `LLM company profile summary domain=${input.domain} model=${registeredModel.modelId} name="${object.companyName}" industry="${object.industry}"`,
      );

      return object;
    } catch (error) {
      this.logger.warn(
        `LLM company profile summary failed for domain=${input.domain} model=${registeredModel.modelId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return null;
    }
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

      return (
        this.aiModelRegistryService.getModel(modelId) ?? defaultFastModel
      );
    } catch (error) {
      this.logger.warn(
        `Failed to resolve AI model for GTM company summary: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return null;
    }
  }
}
