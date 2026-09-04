import { Injectable, Logger } from '@nestjs/common';

import {
  convertToModelMessages,
  hasToolCall,
  type LanguageModelUsage,
  stepCountIs,
  type StepResult,
  streamText,
  type SystemModelMessage,
  type ToolSet,
} from 'ai';
import { type ExtendedUIMessage, ToolCategory } from 'twenty-shared/ai';
import { type APP_LOCALES } from 'twenty-shared/translations';
import { AppPath, FileFolder } from 'twenty-shared/types';
import { getAppPath, isDefined } from 'twenty-shared/utils';

import { AI_LATENCY_MS_BUCKET_BOUNDARIES } from 'src/engine/core-modules/metrics/constants/ai-latency-ms-bucket-boundaries.constant';
import { TOOL_EXECUTION_DURATION_MS_BUCKET_BOUNDARIES } from 'src/engine/core-modules/metrics/constants/tool-execution-duration-ms-bucket-boundaries.constant';
import { TOOL_OUTPUT_TOKENS_BUCKET_BOUNDARIES } from 'src/engine/core-modules/metrics/constants/tool-output-tokens-bucket-boundaries.constant';
import { MetricsService } from 'src/engine/core-modules/metrics/metrics.service';
import { MetricsKeys } from 'src/engine/core-modules/metrics/types/metrics-keys.type';
import { UsageOperationType } from 'src/engine/core-modules/usage/enums/usage-operation-type.enum';

import { type CodeExecutionStreamEmitter } from 'src/engine/core-modules/tool-provider/interfaces/code-execution-stream-emitter.type';

import { CodeInterpreterService } from 'src/engine/core-modules/code-interpreter/code-interpreter.service';
import {
  getDisabledSearchToolNames,
  resolveSearchToolsConfig,
} from 'src/engine/core-modules/arxena-tools/utils/search-tools-config.util';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { WorkspaceDomainsService } from 'src/engine/core-modules/domain/workspace-domains/services/workspace-domains.service';
import { ExceptionHandlerService } from 'src/engine/core-modules/exception-handler/exception-handler.service';
import { FileService } from 'src/engine/core-modules/file/services/file.service';
import { ToolRegistryService } from 'src/engine/core-modules/tool-provider/services/tool-registry.service';
import {
  createExecuteToolTool,
  createLearnToolsTool,
  createLoadSkillTool,
  EXECUTE_TOOL_TOOL_NAME,
  LEARN_TOOLS_TOOL_NAME,
  LOAD_SKILL_TOOL_NAME,
} from 'src/engine/core-modules/tool-provider/tools';
import { estimateToolOutputTokens } from 'src/engine/core-modules/tool-provider/utils/estimate-tool-output-tokens.util';
import { getToolMetricName } from 'src/engine/core-modules/tool-provider/utils/get-tool-metric-name.util';
import { isToolOutputSuccessful } from 'src/engine/core-modules/tool-provider/utils/is-tool-output-successful.util';
import { resolveToolName } from 'src/engine/core-modules/tool-provider/utils/resolve-tool-name.util';
import { type WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { AgentActorContextService } from 'src/engine/metadata-modules/ai/ai-agent-execution/services/agent-actor-context.service';
import { finalizeDanglingToolParts } from 'src/engine/metadata-modules/ai/ai-agent-execution/utils/finalize-dangling-tool-parts.util';
import { guideUncallableToolCallsToMetaTool } from 'src/engine/metadata-modules/ai/ai-agent-execution/utils/guide-uncallable-tool-calls-to-meta-tool.util';
import { AGENT_CONFIG } from 'src/engine/metadata-modules/ai/ai-agent/constants/agent-config.const';
import { BrowsingContextType } from 'src/engine/metadata-modules/ai/ai-agent/types/browsingContext.type';
import { repairToolCall } from 'src/engine/metadata-modules/ai/ai-agent/utils/repair-tool-call.util';
import { AiModelConfigService } from 'src/engine/metadata-modules/ai/ai-models/services/ai-model-config.service';
import { AiBillingService } from 'src/engine/metadata-modules/ai/ai-billing/services/ai-billing.service';
import { convertDollarsToBillingCredits } from 'src/engine/metadata-modules/ai/ai-billing/utils/convert-dollars-to-billing-credits.util';
import { countNativeWebSearchCallsFromSteps } from 'src/engine/metadata-modules/ai/ai-billing/utils/count-native-web-search-calls-from-steps.util';
import {
  extractCacheCreationTokens,
  extractCacheCreationTokensFromSteps,
} from 'src/engine/metadata-modules/ai/ai-billing/utils/extract-cache-creation-tokens.util';
import { AI_CHAT_TOOL_NAMES_TO_PRELOAD } from 'src/engine/metadata-modules/ai/ai-chat/constants/ai-chat-tool-names-to-preload.const';
import {
  buildSeededOutreachWorkflowInventoryLines,
  CHAT_INTENT_SKILLS,
} from 'src/engine/metadata-modules/ai/ai-chat/constants/chat-intent-skills.const';
import { MessagePruningService } from 'src/engine/metadata-modules/ai/ai-chat/services/message-pruning.service';
import { SystemPromptBuilderService } from 'src/engine/metadata-modules/ai/ai-chat/services/system-prompt-builder.service';
import {
  ASK_QUESTIONS_TOOL_NAME,
  createAskQuestionsTool,
} from 'src/engine/metadata-modules/ai/ai-chat/tools/ask-questions.tool';
import { type ExtractedFile } from 'src/engine/metadata-modules/ai/ai-chat/types/extracted-file.type';
import { extractCodeInterpreterFiles } from 'src/engine/metadata-modules/ai/ai-chat/utils/extract-code-interpreter-files.util';
import { injectMessageTimestamps } from 'src/engine/metadata-modules/ai/ai-chat/utils/inject-message-timestamps.util';
import {
  getCacheProviderOptions,
  getCallLevelProviderOptions,
  injectCacheBreakpoint,
} from 'src/engine/metadata-modules/ai/ai-chat/utils/provider-options.util';
import { inlineFilePartsForModel } from 'src/engine/metadata-modules/ai/ai-chat/utils/inline-file-parts-for-model.util';
import { replaceUnsupportedFileParts } from 'src/engine/metadata-modules/ai/ai-chat/utils/replace-unsupported-file-parts.util';
import { AI_TELEMETRY_CONFIG } from 'src/engine/metadata-modules/ai/ai-models/constants/ai-telemetry.const';
import { AiModelRegistryService } from 'src/engine/metadata-modules/ai/ai-models/services/ai-model-registry.service';
import { NativeToolBinderService } from 'src/engine/metadata-modules/ai/ai-models/services/native-tool-binder.service';
import { type AiModelConfig } from 'src/engine/metadata-modules/ai/ai-models/types/ai-model-config.type';
import { getNativeModelCapabilities } from 'src/engine/metadata-modules/ai/ai-models/utils/get-native-model-capabilities.util';
import {
  AiException,
  AiExceptionCode,
} from 'src/engine/metadata-modules/ai/ai.exception';
import { SkillService } from 'src/engine/metadata-modules/skill/skill.service';

export type ChatExecutionOptions = {
  workspace: WorkspaceEntity;
  userWorkspaceId: string;
  threadId?: string;
  streamId?: string;
  turnId?: string;
  messages: ExtendedUIMessage[];
  browsingContext: BrowsingContextType | null;
  onCodeExecutionUpdate?: CodeExecutionStreamEmitter;
  onCompaction?: () => void;
  modelId?: string;
  abortSignal?: AbortSignal;
  conversationSizeTokens: number;
};

export type ChatExecutionResult = {
  stream: ReturnType<typeof streamText>;
  modelConfig: AiModelConfig;
  hasNoMoreAvailableCredits: () => boolean;
};

@Injectable()
export class ChatExecutionService {
  private readonly logger = new Logger(ChatExecutionService.name);

  constructor(
    private readonly toolRegistry: ToolRegistryService,
    private readonly skillService: SkillService,
    private readonly aiModelRegistryService: AiModelRegistryService,
    private readonly aiModelConfigService: AiModelConfigService,
    private readonly aiBillingService: AiBillingService,
    private readonly agentActorContextService: AgentActorContextService,
    private readonly workspaceDomainsService: WorkspaceDomainsService,
    private readonly codeInterpreterService: CodeInterpreterService,
    private readonly systemPromptBuilder: SystemPromptBuilderService,
    private readonly exceptionHandlerService: ExceptionHandlerService,
    private readonly nativeToolBinder: NativeToolBinderService,
    private readonly messagePruningService: MessagePruningService,
    private readonly metricsService: MetricsService,
    private readonly fileService: FileService,
    private readonly twentyConfigService: TwentyConfigService,
  ) {}

  async streamChat({
    workspace,
    userWorkspaceId,
    threadId,
    streamId,
    turnId,
    messages,
    browsingContext,
    onCodeExecutionUpdate,
    onCompaction,
    modelId,
    abortSignal,
    conversationSizeTokens,
  }: ChatExecutionOptions): Promise<ChatExecutionResult> {
    this.logger.log(
      `[AI_CHAT] start workspaceId=${workspace.id} ` +
        `userWorkspaceId=${userWorkspaceId} threadId=${threadId ?? 'none'} ` +
        `streamId=${streamId ?? 'none'} turnId=${turnId ?? 'none'} ` +
        `messageCount=${messages.length} conversationSizeTokens=${conversationSizeTokens} ` +
        `modelId=${modelId ?? 'workspace.smartModel'} ` +
        `browsingContext=${browsingContext?.type ?? 'none'}`,
    );

    const { actorContext, roleId, userId, userContext, workspaceMemberId } =
      await this.agentActorContextService.buildUserAndAgentActorContext(
        userWorkspaceId,
        workspace.id,
      );

    const locale = userContext.locale as keyof typeof APP_LOCALES;

    this.logger.log(
      `[AI_CHAT] actorContext roleId=${roleId} userId=${userId} ` +
        `locale=${locale} timezone=${userContext.timezone}`,
    );

    const toolContext = {
      workspaceId: workspace.id,
      roleId,
      actorContext,
      userId,
      userWorkspaceId,
      threadId,
      locale,
      onCodeExecutionUpdate,
    };

    const toolCatalog = await this.toolRegistry.buildToolIndex(
      workspace.id,
      roleId,
      { userId, userWorkspaceId, locale },
    );

    const skillCatalog = await this.skillService.findAllFlatSkills(
      workspace.id,
    );

    const arxenaCount = toolCatalog.filter(
      (entry) => entry.category === ToolCategory.ARXENA,
    ).length;
    const externalMcpCount = toolCatalog.filter(
      (entry) => entry.category === ToolCategory.EXTERNAL_MCP,
    ).length;

    const searchToolsConfig = resolveSearchToolsConfig(
      this.twentyConfigService,
    );
    const disabledSearchToolNames = new Set(
      getDisabledSearchToolNames(searchToolsConfig),
    );
    const preloadedToolNameList = AI_CHAT_TOOL_NAMES_TO_PRELOAD.filter(
      (toolName) => !disabledSearchToolNames.has(toolName),
    );

    this.logger.log(
      `[AI_CHAT] catalogs tools=${toolCatalog.length} skills=${skillCatalog.length} ` +
        `schemas_preloaded=${preloadedToolNameList.length} ` +
        `arxena=${arxenaCount} external_mcp=${externalMcpCount} ` +
        `skillNames=[${skillCatalog.map((skill) => skill.name).join(', ')}]`,
    );

    const preloadedTools = await this.toolRegistry.getToolsByName(
      preloadedToolNameList,
      toolContext,
      { compactOutput: true, spillLargeOutput: true },
    );

    const resolvedModelId = modelId ?? workspace.smartModel;

    this.aiModelRegistryService.validateModelAvailability(
      resolvedModelId,
      workspace,
    );

    const registeredModel =
      await this.aiModelRegistryService.resolveModelForAgentInWorkspace(
        { modelId: resolvedModelId },
        workspace.id,
      );

    const modelConfig = this.aiModelRegistryService.getEffectiveModelConfig(
      registeredModel.modelId,
    );

    this.logger.log(
      `[AI_CHAT] model resolvedModelId=${resolvedModelId} ` +
        `registeredModelId=${registeredModel.modelId} ` +
        `sdkPackage=${registeredModel.sdkPackage} ` +
        `contextWindowTokens=${modelConfig.contextWindowTokens} ` +
        `modalities=[${(modelConfig.modalities ?? []).join(', ')}]`,
    );

    // Native and action search may both be bound here; the model picks at runtime.
    const nativeCapabilities = getNativeModelCapabilities(
      registeredModel.sdkPackage,
    );
    const nativeTools = this.nativeToolBinder.bind(registeredModel, {
      webSearch: nativeCapabilities?.webSearch === true,
      twitterSearch: nativeCapabilities?.twitterSearch === true,
    });

    this.logger.log(
      `[AI_CHAT] nativeCapabilities webSearch=${nativeCapabilities?.webSearch === true} ` +
        `twitterSearch=${nativeCapabilities?.twitterSearch === true} ` +
        `nativeTools=[${Object.keys(nativeTools).join(', ')}] ` +
        `preloadedTools=[${Object.keys(preloadedTools).join(', ')}]`,
    );

    // Tools the model can call directly: preloaded registry tools (already
    // serialized by the hydrator) plus SDK-native tools (opaque, never
    // serialized). execute_tool routes discovered tools through the registry.
    const directTools: ToolSet = {
      ...preloadedTools,
      ...nativeTools,
    };

    const preloadedToolNames = [
      ...Object.keys(preloadedTools),
      ...Object.keys(nativeTools),
      ASK_QUESTIONS_TOOL_NAME,
    ];

    // ToolSet is constant for the entire conversation — no mutation.
    // learn_tools returns schemas as text; execute_tool dispatches via the registry.
    const activeTools: ToolSet = {
      ...directTools,
      [ASK_QUESTIONS_TOOL_NAME]: createAskQuestionsTool(),
      [LEARN_TOOLS_TOOL_NAME]: createLearnToolsTool(
        this.toolRegistry,
        toolContext,
        {
          spillLargeOutput: true,
          excludeTools: disabledSearchToolNames,
        },
      ),
      [EXECUTE_TOOL_TOOL_NAME]: createExecuteToolTool(
        this.toolRegistry,
        toolContext,
        {
          compactOutput: true,
          spillLargeOutput: true,
          excludeTools: disabledSearchToolNames,
        },
      ),
      [LOAD_SKILL_TOOL_NAME]: createLoadSkillTool(
        (skillNames) =>
          this.skillService.findFlatSkillsByNames(skillNames, workspace.id),
        async () => {
          const allSkills = await this.skillService.findAllFlatSkills(
            workspace.id,
          );

          return allSkills.map((skill) => skill.name);
        },
      ),
    };

    this.logger.log(
      `[AI_CHAT] activeTools count=${Object.keys(activeTools).length} ` +
        `names=[${Object.keys(activeTools).join(', ')}]`,
    );

    const isCodeInterpreterEnabled = this.codeInterpreterService.isEnabled();

    let processedMessages: ExtendedUIMessage[] = replaceUnsupportedFileParts(
      messages,
      modelConfig.modalities,
      isCodeInterpreterEnabled,
    );

    let storedFiles: Array<{
      filename: string;
      fileId: string;
    }> = [];

    if (isCodeInterpreterEnabled) {
      const extracted = extractCodeInterpreterFiles(processedMessages);

      processedMessages = extracted.processedMessages;

      if (extracted.extractedFiles.length > 0) {
        storedFiles = await this.storeExtractedFiles(
          extracted.extractedFiles,
          workspace.id,
        );
      }
    }

    this.logger.log(
      `[AI_CHAT] messages afterFileParts messageCount=${processedMessages.length} ` +
        `codeInterpreter=${isCodeInterpreterEnabled} storedFiles=${storedFiles.length}`,
    );

    if (isDefined(browsingContext)) {
      const contextString = this.buildContextFromBrowsingContext(
        workspace,
        browsingContext,
      );

      this.logger.log(
        `[AI_CHAT] browsingContext type=${browsingContext.type} ` +
          `contextLength=${contextString.length}`,
      );

      processedMessages = this.injectBrowsingContextIntoLastUserMessage(
        processedMessages,
        contextString,
        browsingContext.type,
      );
    }

    processedMessages = injectMessageTimestamps(
      processedMessages,
      userContext.timezone,
    );

    const connectedAccountsContext =
      await this.systemPromptBuilder.resolveLinkedinConnectedAccountsContext(
        workspace.id,
        workspaceMemberId,
      );

    this.logger.log(
      `[AI_CHAT] connectedAccounts linkedinConnected=${connectedAccountsContext.connected} ` +
        `accountId=${connectedAccountsContext.accountId ?? 'none'} ` +
        `inferredSearchType=${connectedAccountsContext.inferredSearchType ?? 'none'} ` +
        `salesNavigator=${connectedAccountsContext.salesNavigatorAvailable} ` +
        `recruiter=${connectedAccountsContext.recruiterAvailable}`,
    );

    const systemPrompt = this.systemPromptBuilder.buildFullPrompt(
      toolCatalog,
      skillCatalog,
      preloadedToolNames,
      storedFiles,
      workspace.aiAdditionalInstructions ?? undefined,
      userContext,
      connectedAccountsContext,
    );

    const providerOptions = getCacheProviderOptions(registeredModel.sdkPackage);

    this.logger.log(
      `[AI_CHAT] promptReady systemPromptLength=${systemPrompt.length} ` +
        `preloadedToolNames=[${preloadedToolNames.join(', ')}] ` +
        `hasAdditionalInstructions=${isDefined(workspace.aiAdditionalInstructions)} ` +
        `providerOptions=${JSON.stringify(providerOptions)}`,
    );

    const systemMessage: SystemModelMessage = {
      role: 'system',
      content: systemPrompt,
      providerOptions,
    };

    const sanitizedMessages = this.sanitizeMessagePartsForModel(
      processedMessages,
      new Set(Object.keys(activeTools)),
    );

    // Providers cannot fetch localhost / private signed SERVER_URL file paths
    const messagesForModel = await inlineFilePartsForModel(
      sanitizedMessages,
      async (filePart) =>
        this.fileService.getFileContentById({
          fileId: filePart.fileId,
          workspaceId: workspace.id,
          fileFolder: FileFolder.AgentChat,
        }),
    );

    const rawModelMessages = await convertToModelMessages(messagesForModel);

    this.logger.log(
      `[AI_CHAT] convertToModelMessages sanitizedCount=${messagesForModel.length} ` +
        `rawModelMessageCount=${rawModelMessages.length} ` +
        `roles=[${rawModelMessages.map((message) => message.role).join(', ')}]`,
    );

    const pruningResult =
      this.messagePruningService.pruneIfOverContextWindowLimit(
        rawModelMessages,
        modelConfig.contextWindowTokens,
        conversationSizeTokens,
      );

    this.logger.log(
      `[AI_CHAT] pruning wasPruned=${pruningResult.wasPruned} ` +
        `isStillOverLimit=${pruningResult.isStillOverLimit} ` +
        `messagesBefore=${rawModelMessages.length} ` +
        `messagesAfter=${pruningResult.messages.length} ` +
        `contextWindowTokens=${modelConfig.contextWindowTokens} ` +
        `conversationSizeTokens=${conversationSizeTokens}`,
    );

    if (pruningResult.isStillOverLimit) {
      throw new AiException(
        'This conversation is too long for the model to process. Please start a new thread.',
        AiExceptionCode.CONTEXT_WINDOW_EXCEEDED,
      );
    }

    if (pruningResult.wasPruned) {
      onCompaction?.();
    }

    const modelMessages = pruningResult.messages;

    let hasNoMoreAvailableCredits = false;
    const streamStartedAt = performance.now();
    let stepStartedAt = streamStartedAt;
    let ttftRecorded = false;
    let stepIndex = 0;

    this.logger.log(
      `[AI_CHAT] streamText starting modelMessageCount=${modelMessages.length} ` +
        `maxSteps=${AGENT_CONFIG.MAX_STEPS}`,
    );

    const emitTurnUsageEvent = async (steps: StepResult<ToolSet>[]) => {
      this.logger.log(`[AI_CHAT] emitTurnUsageEvent stepCount=${steps.length}`);

      const usage = steps.reduce<LanguageModelUsage>(
        (acc, step) => ({
          inputTokens: (acc.inputTokens ?? 0) + (step.usage.inputTokens ?? 0),
          outputTokens:
            (acc.outputTokens ?? 0) + (step.usage.outputTokens ?? 0),
          totalTokens: (acc.totalTokens ?? 0) + (step.usage.totalTokens ?? 0),
          inputTokenDetails: {
            noCacheTokens:
              (acc.inputTokenDetails?.noCacheTokens ?? 0) +
              (step.usage.inputTokenDetails?.noCacheTokens ?? 0),
            cacheReadTokens:
              (acc.inputTokenDetails?.cacheReadTokens ?? 0) +
              (step.usage.inputTokenDetails?.cacheReadTokens ?? 0),
            cacheWriteTokens:
              (acc.inputTokenDetails?.cacheWriteTokens ?? 0) +
              (step.usage.inputTokenDetails?.cacheWriteTokens ?? 0),
          },
          outputTokenDetails: {
            textTokens:
              (acc.outputTokenDetails?.textTokens ?? 0) +
              (step.usage.outputTokenDetails?.textTokens ?? 0),
            reasoningTokens:
              (acc.outputTokenDetails?.reasoningTokens ?? 0) +
              (step.usage.outputTokenDetails?.reasoningTokens ?? 0),
          },
        }),
        {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          inputTokenDetails: {
            noCacheTokens: 0,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
          },
          outputTokenDetails: { textTokens: 0, reasoningTokens: 0 },
        },
      );

      const cacheCreationTokens = extractCacheCreationTokensFromSteps(steps);
      const nativeWebSearchCalls = countNativeWebSearchCallsFromSteps(steps);
      const totalTokens =
        (usage.inputTokens ?? 0) +
        (usage.outputTokens ?? 0) +
        cacheCreationTokens;

      const costInDollars = this.aiBillingService.calculateCost(
        registeredModel.modelId,
        { usage, cacheCreationTokens },
      );
      const creditsUsedMicro = Math.round(
        convertDollarsToBillingCredits(costInDollars),
      );

      this.logger.log(
        `[AI_CHAT_TURN_USAGE] model=${registeredModel.modelId} ` +
          `steps=${steps.length} inputTokens=${usage.inputTokens ?? 0} ` +
          `outputTokens=${usage.outputTokens ?? 0} ` +
          `totalTokens=${usage.totalTokens ?? 0} ` +
          `noCacheTokens=${usage.inputTokenDetails?.noCacheTokens ?? 0} ` +
          `cacheReadTokens=${usage.inputTokenDetails?.cacheReadTokens ?? 0} ` +
          `cacheWriteTokens=${usage.inputTokenDetails?.cacheWriteTokens ?? 0} ` +
          `cacheCreationTokens=${cacheCreationTokens} ` +
          `textTokens=${usage.outputTokenDetails?.textTokens ?? 0} ` +
          `reasoningTokens=${usage.outputTokenDetails?.reasoningTokens ?? 0} ` +
          `billedTotalTokens=${totalTokens} costInDollars=${costInDollars} ` +
          `creditsUsedMicro=${creditsUsedMicro} ` +
          `nativeWebSearchCalls=${nativeWebSearchCalls} ` +
          `turnLatencyMs=${Math.round(performance.now() - streamStartedAt)}`,
      );

      await this.aiBillingService.emitAiTokenUsageEvent(
        workspace.id,
        creditsUsedMicro,
        totalTokens,
        registeredModel.modelId,
        UsageOperationType.AI_CHAT_TOKEN,
        threadId ?? null,
        userWorkspaceId,
        {
          source: 'ask-ai',
          ...(isDefined(turnId) ? { turnId } : {}),
          ...(isDefined(streamId) ? { streamId } : {}),
          inputTokens: usage.inputTokens ?? 0,
          outputTokens: usage.outputTokens ?? 0,
          cacheReadTokens: usage.inputTokenDetails?.cacheReadTokens ?? 0,
          cacheWriteTokens: usage.inputTokenDetails?.cacheWriteTokens ?? 0,
          cacheCreationTokens,
          reasoningTokens: usage.outputTokenDetails?.reasoningTokens ?? 0,
        },
      );

      // billNativeWebSearchUsage short-circuits when count <= 0, so calling
      // unconditionally is safe regardless of whether native search fired.
      void this.aiBillingService.billNativeWebSearchUsage(
        nativeWebSearchCalls,
        workspace.id,
        registeredModel.modelId,
        userWorkspaceId,
      );

      const modelAttr = { model: registeredModel.modelId };

      this.metricsService.incrementCounterBy({
        key: MetricsKeys.AiChatInputTokens,
        amount: usage.inputTokens ?? 0,
        attributes: modelAttr,
      });
      this.metricsService.incrementCounterBy({
        key: MetricsKeys.AiChatOutputTokens,
        amount: usage.outputTokens ?? 0,
        attributes: modelAttr,
      });
      this.metricsService.incrementCounterBy({
        key: MetricsKeys.AiChatCacheReadTokens,
        amount: usage.inputTokenDetails?.cacheReadTokens ?? 0,
        attributes: modelAttr,
      });
      this.metricsService.incrementCounterBy({
        key: MetricsKeys.AiChatCacheWriteTokens,
        amount: cacheCreationTokens,
        attributes: modelAttr,
      });
      this.metricsService.recordHistogram({
        key: MetricsKeys.AiChatTurnLatencyMs,
        value: performance.now() - streamStartedAt,
        unit: 'ms',
        attributes: modelAttr,
        bucketBoundaries: AI_LATENCY_MS_BUCKET_BOUNDARIES,
      });
    };

    const stream = streamText({
      model: registeredModel.model,
      messages: [systemMessage, ...modelMessages],
      tools: activeTools,
      abortSignal,
      maxOutputTokens: modelConfig.maxOutputTokens,
      stopWhen: (step) => {
        const hitMaxSteps = stepCountIs(AGENT_CONFIG.MAX_STEPS)(step);
        const askedQuestions = hasToolCall(ASK_QUESTIONS_TOOL_NAME)(step);
        const shouldStop =
          hitMaxSteps || askedQuestions || hasNoMoreAvailableCredits;

        if (shouldStop) {
          this.logger.log(
            `[AI_CHAT] stopWhen hitMaxSteps=${hitMaxSteps} ` +
              `askedQuestions=${askedQuestions} ` +
              `hasNoMoreAvailableCredits=${hasNoMoreAvailableCredits}`,
          );
        }

        return shouldStop;
      },
      experimental_telemetry: {
        ...AI_TELEMETRY_CONFIG,
        functionId: 'ai-chat-stream',
        metadata: {
          streamId: streamId ?? '',
          turnId: turnId ?? '',
          threadId: threadId ?? '',
          workspaceId: workspace.id,
        },
      },
      providerOptions: getCallLevelProviderOptions({
        sdkPackage: registeredModel.sdkPackage,
        providerOptions:
          this.aiModelConfigService.getReasoningProviderOptions(
            registeredModel,
          ),
        promptCacheKey: threadId,
      }),
      prepareStep: ({ messages: stepMessages }) => {
        stepStartedAt = performance.now();
        const nextStepIndex = stepIndex + 1;

        this.logger.log(
          `[AI_CHAT] prepareStep #${nextStepIndex} ` +
            `messageCount=${stepMessages.length} ` +
            `roles=[${stepMessages.map((message) => message.role).join(', ')}]`,
        );

        return {
          messages: injectCacheBreakpoint(
            stepMessages,
            registeredModel.sdkPackage,
          ),
        };
      },
      onChunk: ({ chunk }) => {
        if (
          !ttftRecorded &&
          (chunk.type === 'text-delta' || chunk.type === 'tool-call')
        ) {
          ttftRecorded = true;
          const ttftMs = Math.round(performance.now() - streamStartedAt);

          this.logger.log(
            `[AI_CHAT] ttftMs=${ttftMs} firstChunkType=${chunk.type}`,
          );

          this.metricsService.recordHistogram({
            key: MetricsKeys.AiChatTtftMs,
            value: performance.now() - streamStartedAt,
            unit: 'ms',
            attributes: { model: registeredModel.modelId },
            bucketBoundaries: AI_LATENCY_MS_BUCKET_BOUNDARIES,
          });
        }
      },
      experimental_onToolCallFinish: (event) => {
        this.logger.log(
          `[AI_CHAT] toolCallFinish tool=${event.toolCall.toolName} ` +
            `toolCallId=${event.toolCall.toolCallId} ` +
            `durationMs=${event.durationMs}`,
        );

        this.metricsService.recordHistogram({
          key: MetricsKeys.AiChatToolExecutionDurationMs,
          value: event.durationMs,
          unit: 'ms',
          attributes: {
            model: registeredModel.modelId,
            tool: getToolMetricName(event.toolCall.toolName),
          },
          bucketBoundaries: TOOL_EXECUTION_DURATION_MS_BUCKET_BOUNDARIES,
        });
      },
      onStepFinish: async (step) => {
        const currentStepIndex = ++stepIndex;
        const stepLatencyMs = Math.round(performance.now() - stepStartedAt);
        const toolNames = step.toolCalls.map((toolCall) => toolCall.toolName);
        const cacheCreationTokens = extractCacheCreationTokens(
          step.providerMetadata,
        );

        this.metricsService.recordHistogram({
          key: MetricsKeys.AiChatStepLatencyMs,
          value: performance.now() - stepStartedAt,
          unit: 'ms',
          attributes: { model: registeredModel.modelId },
          bucketBoundaries: AI_LATENCY_MS_BUCKET_BOUNDARIES,
        });

        this.logger.log(
          `[AI_CHAT_STEP] #${currentStepIndex} finishReason=${step.finishReason} ` +
            `latencyMs=${stepLatencyMs} toolNames=[${toolNames.join(', ')}] ` +
            `toolCallIds=[${step.toolCalls.map((toolCall) => toolCall.toolCallId).join(', ')}] ` +
            `contentPartTypes=[${step.content.map((part) => part.type).join(', ')}]`,
        );

        this.logger.log(
          `[AI_CHAT_TOKENS] step #${currentStepIndex} — ` +
            `outputTokens=${step.usage.outputTokens ?? 0}, ` +
            `reasoningTokens=${step.usage.outputTokenDetails?.reasoningTokens ?? 0}, ` +
            `textTokens=${step.usage.outputTokenDetails?.textTokens ?? 0}, ` +
            `inputTokens(fullContext)=${step.usage.inputTokens ?? 0}, ` +
            `noCacheTokens=${step.usage.inputTokenDetails?.noCacheTokens ?? 0}, ` +
            `cacheReadTokens=${step.usage.inputTokenDetails?.cacheReadTokens ?? 0}, ` +
            `cacheWriteTokens=${step.usage.inputTokenDetails?.cacheWriteTokens ?? 0}, ` +
            `cacheCreationTokens=${cacheCreationTokens}, ` +
            `totalTokens=${step.usage.totalTokens ?? 0}`,
        );

        const { hasNoMoreAvailableCredits: stepHasNoMoreAvailableCredits } =
          await this.aiBillingService.decrementAndCheckAvailableCredits(
            registeredModel.modelId,
            {
              usage: step.usage,
              cacheCreationTokens,
            },
            workspace.id,
          );

        if (stepHasNoMoreAvailableCredits) {
          hasNoMoreAvailableCredits = true;
          this.logger.warn(
            `[AI_CHAT] step #${currentStepIndex} no more available credits`,
          );
        }

        for (const part of step.content) {
          if (part.type !== 'tool-result' && part.type !== 'tool-error') {
            continue;
          }

          const succeeded =
            part.type === 'tool-result' && isToolOutputSuccessful(part.output);

          const outputTokens = estimateToolOutputTokens(
            part.type === 'tool-result' ? part.output : part.error,
          );

          const resolvedName = resolveToolName(part);

          this.logger.log(
            `[AI_CHAT] toolResult step=#${currentStepIndex} ` +
              `tool=${resolvedName} type=${part.type} succeeded=${succeeded} ` +
              `outputTokens≈${outputTokens}`,
          );

          const executionAttributes = {
            model: registeredModel.modelId,
            tool: getToolMetricName(resolvedName),
          };

          this.metricsService.incrementCounterBy({
            key: succeeded
              ? MetricsKeys.AiChatToolExecutionSucceeded
              : MetricsKeys.AiChatToolExecutionFailed,
            amount: 1,
            attributes: executionAttributes,
          });

          this.metricsService.recordHistogram({
            key: MetricsKeys.AiChatToolOutputTokens,
            value: outputTokens,
            unit: 'token',
            attributes: executionAttributes,
            bucketBoundaries: TOOL_OUTPUT_TOKENS_BUCKET_BOUNDARIES,
          });
        }
      },
      onAbort: async ({ steps }) => {
        this.logger.warn(
          `[AI_CHAT] stream aborted after ${steps.length} steps`,
        );
        await emitTurnUsageEvent(steps);
      },
      experimental_repairToolCall: async ({
        toolCall,
        tools: toolsForRepair,
        inputSchema,
        error,
      }) => {
        this.logger.warn(
          `[AI_CHAT] repairToolCall tool=${toolCall.toolName} ` +
            `toolCallId=${toolCall.toolCallId} error=${error.message}`,
        );

        return repairToolCall({
          toolCall,
          tools: toolsForRepair,
          inputSchema,
          error,
          model: registeredModel.model,
          billingContext: {
            aiBillingService: this.aiBillingService,
            modelId: registeredModel.modelId,
            workspaceId: workspace.id,
            userWorkspaceId,
            operationType: UsageOperationType.AI_CHAT_TOKEN,
          },
        });
      },
    });

    Promise.all([stream.usage, stream.steps])
      .then(async ([, steps]) => {
        this.logger.log(`[AI_CHAT] stream completed steps=${steps.length}`);
        await emitTurnUsageEvent(steps);
      })
      .catch((error) => {
        if (error?.name === 'AbortError') {
          this.logger.warn('[AI_CHAT] stream promise aborted');
          return;
        }
        this.logger.error(
          `[AI_CHAT] stream promise failed: ${error?.message ?? error}`,
        );
        this.exceptionHandlerService.captureExceptions([error]);
      });

    return {
      stream,
      modelConfig,
      hasNoMoreAvailableCredits: () => hasNoMoreAvailableCredits,
    };
  }

  private sanitizeMessagePartsForModel(
    messages: ExtendedUIMessage[],
    directlyCallableToolNames: Set<string>,
  ): ExtendedUIMessage[] {
    return messages.map((message) => ({
      ...message,
      parts: guideUncallableToolCallsToMetaTool(
        finalizeDanglingToolParts(message.parts),
        directlyCallableToolNames,
      ),
    }));
  }

  private injectBrowsingContextIntoLastUserMessage(
    messages: ExtendedUIMessage[],
    contextString: string,
    browsingContextType: BrowsingContextType['type'],
  ): ExtendedUIMessage[] {
    const lastUserIndex = messages
      .map((message) => message.role)
      .lastIndexOf('user');

    if (lastUserIndex === -1) {
      return messages;
    }

    const lastUserMessage = messages[lastUserIndex];
    const note =
      browsingContextType === 'outreachCommand'
        ? 'When the user asks to find/fetch/add/build target companies for this GTM project, follow the GTM rules below and call upsert_outreach_target_companies with this projectId. When they ask to find people (MD/CEO, buyers, etc.), call upsert_outreach_target_people — never create CRM Candidates until the user confirms Add to CRM / Enroll. Do not stop at a chat-only list.'
        : browsingContextType === 'orgChart'
          ? 'When the user asks to find, show, or highlight people or teams on this org chart, load org-structure-insights and call highlight_org_chart for this companyId. Only use this context if the user asks about the current chart.'
          : 'Only use this if the user explicitly asks about the current page, record, or view. Do not call any tools based on this context.';
    const browsingContextPart = {
      type: 'text' as const,
      text: `<browsing_context note="${note}">\n${contextString}\n</browsing_context>`,
    };

    return [
      ...messages.slice(0, lastUserIndex),
      {
        ...lastUserMessage,
        parts: [...lastUserMessage.parts, browsingContextPart],
      },
      ...messages.slice(lastUserIndex + 1),
    ];
  }

  private buildContextFromBrowsingContext(
    workspace: WorkspaceEntity,
    browsingContext: BrowsingContextType,
  ): string {
    if (browsingContext.type === 'recordPage') {
      return this.buildRecordPageContext(
        workspace,
        browsingContext.objectNameSingular,
        browsingContext.recordId,
        browsingContext.pageLayoutId,
        browsingContext.activeTabId,
      );
    }

    if (browsingContext.type === 'listView') {
      return this.buildListViewContext(browsingContext);
    }

    if (browsingContext.type === 'outreachCommand') {
      return this.buildOutreachCommandContext(browsingContext);
    }

    if (browsingContext.type === 'orgChart') {
      return this.buildOrgChartContext(browsingContext);
    }

    return '';
  }

  private buildOrgChartContext(
    browsingContext: Extract<BrowsingContextType, { type: 'orgChart' }>,
  ): string {
    const { orgStructureInsights } = CHAT_INTENT_SKILLS;

    return [
      'The user is viewing an org chart.',
      `companyId: ${browsingContext.companyId ?? 'none'}`,
      `companyName: ${browsingContext.companyName ?? 'none'}`,
      `country: ${browsingContext.country ?? 'none'}`,
      `functionRoot: ${browsingContext.functionRoot ?? 'none'}`,
      `titleQuery: ${browsingContext.titleQuery ?? 'none'}`,
      `searchTerm: ${browsingContext.searchTerm ?? 'none'}`,
      'When they ask to find, show, highlight, or map people or teams on this chart:',
      `1. load_skills(["${orgStructureInsights}"])`,
      '2. Resolve 1–3 search words that match node headlines, names, or titles',
      '3. learn_tools({toolNames:["highlight_org_chart"]}) then execute_tool with a JSON-object arguments field',
      '4. Call highlight_org_chart({ searchTerms: [...] }) before ending the turn — do not tell them to type in the search box',
      'Do not navigate to a different company unless they name one.',
    ].join('\n');
  }

  private buildOutreachCommandContext(
    browsingContext: Extract<BrowsingContextType, { type: 'outreachCommand' }>,
  ): string {
    const { search, outreach, workflowBuilding } = CHAT_INTENT_SKILLS;

    return [
      'The user is on campaign home (Find companies / people / outreach).',
      `projectId: ${browsingContext.projectId ?? 'none'}`,
      `projectName: ${browsingContext.projectName ?? 'none'}`,
      `outreachWorkflowId: ${browsingContext.outreachWorkflowId ?? 'none'}`,
      `sendMode: ${browsingContext.outreachSendMode}`,
      `phase: ${browsingContext.phase ?? 'live'}`,
      `selectedCompanyId: ${browsingContext.selectedCompanyId ?? 'none'}`,
      `selectedPersonId: ${browsingContext.selectedPersonId ?? 'none'}`,
      `icp: ${browsingContext.icpName ?? 'none'}`,
      `icpSpec: ${browsingContext.icpSpecSummary ?? 'none'}`,
      `channels: LinkedIn=${browsingContext.linkedinConnected} Gmail=${browsingContext.gmailConnected} WhatsApp=${browsingContext.whatsappConnected}`,
      ...buildSeededOutreachWorkflowInventoryLines(
        browsingContext.outreachWorkflowId,
      ),
      'Target companies on the Companies tab are ephemeral (Find destination), not CRM membership.',
      'When the user asks to find/fetch/add/build target companies:',
      `1. load_skills(["${search}"])`,
      '2. Search providers per the search skill',
      '3. learn_tools({toolNames:["upsert_outreach_target_companies"]}) then execute_tool with a JSON-object arguments field',
      '4. Call upsert_outreach_target_companies({ projectId, mode: "merge", companies: [...] }) before ending the turn',
      'Do NOT create CRM Company records for the Companies tab. Only create CRM Company when enrolling people.',
      'Target people on the People tab are ephemeral (Find) until the user selects rows and confirms Add to CRM / Enroll.',
      'When the user asks to find/fetch/search people (target titles, MD/CEO, personas) for this campaign:',
      `1. load_skills(["${search}"])`,
      '2. Search using companies from this project when relevant',
      '3. learn_tools({toolNames:["upsert_outreach_target_people"]}) then execute_tool with a JSON-object arguments field',
      '4. Call upsert_outreach_target_people({ projectId, mode: "merge", people: [...] }) before ending the turn',
      'Do NOT create_candidate / create_one_person / create_one_candidate for the People tab. CRM Candidate writes only after explicit user confirmation.',
      'When the user asks to start LinkedIn connection / outreach / enroll / send connection requests for this project:',
      `1. load_skills(["${outreach}","${workflowBuilding}"]) — treat that ask as execute authorization for enrollment`,
      '2. Prefer Project outreachWorkflowId / name "Outreach — Per Enrolled Candidate" (legacy: "Outreach — Per Enrolled Person", "GTM Outreach — Per Candidate"); clone via create_draft_from_workflow_version before editing; do not rebuild from scratch',
      '3. Candidate Links field is linkedinUrl.primaryLinkUrl (Person uses linkedinLink) — fix SEND_* templates if they still say linkedinLink',
      '4. Activate the draft, then create Candidates for ephemeral People with projectsId=projectId, outreachSequenceStage=QUEUED, linkedinUrl set',
      '5. list_workflow_runs for outreachWorkflowId and summarize — do not end the turn stuck on metadata or parse retries',
    ].join('\n');
  }

  private buildRecordPageContext(
    workspace: WorkspaceEntity,
    objectNameSingular: string,
    recordId: string,
    pageLayoutId?: string,
    activeTabId?: string | null,
  ): string {
    const resourceUrl = this.workspaceDomainsService.buildWorkspaceURL({
      workspace,
      pathname: getAppPath(AppPath.RecordShowPage, {
        objectNameSingular,
        objectRecordId: recordId,
      }),
    });

    let context = `The user is viewing a ${objectNameSingular} record (ID: ${recordId}, URL: ${resourceUrl}). Use tools to fetch record details if needed.`;

    if (isDefined(pageLayoutId)) {
      context += `\nPage layout ID: ${pageLayoutId}.`;
    }

    if (isDefined(activeTabId)) {
      context += `\nActive tab ID: ${activeTabId}.`;
    }

    return context;
  }

  private buildListViewContext(browsingContext: {
    type: 'listView';
    objectNameSingular: string;
    viewId: string;
    viewName: string;
    filterDescriptions: string[];
  }): string {
    const { objectNameSingular, viewId, viewName, filterDescriptions } =
      browsingContext;

    let context = `The user is viewing a list of ${objectNameSingular} records in a view called "${viewName}" (viewId: ${viewId}).`;

    if (filterDescriptions.length > 0) {
      context += `\nFilters applied: ${filterDescriptions.join(', ')}`;
    }

    context += `\nUse get_view_query_parameters tool with this viewId to get the exact filter/sort parameters for querying records.`;

    return context;
  }

  private async storeExtractedFiles(
    files: ExtractedFile[],
    _workspaceId: string,
  ): Promise<Array<{ filename: string; fileId: string }>> {
    return files.map((file) => ({
      filename: file.filename,
      fileId: file.fileId,
    }));
  }
}
