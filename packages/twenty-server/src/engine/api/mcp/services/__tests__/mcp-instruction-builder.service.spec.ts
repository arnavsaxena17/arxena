import { MCP_EXCLUDED_TOOL_NAMES } from 'src/engine/api/mcp/constants/mcp-excluded-tool-names.const';
import { McpInstructionBuilderService } from 'src/engine/api/mcp/services/mcp-instruction-builder.service';
import { AgentActorContextService } from 'src/engine/metadata-modules/ai/ai-agent-execution/services/agent-actor-context.service';
import { SystemPromptBuilderService } from 'src/engine/metadata-modules/ai/ai-chat/services/system-prompt-builder.service';
import { type TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

describe('McpInstructionBuilderService', () => {
  const systemPromptBuilderService = {
    buildMcpInstructions: jest.fn().mockResolvedValue('mcp instructions'),
  };
  const agentActorContextService = {
    buildUserAndAgentActorContext: jest.fn(),
  };
  const twentyConfigService = {
    get: jest.fn().mockReturnValue(true),
  };

  const service = new McpInstructionBuilderService(
    systemPromptBuilderService as unknown as SystemPromptBuilderService,
    agentActorContextService as unknown as AgentActorContextService,
    twentyConfigService as unknown as TwentyConfigService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes role-scoped auth and excluded tools into the shared prompt builder', async () => {
    agentActorContextService.buildUserAndAgentActorContext.mockResolvedValue({
      workspaceMemberId: 'member-1',
      userContext: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        locale: 'en',
        timezone: 'UTC',
      },
    });

    const result = await service.buildInstructions({
      workspaceId: 'workspace-1',
      roleId: 'role-1',
      userId: 'user-1',
      userWorkspaceId: 'user-workspace-1',
    });

    expect(result).toBe('mcp instructions');
    expect(
      systemPromptBuilderService.buildMcpInstructions,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace-1',
        roleId: 'role-1',
        userId: 'user-1',
        userWorkspaceId: 'user-workspace-1',
        workspaceMemberId: 'member-1',
        userContext: {
          firstName: 'Ada',
          lastName: 'Lovelace',
          locale: 'en',
          timezone: 'UTC',
        },
        excludeTools: expect.any(Set),
      }),
    );
    const excludeTools = systemPromptBuilderService.buildMcpInstructions.mock
      .calls[0][0].excludeTools as Set<string>;

    for (const toolName of MCP_EXCLUDED_TOOL_NAMES) {
      expect(excludeTools.has(toolName)).toBe(true);
    }
  });

  it('skips LinkedIn/user context for API-key sessions without a user workspace', async () => {
    await service.buildInstructions({
      workspaceId: 'workspace-1',
      roleId: 'admin-role',
    });

    expect(
      agentActorContextService.buildUserAndAgentActorContext,
    ).not.toHaveBeenCalled();
    expect(
      systemPromptBuilderService.buildMcpInstructions,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceMemberId: undefined,
        userContext: undefined,
        excludeTools: expect.any(Set),
      }),
    );
    const excludeTools = systemPromptBuilderService.buildMcpInstructions.mock
      .calls[0][0].excludeTools as Set<string>;

    for (const toolName of MCP_EXCLUDED_TOOL_NAMES) {
      expect(excludeTools.has(toolName)).toBe(true);
    }
  });
});
