import { type CodeExecutionStreamEmitter } from 'src/engine/core-modules/tool-provider/interfaces/code-execution-stream-emitter.type';
import { type AgentToolConfigs } from 'twenty-shared/ai';

import { type ToolProgressStreamEmitter } from 'src/engine/core-modules/tool-provider/interfaces/tool-progress-stream-emitter.type';

export type ToolExecutionContext = {
  workspaceId: string;
  // The member's role, for a tool that calls other tools on their behalf
  // (the sourcing loop's rounds)
  roleId?: string;
  userId?: string;
  userWorkspaceId?: string;
  threadId?: string;
  turnId?: string;
  // The Outreach project the user is looking at, from the browsing context
  projectId?: string;
  onCodeExecutionUpdate?: CodeExecutionStreamEmitter;
  onToolProgress?: ToolProgressStreamEmitter;
  toolConfigs?: AgentToolConfigs | null;
};
