import { isDefined } from '@/utils/validation/isDefined';

export type CodeExecutionFile = {
  fileId: string;
  filename: string;
  url: string;
  mimeType: string;
};

export type ExtendedFileUIPart = {
  type: 'file';
  mediaType: string;
  filename?: string;
  url: string;
  fileId: string;
};

export const isExtendedFileUIPart = (
  part: Record<string, unknown>,
): part is ExtendedFileUIPart => {
  return (
    part.type === 'file' &&
    isDefined(part.fileId) &&
    isDefined(part.url) &&
    isDefined(part.mediaType)
  );
};

export type CodeExecutionState = 'pending' | 'running' | 'completed' | 'error';

export type CodeExecutionData = {
  executionId: string;
  state: CodeExecutionState;
  code: string;
  language: 'python';
  stdout: string;
  stderr: string;
  exitCode?: number;
  executionTimeMs?: number;
  files: CodeExecutionFile[];
  error?: string;
};

export type ToolProgressState = 'running' | 'completed' | 'error';

// Live status of a long tool call, so the chat shows it is still working
export type ToolProgressData = {
  progressId: string;
  toolName: string;
  state: ToolProgressState;
  message: string;
  current?: number;
  total?: number;
  elapsedMs?: number;
  // Most recent notable events (failures, phase changes), newest last
  logs?: string[];
};

export type DataMessagePart = {
  'routing-status': {
    text: string;
    state: string;
    debug?: {
      routingTimeMs?: number;
      contextBuildTimeMs?: number;
      agentExecutionStartTimeMs?: number;
      agentExecutionTimeMs?: number;
      toolGenerationTimeMs?: number;
      agentContextBuildTimeMs?: number;
      aiRequestPrepTimeMs?: number;
      selectedAgentId?: string;
      selectedAgentLabel?: string;
      availableAgents?: Array<{ id: string; label: string }>;
      fastModel?: string;
      smartModel?: string;
      agentModel?: string;
      context?: string;
      contextRecordCount?: number;
      contextSizeBytes?: number;
      toolCallCount?: number;
      toolCount?: number;
      // Routing AI call tokens
      routingPromptTokens?: number;
      routingCompletionTokens?: number;
      routingTotalTokens?: number;
      // Agent AI call tokens
      agentPromptTokens?: number;
      agentCompletionTokens?: number;
      agentTotalTokens?: number;
      // Cost in Twenty credits
      routingCostInCredits?: number;
      agentCostInCredits?: number;
      totalCostInCredits?: number;
      // Plan execution
      planReasoning?: string;
      totalSteps?: number;
      steps?: Array<{
        stepNumber: number;
        agent: string;
        task: string;
      }>;
    };
  };
  'code-execution': CodeExecutionData;
  'tool-progress': ToolProgressData;
  'thread-title': { title: string };
  compaction: Record<string, never>;
};
