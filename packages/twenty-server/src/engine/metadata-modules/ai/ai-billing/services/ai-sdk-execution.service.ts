import { Injectable } from '@nestjs/common';

import {
  generateObject,
  generateText,
  type LanguageModelUsage,
  type StepResult,
  type ToolSet,
} from 'ai';
import { isDefined } from 'twenty-shared/utils';

import { UsageOperationType } from 'src/engine/core-modules/usage/enums/usage-operation-type.enum';
import { AiBillingService } from 'src/engine/metadata-modules/ai/ai-billing/services/ai-billing.service';
import { type ModelId } from 'src/engine/metadata-modules/ai/ai-models/types/model-id.type';

type AiSdkBillingContext = {
  workspaceId: string | undefined | null;
  modelId: ModelId;
  operationType?: UsageOperationType;
  userWorkspaceId?: string | null;
};

type GenerateObjectOptions = Parameters<typeof generateObject>[0];
type GenerateTextOptions = Parameters<typeof generateText>[0];

// Central entry point for AI SDK generateObject/generateText calls that should
// emit usage analytics. Workflow and outreach code should use runGenerateObject
// / runGenerateText (or inject this service directly) instead of importing
// from the `ai` package so new LLM call sites are tracked automatically.
@Injectable()
export class AiSdkExecutionService {
  constructor(private readonly aiBillingService: AiBillingService) {}

  async generateObject(
    params: AiSdkBillingContext & {
      options: GenerateObjectOptions;
    },
  ): Promise<Awaited<ReturnType<typeof generateObject>>> {
    let result: Awaited<ReturnType<typeof generateObject>> | undefined;

    try {
      result = await generateObject(params.options);

      return result;
    } finally {
      void this.billUsage({
        workspaceId: params.workspaceId,
        modelId: params.modelId,
        operationType: params.operationType,
        userWorkspaceId: params.userWorkspaceId,
        usage: result?.usage,
      });
    }
  }

  async generateText(
    params: AiSdkBillingContext & {
      options: GenerateTextOptions;
    },
  ): Promise<Awaited<ReturnType<typeof generateText>>> {
    let result: Awaited<ReturnType<typeof generateText>> | undefined;

    try {
      result = await generateText(params.options);

      return result;
    } finally {
      void this.billUsage({
        workspaceId: params.workspaceId,
        modelId: params.modelId,
        operationType: params.operationType,
        userWorkspaceId: params.userWorkspaceId,
        usage: result?.usage,
        steps: result?.steps,
      });
    }
  }

  private billUsage(params: {
    workspaceId: string | undefined | null;
    modelId: ModelId;
    operationType?: UsageOperationType;
    userWorkspaceId?: string | null;
    usage: LanguageModelUsage | undefined;
    steps?: StepResult<ToolSet>[];
  }): Promise<void> {
    if (!isDefined(params.workspaceId) || !isDefined(params.usage)) {
      return Promise.resolve();
    }

    const operationType =
      params.operationType ?? UsageOperationType.AI_WORKFLOW_TOKEN;

    if (operationType === UsageOperationType.AI_WORKFLOW_TOKEN) {
      return this.aiBillingService.billWorkflowAiSdkUsage({
        workspaceId: params.workspaceId,
        modelId: params.modelId,
        usage: params.usage,
        userWorkspaceId: params.userWorkspaceId,
        steps: params.steps,
      });
    }

    return this.aiBillingService.calculateAndBillUsage(
      params.modelId,
      {
        usage: params.usage,
        cacheCreationTokens:
          params.usage.inputTokenDetails?.cacheWriteTokens ?? 0,
      },
      params.workspaceId,
      operationType,
      null,
      params.userWorkspaceId ?? null,
    );
  }
}

export const runGenerateObject = async (
  aiSdkExecutionService: AiSdkExecutionService | undefined,
  params: AiSdkBillingContext & {
    options: GenerateObjectOptions;
  },
): Promise<Awaited<ReturnType<typeof generateObject>>> => {
  if (isDefined(aiSdkExecutionService)) {
    return aiSdkExecutionService.generateObject(params);
  }

  return generateObject(params.options);
};

export const runGenerateText = async (
  aiSdkExecutionService: AiSdkExecutionService | undefined,
  params: AiSdkBillingContext & {
    options: GenerateTextOptions;
  },
): Promise<Awaited<ReturnType<typeof generateText>>> => {
  if (isDefined(aiSdkExecutionService)) {
    return aiSdkExecutionService.generateText(params);
  }

  return generateText(params.options);
};
