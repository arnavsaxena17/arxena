import { Injectable, Logger, Optional } from '@nestjs/common';

import {
  generateText,
  Output,
  stepCountIs,
} from 'ai';
import { isDefined } from 'twenty-shared/utils';

import {
  buildGtmWebSearchCompanyUserPrompt,
  GTM_WEB_SEARCH_COMPANY_SYSTEM_PROMPT,
} from 'src/engine/core-modules/gtm-command/prompts/gtm-web-search-company.prompt';
import {
  gtmWebSearchCompanyLlmResultSchema,
  type GtmWebSearchCompanyLlmResult,
} from 'src/engine/core-modules/gtm-command/schemas/gtm-web-search-company-llm.schema';
import type {
  GtmCompanyEnrichmentPartial,
  GtmCompanyEnrichmentSource,
  GtmCompanyEnrichmentSourceInput,
  GtmWebSearchCompanySnapshot,
} from 'src/engine/core-modules/gtm-command/utils/gtm-company-enrichment-source.types';
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
  result: GtmWebSearchCompanyLlmResult,
  domain: string,
): GtmWebSearchCompanySnapshot => ({
  companyName: result.companyName.trim(),
  websiteUrl: hasText(result.websiteUrl)
    ? result.websiteUrl.trim()
    : `https://${domain}`,
  summary: result.summary.trim(),
  productsOrServices: result.productsOrServices
    .map((item) => item.trim())
    .filter(Boolean),
  industry: result.industry.trim(),
  hq: result.hq.trim(),
  employeeHint: result.employeeHint.trim(),
  keyFacts: result.keyFacts.map((item) => item.trim()).filter(Boolean),
  sourceUrls: result.sourceUrls.map((item) => item.trim()).filter(Boolean),
  notes: result.notes.trim(),
});

// Fetches company website / public web content via a model native web_search tool
@Injectable()
export class GtmWebSearchCompanyEnrichmentSource
  implements GtmCompanyEnrichmentSource
{
  readonly sourceId = 'web_search' as const;
  private readonly logger = new Logger(
    GtmWebSearchCompanyEnrichmentSource.name,
  );

  constructor(
    @Optional()
    private readonly aiModelRegistryService?: AiModelRegistryService,
    @Optional()
    private readonly nativeToolBinderService?: NativeToolBinderService,
  ) {}

  async enrich(
    input: GtmCompanyEnrichmentSourceInput,
  ): Promise<GtmCompanyEnrichmentPartial | null> {
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
        `Skipping web_search enrich for ${input.domain}: no model with native web_search`,
      );

      return null;
    }

    const tools = this.nativeToolBinderService.bind(registeredModel, {
      webSearch: true,
    });

    if (!isDefined(tools.web_search)) {
      this.logger.warn(
        `Skipping web_search enrich for ${input.domain}: model ${registeredModel.modelId} did not bind web_search`,
      );

      return null;
    }

    try {
      const result = await generateText({
        model: registeredModel.model,
        tools,
        system: GTM_WEB_SEARCH_COMPANY_SYSTEM_PROMPT,
        prompt: buildGtmWebSearchCompanyUserPrompt({
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

      const object = result.output;

      if (!isDefined(object) || !hasText(object.companyName)) {
        return null;
      }

      const webSearchCompany = toWebSearchSnapshot(object, input.domain);

      this.logger.log(
        `Web search company enrich domain=${input.domain} model=${registeredModel.modelId} name="${webSearchCompany.companyName}" sources=${webSearchCompany.sourceUrls.length}`,
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

  private async resolveWebSearchModel(input: {
    workspaceId?: string;
  }): Promise<RegisteredAiModel | null> {
    if (!isDefined(this.aiModelRegistryService)) {
      return null;
    }

    try {
      const candidates = this.collectWebSearchCapableModels();

      if (candidates.length === 0) {
        return null;
      }

      const preferredModel = candidates[0];

      if (hasText(input.workspaceId)) {
        return await this.aiModelRegistryService.resolveModelForAgentInWorkspace(
          { modelId: preferredModel.modelId },
          input.workspaceId,
        );
      }

      return preferredModel;
    } catch (error) {
      this.logger.warn(
        `Failed to resolve web_search model: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return null;
    }
  }

  private collectWebSearchCapableModels(): RegisteredAiModel[] {
    if (!isDefined(this.aiModelRegistryService)) {
      return [];
    }

    const preferred: RegisteredAiModel[] = [];

    for (const getter of [
      () => this.aiModelRegistryService!.getDefaultPerformanceModel(),
      () => this.aiModelRegistryService!.getDefaultSpeedModel(),
    ]) {
      try {
        const model = getter();

        if (supportsNativeWebSearch(model)) {
          preferred.push(model);
        }
      } catch {
        // No default model configured for this role
      }
    }

    const remaining = this.aiModelRegistryService
      .getAvailableModels()
      .filter(
        (model) =>
          supportsNativeWebSearch(model) &&
          !preferred.some(
            (preferredModel) => preferredModel.modelId === model.modelId,
          ),
      );

    return [...preferred, ...remaining];
  }
}
