import {
  type AiAgentStepLogDetails,
  type WorkflowRunStepLog,
} from 'twenty-shared/workflow';

import { type AgentExecutionResult } from 'src/engine/metadata-modules/ai/ai-agent-execution/types/agent-execution-result.type';
import { mapAiStepsToToolCallLogs } from 'src/engine/metadata-modules/ai/ai-agent-execution/utils/map-ai-steps-to-tool-call-logs.util';
import { type AiAgentOutputValidationReport } from 'src/modules/workflow/workflow-executor/workflow-actions/ai-agent/utils/ai-agent-output-validation.util';

export const buildAiAgentStepLog = ({
  executionResult,
  durationMs,
  outputValidation,
}: {
  executionResult: AgentExecutionResult;
  durationMs: number;
  outputValidation?: AiAgentOutputValidationReport;
}): WorkflowRunStepLog | null => {
  if (!executionResult.modelId) {
    return null;
  }

  const toolCalls = executionResult.steps
    ? mapAiStepsToToolCallLogs(executionResult.steps)
    : [];

  const details: AiAgentStepLogDetails = {
    type: 'AI_AGENT',
    modelId: executionResult.modelId,
    usage: {
      inputTokens: executionResult.usage.inputTokens ?? 0,
      outputTokens: executionResult.usage.outputTokens ?? 0,
      reasoningTokens:
        executionResult.usage.outputTokenDetails?.reasoningTokens,
      cacheReadTokens: executionResult.usage.inputTokenDetails?.cacheReadTokens,
      cacheCreationTokens: executionResult.cacheCreationTokens,
      totalTokens:
        (executionResult.usage.totalTokens ?? 0) +
        executionResult.cacheCreationTokens,
    },
    cost: {
      totalCostInDollars: executionResult.totalCostInDollars ?? 0,
      creditsUsedMicro: executionResult.creditsUsedMicro ?? 0,
    },
    nativeWebSearchCallCount: executionResult.nativeWebSearchCallCount,
    toolCalls,
    durationMs,
    ...(outputValidation ? { outputValidation } : {}),
  };

  return {
    details,
    entries: [],
    sizeBytes: 0,
  };
};
