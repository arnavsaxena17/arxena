import { type CodeExecutionStreamEmitter } from 'src/engine/core-modules/tool-provider/interfaces/code-execution-stream-emitter.type';
import { type AgentToolConfigs } from 'twenty-shared/ai';

export type ToolExecutionContext = {
  workspaceId: string;
  userId?: string;
  userWorkspaceId?: string;
  threadId?: string;
  onCodeExecutionUpdate?: CodeExecutionStreamEmitter;
  toolConfigs?: AgentToolConfigs | null;
};
