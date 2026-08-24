import { Injectable, Logger, Optional } from '@nestjs/common';

import { generateObject, type LanguageModel } from 'ai';
import { isDefined } from 'twenty-shared/utils';

import { GTM_COMPANY_ENRICHMENT_LLM_MODEL_ID } from 'src/engine/core-modules/gtm-command/constants/gtm-company-enrichment-model.const';
import {
  buildGtmIcpBootstrapSummarizerUserPrompt,
  GTM_ICP_BOOTSTRAP_SUMMARIZER_SYSTEM_PROMPT,
} from 'src/engine/core-modules/gtm-command/prompts/gtm-icp-bootstrap-summarizer.prompt';
import {
  gtmIcpBootstrapLlmResultSchema,
  type GtmIcpBootstrapLlmResult,
} from 'src/engine/core-modules/gtm-command/schemas/gtm-icp-bootstrap-llm.schema';
import { AI_TELEMETRY_CONFIG } from 'src/engine/metadata-modules/ai/ai-models/constants/ai-telemetry.const';
import { AiModelRegistryService } from 'src/engine/metadata-modules/ai/ai-models/services/ai-model-registry.service';

const hasText = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.trim().length > 0;

@Injectable()
export class GtmIcpBootstrapSummarizerService {
  private readonly logger = new Logger(GtmIcpBootstrapSummarizerService.name);

  constructor(
    @Optional()
    private readonly aiModelRegistryService?: AiModelRegistryService,
  ) {}

  async draftFromSellerCompany(input: {
    domain: string;
    companyName: string;
    industry: string;
    summary: string;
    employeeRange: string;
    hq: string;
    workspaceId?: string;
    modelId?: string;
  }): Promise<GtmIcpBootstrapLlmResult | null> {
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
        schema: gtmIcpBootstrapLlmResultSchema,
        system: GTM_ICP_BOOTSTRAP_SUMMARIZER_SYSTEM_PROMPT,
        prompt: buildGtmIcpBootstrapSummarizerUserPrompt({
          domain: input.domain,
          companyName: input.companyName,
          industry: input.industry,
          summary: input.summary,
          employeeRange: input.employeeRange,
          hq: input.hq,
        }),
        experimental_telemetry: AI_TELEMETRY_CONFIG,
      });

      this.logger.log(
        `LLM ICP bootstrap domain=${input.domain} model=${registeredModel.modelId} titles=${object.buyerTitles.length} locations=${object.locations.length}`,
      );

      return object;
    } catch (error) {
      this.logger.warn(
        `LLM ICP bootstrap failed for domain=${input.domain} model=${registeredModel.modelId}: ${
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
        `Failed to resolve AI model for GTM ICP bootstrap: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return null;
    }
  }
}
