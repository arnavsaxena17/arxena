import { Injectable } from '@nestjs/common';

import { isDefined } from 'twenty-shared/utils';

import { MCP_EXCLUDED_TOOL_NAMES } from 'src/engine/api/mcp/constants/mcp-excluded-tool-names.const';
import {
  AgentActorContextService,
  type UserContext,
} from 'src/engine/metadata-modules/ai/ai-agent-execution/services/agent-actor-context.service';
import { SystemPromptBuilderService } from 'src/engine/metadata-modules/ai/ai-chat/services/system-prompt-builder.service';

export type McpInstructionAuthContext = {
  workspaceId: string;
  roleId: string;
  userId?: string;
  userWorkspaceId?: string;
};

@Injectable()
export class McpInstructionBuilderService {
  constructor(
    private readonly systemPromptBuilderService: SystemPromptBuilderService,
    private readonly agentActorContextService: AgentActorContextService,
  ) {}

  async buildInstructions({
    workspaceId,
    roleId,
    userId,
    userWorkspaceId,
  }: McpInstructionAuthContext): Promise<string> {
    let workspaceMemberId: string | undefined;
    let userContext: UserContext | undefined;

    if (isDefined(userWorkspaceId)) {
      try {
        const actorContext =
          await this.agentActorContextService.buildUserAndAgentActorContext(
            userWorkspaceId,
            workspaceId,
          );

        workspaceMemberId = actorContext.workspaceMemberId;
        userContext = actorContext.userContext;
      } catch {
        // API-key sessions and missing workspace members skip user/LinkedIn context.
      }
    }

    return this.systemPromptBuilderService.buildMcpInstructions({
      workspaceId,
      roleId,
      userId,
      userWorkspaceId,
      workspaceMemberId,
      userContext,
      excludeTools: MCP_EXCLUDED_TOOL_NAMES,
    });
  }
}
