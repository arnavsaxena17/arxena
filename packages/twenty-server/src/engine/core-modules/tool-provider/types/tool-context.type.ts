import { type ToolProgressStreamEmitter } from 'src/engine/core-modules/tool-provider/interfaces/tool-progress-stream-emitter.type';
import { type ActorMetadata } from 'twenty-shared/types';
import { type APP_LOCALES } from 'twenty-shared/translations';

import { type CodeExecutionStreamEmitter } from 'src/engine/core-modules/tool-provider/interfaces/code-execution-stream-emitter.type';

import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';

export type ToolContext = {
  workspaceId: string;
  roleId: string;
  authContext?: WorkspaceAuthContext;
  actorContext?: ActorMetadata;
  userId?: string;
  userWorkspaceId?: string;
  threadId?: string;
  // The chat turn, so provider requests can be traced back to it
  turnId?: string;
  // The Outreach project the user is looking at, from the browsing context
  projectId?: string;
  locale?: keyof typeof APP_LOCALES;
  onCodeExecutionUpdate?: CodeExecutionStreamEmitter;
  onToolProgress?: ToolProgressStreamEmitter;
};
