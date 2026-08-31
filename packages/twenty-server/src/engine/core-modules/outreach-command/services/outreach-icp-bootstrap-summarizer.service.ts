import { Injectable, Logger, Optional } from '@nestjs/common';

import { type LanguageModel } from 'ai';
import { isDefined } from 'twenty-shared/utils';

import { OUTREACH_COMPANY_ENRICHMENT_LLM_MODEL_ID } from 'src/engine/core-modules/outreach-command/constants/outreach-company-enrichment-model.const';
import {
  buildIcpBootstrapSummarizerUserPrompt,
  ICP_BOOTSTRAP_SUMMARIZER_SYSTEM_PROMPT,
} from 'src/engine/core-modules/outreach-command/prompts/outreach-icp-bootstrap-summarizer.prompt';
import {
  gtmIcpBootstrapLlmResultSchema,
  type IcpBootstrapLlmResult,
} from 'src/engine/core-modules/outreach-command/schemas/outreach-icp-bootstrap-llm.schema';
import { AI_TELEMETRY_CONFIG } from 'src/engine/metadata-modules/ai/ai-models/constants/ai-telemetry.const';
import {
  AiSdkExecutionService,
  runGenerateObject,
} from 'src/engine/metadata-modules/ai/ai-billing/services/ai-sdk-execution.service';
import { AiModelRegistryService } from 'src/engine/metadata-modules/ai/ai-models/services/ai-model-registry.service';

const hasText = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.trim().length > 0;

@Injectable()
export class IcpBootstrapSummarizerService {
  private readonly logger = new Logger(IcpBootstrapSummarizerService.name);

  constructor(
    @Optional()
    private readonly aiModelRegistryService?: AiModelRegistryService,
    @Optional()
    private readonly aiSdkExecutionService?: AiSdkExecutionService,
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
  }): Promise<IcpBootstrapLlmResult | null> {
    const registeredModel = await this.resolveModel({
      workspaceId: input.workspaceId,
      modelId: input.modelId,
    });

    if (!registeredModel) {
      return null;
    }

    try {
      const generationResult = await runGenerateObject(
        this.aiSdkExecutionService,
        {
          workspaceId: input.workspaceId,
          modelId: registeredModel.modelId,
          options: {
            model: registeredModel.model,
            schema: gtmIcpBootstrapLlmResultSchema,
            system: ICP_BOOTSTRAP_SUMMARIZER_SYSTEM_PROMPT,
            prompt: buildIcpBootstrapSummarizerUserPrompt({
              domain: input.domain,
              companyName: input.companyName,
              industry: input.industry,
              summary: input.summary,
              employeeRange: input.employeeRange,
              hq: input.hq,
            }),
            experimental_telemetry: AI_TELEMETRY_CONFIG,
          },
        },
      );

      this.logger.log(
        `LLM ICP bootstrap domain=${input.domain} model=${registeredModel.modelId} titles=${generationResult.object.targetTitles.length} locations=${generationResult.object.locations.length}`,
      );

      return generationResult.object;
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
        `Failed to resolve AI model for GTM ICP bootstrap: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return null;
    }
  }
}
