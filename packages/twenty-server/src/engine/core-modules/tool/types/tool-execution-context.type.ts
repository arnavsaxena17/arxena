import { type CodeExecutionStreamEmitter } from 'src/engine/core-modules/tool-provider/interfaces/code-execution-stream-emitter.type';
import { type AgentToolConfigs } from 'twenty-shared/ai';

import { type ToolProgressStreamEmitter } from 'src/engine/core-modules/tool-provider/interfaces/tool-progress-stream-emitter.type';

export type ToolExecutionContext = {
  workspaceId: string;
  userId?: string;
  userWorkspaceId?: string;
  threadId?: string;
  onCodeExecutionUpdate?: CodeExecutionStreamEmitter;
  onToolProgress?: ToolProgressStreamEmitter;
  toolConfigs?: AgentToolConfigs | null;
};
