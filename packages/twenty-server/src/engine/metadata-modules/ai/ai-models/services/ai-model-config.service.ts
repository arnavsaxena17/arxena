import { Injectable } from '@nestjs/common';

import { type ProviderOptions } from '@ai-sdk/provider-utils';
import { type ToolSet } from 'ai';
import { isDefined } from 'twenty-shared/utils';

import { AGENT_CONFIG } from 'src/engine/metadata-modules/ai/ai-agent/constants/agent-config.const';
import {
  AI_SDK_ANTHROPIC,
  AI_SDK_BEDROCK,
  AI_SDK_OPENAI,
  AI_SDK_XAI,
} from 'src/engine/metadata-modules/ai/ai-models/constants/ai-sdk-package.const';
import {
  RegisteredAiModel,
} from 'src/engine/metadata-modules/ai/ai-models/services/ai-model-registry.service';
import { type NativeModelToolOptions } from 'src/engine/metadata-modules/ai/ai-models/types/native-model-tool-options.type';
import { getNativeModelToolsForSdkPackage } from 'src/engine/metadata-modules/ai/ai-models/utils/get-native-model-tools-for-sdk-package.util';

@Injectable()
export class AiModelConfigService {
  constructor() {}

  getReasoningProviderOptions(model: RegisteredAiModel): ProviderOptions {
    switch (model.sdkPackage) {
      case AI_SDK_ANTHROPIC:
        return this.getAnthropicProviderOptions(model);
      case AI_SDK_BEDROCK:
        return this.getBedrockProviderOptions(model);
      default:
        return {};
    }
  }

  getNativeModelTools(
    model: RegisteredAiModel,
    options: NativeModelToolOptions = {},
  ): ToolSet {
    const tools: Record<string, unknown> = {};

    const nativeTools = getNativeModelToolsForSdkPackage(model.sdkPackage);
    const rawProvider = model.rawProvider;

    if (!isDefined(nativeTools) || !isDefined(rawProvider)) {
      return tools as ToolSet;
    }

    switch (model.sdkPackage) {
      case AI_SDK_ANTHROPIC: {
        if (options.webSearch === true && isDefined(nativeTools.webSearch)) {
          const anthropicProvider = rawProvider as
            | { tools?: { webSearch_20250305?: () => unknown } }
            | undefined;

          const webSearchTool = anthropicProvider?.tools
            ?.webSearch_20250305;

          if (isDefined(webSearchTool)) {
            tools[nativeTools.webSearch.directToolName] = webSearchTool();
          }
        }

        break;
      }
      case AI_SDK_OPENAI: {
        if (options.webSearch === true && isDefined(nativeTools.webSearch)) {
          const openaiProvider = rawProvider as
            | { tools?: { webSearch?: () => unknown } }
            | undefined;

          const webSearchTool = openaiProvider?.tools?.webSearch;

          if (isDefined(webSearchTool)) {
            tools[nativeTools.webSearch.directToolName] =
              webSearchTool();
          }
        }

        break;
      }
      case AI_SDK_XAI: {
        const xaiProvider = rawProvider as
          | { tools?: { webSearch?: () => unknown; xSearch?: () => unknown } }
          | undefined;

        if (options.webSearch === true && isDefined(nativeTools.webSearch)) {
          const webSearchTool = xaiProvider?.tools?.webSearch;

          if (isDefined(webSearchTool)) {
            tools[nativeTools.webSearch.directToolName] = webSearchTool();
          }
        }

        if (
          options.twitterSearch === true &&
          isDefined(nativeTools.twitterSearch)
        ) {
          const xSearchTool = xaiProvider?.tools?.xSearch;

          if (isDefined(xSearchTool)) {
            tools[nativeTools.twitterSearch.directToolName] = xSearchTool();
          }
        }

        break;
      }
    }

    return tools as ToolSet;
  }

  private getAnthropicProviderOptions(
    model: RegisteredAiModel,
  ): ProviderOptions {
    if (!model.supportsReasoning) {
      return {};
    }

    return {
      anthropic: {
        thinking: {
          type: 'enabled',
          budgetTokens: AGENT_CONFIG.REASONING_BUDGET_TOKENS,
        },
      },
    };
  }

  private getBedrockProviderOptions(model: RegisteredAiModel): ProviderOptions {
    if (!model.supportsReasoning) {
      return {};
    }

    return {
      bedrock: {
        thinking: {
          type: 'enabled',
          budgetTokens: AGENT_CONFIG.REASONING_BUDGET_TOKENS,
        },
      },
    };
  }
}
