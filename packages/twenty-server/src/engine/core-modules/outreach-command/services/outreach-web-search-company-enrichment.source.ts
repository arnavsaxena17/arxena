import { Injectable, Logger, Optional } from '@nestjs/common';

import {
  generateObject,
  generateText,
  Output,
  stepCountIs,
} from 'ai';
import { isDefined } from 'twenty-shared/utils';

import { OUTREACH_COMPANY_ENRICHMENT_LLM_MODEL_ID } from 'src/engine/core-modules/outreach-command/constants/outreach-company-enrichment-model.const';
import {
  buildOutreachWebSearchCompanyUserPrompt,
  OUTREACH_WEB_SEARCH_COMPANY_SYSTEM_PROMPT,
} from 'src/engine/core-modules/outreach-command/prompts/outreach-web-search-company.prompt';
import {
  gtmWebSearchCompanyLlmResultSchema,
  type OutreachWebSearchCompanyLlmResult,
} from 'src/engine/core-modules/outreach-command/schemas/outreach-web-search-company-llm.schema';
import type {
  OutreachCompanyEnrichmentPartial,
  OutreachCompanyEnrichmentSource,
  OutreachCompanyEnrichmentSourceInput,
  OutreachWebSearchCompanySnapshot,
} from 'src/engine/core-modules/outreach-command/utils/outreach-company-enrichment-source.types';
import { AI_TELEMETRY_CONFIG } from 'src/engine/metadata-modules/ai/ai-models/constants/ai-telemetry.const';
import {
  AiModelRegistryService,
  type RegisteredAiModel,
} from 'src/engine/metadata-modules/ai/ai-models/services/ai-model-registry.service';
import { NativeToolBinderService } from 'src/engine/metadata-modules/ai/ai-models/services/native-tool-binder.service';
import { getNativeModelCapabilities } from 'src/engine/metadata-modules/ai/ai-models/utils/get-native-model-capabilities.util';

const WEB_SEARCH_MAX_STEPS = 6;

const hasText = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const supportsNativeWebSearch = (model: RegisteredAiModel): boolean =>
  getNativeModelCapabilities(model.sdkPackage)?.webSearch === true;

const toWebSearchSnapshot = (
  result: OutreachWebSearchCompanyLlmResult,
  domain: string,
): OutreachWebSearchCompanySnapshot => ({
  companyName: result.companyName.trim(),
  websiteUrl: hasText(result.websiteUrl)
    ? result.websiteUrl.trim()
    : `https://${domain}`,
  summary: result.summary.trim(),
  productsOrServices: (result.productsOrServices ?? [])
    .map((item) => item.trim())
    .filter(Boolean),
  industry: (result.industry ?? '').trim(),
  hq: (result.hq ?? '').trim(),
  employeeHint: (result.employeeHint ?? '').trim(),
  keyFacts: (result.keyFacts ?? []).map((item) => item.trim()).filter(Boolean),
  sourceUrls: (result.sourceUrls ?? [])
    .map((item) => item.trim())
    .filter(Boolean),
  notes: (result.notes ?? '').trim(),
});

// Fetches company website / public web content via a model native web_search tool
@Injectable()
export class OutreachWebSearchCompanyEnrichmentSource
  implements OutreachCompanyEnrichmentSource
{
  readonly sourceId = 'web_search' as const;
  private readonly logger = new Logger(
    OutreachWebSearchCompanyEnrichmentSource.name,
  );

  constructor(
    @Optional()
    private readonly aiModelRegistryService?: AiModelRegistryService,
    @Optional()
    private readonly nativeToolBinderService?: NativeToolBinderService,
  ) {}

  async enrich(
    input: OutreachCompanyEnrichmentSourceInput,
  ): Promise<OutreachCompanyEnrichmentPartial | null> {
    if (
      !isDefined(this.aiModelRegistryService) ||
      !isDefined(this.nativeToolBinderService)
    ) {
      return null;
    }

    const registeredModel = await this.resolveWebSearchModel({
      workspaceId: input.workspaceId,
    });

    if (!registeredModel) {
      this.logger.warn(
        `Skipping web_search enrich for ${input.domain}: no ${OUTREACH_COMPANY_ENRICHMENT_LLM_MODEL_ID} model`,
      );

      return null;
    }

    const tools = this.nativeToolBinderService.bind(registeredModel, {
      webSearch: supportsNativeWebSearch(registeredModel),
    });
    const canUseNativeWebSearch = isDefined(tools.web_search);

    try {
      const object = canUseNativeWebSearch
        ? await this.generateWithNativeWebSearch(registeredModel, tools, input)
        : await this.generateWithoutNativeWebSearch(registeredModel, input);

      if (!isDefined(object) || !hasText(object.companyName)) {
        return null;
      }

      const webSearchCompany = toWebSearchSnapshot(object, input.domain);

      this.logger.log(
        `Web search company enrich domain=${input.domain} model=${registeredModel.modelId} name="${webSearchCompany.companyName}" sources=${webSearchCompany.sourceUrls.length} nativeWebSearch=${canUseNativeWebSearch}`,
      );

      return {
        sourceId: this.sourceId,
        webSearchCompany,
      };
    } catch (error) {
      this.logger.warn(
        `Web search enrich failed for domain=${input.domain} model=${registeredModel.modelId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return null;
    }
  }

  private async generateWithNativeWebSearch(
    registeredModel: RegisteredAiModel,
    tools: ReturnType<NativeToolBinderService['bind']>,
    input: OutreachCompanyEnrichmentSourceInput,
  ): Promise<OutreachWebSearchCompanyLlmResult | undefined> {
    const result = await generateText({
      model: registeredModel.model,
      tools,
      system: OUTREACH_WEB_SEARCH_COMPANY_SYSTEM_PROMPT,
      prompt: buildOutreachWebSearchCompanyUserPrompt({
        domain: input.domain,
        workspaceDisplayName: input.workspaceDisplayName,
        companyNameHint: input.hints?.companyName,
      }),
      output: Output.object({
        schema: gtmWebSearchCompanyLlmResultSchema,
      }),
      stopWhen: stepCountIs(WEB_SEARCH_MAX_STEPS),
      experimental_telemetry: AI_TELEMETRY_CONFIG,
    });

    return result.output;
  }

  private async generateWithoutNativeWebSearch(
    registeredModel: RegisteredAiModel,
    input: OutreachCompanyEnrichmentSourceInput,
  ): Promise<OutreachWebSearchCompanyLlmResult | undefined> {
    const { object } = await generateObject({
      model: registeredModel.model,
      schema: gtmWebSearchCompanyLlmResultSchema,
      system: OUTREACH_WEB_SEARCH_COMPANY_SYSTEM_PROMPT,
      prompt: buildOutreachWebSearchCompanyUserPrompt({
        domain: input.domain,
        workspaceDisplayName: input.workspaceDisplayName,
        companyNameHint: input.hints?.companyName,
      }),
      experimental_telemetry: AI_TELEMETRY_CONFIG,
    });

    return object;
  }

  private async resolveWebSearchModel(input: {
    workspaceId?: string;
  }): Promise<RegisteredAiModel | null> {
    if (!isDefined(this.aiModelRegistryService)) {
      return null;
    }

    try {
      const hy3Model = this.aiModelRegistryService.getModel(
        OUTREACH_COMPANY_ENRICHMENT_LLM_MODEL_ID,
      );
      const fallbackModel = hy3Model ?? this.getDefaultSpeedModelOrNull();

      if (!fallbackModel) {
        return null;
      }

      if (hasText(input.workspaceId)) {
        return await this.aiModelRegistryService.resolveModelForAgentInWorkspace(
          { modelId: fallbackModel.modelId },
          input.workspaceId,
        );
      }

      return fallbackModel;
    } catch (error) {
      this.logger.warn(
        `Failed to resolve web_search model: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return null;
    }
  }

  private getDefaultSpeedModelOrNull(): RegisteredAiModel | null {
    if (!isDefined(this.aiModelRegistryService)) {
      return null;
    }

    try {
      return this.aiModelRegistryService.getDefaultSpeedModel();
    } catch {
      return null;
    }
  }
}
