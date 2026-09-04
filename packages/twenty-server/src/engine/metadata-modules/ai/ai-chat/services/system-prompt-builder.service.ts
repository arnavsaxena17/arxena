import { Injectable, Logger } from '@nestjs/common';

import {
  assertUnreachable,
  getValidTimeZoneOrUndefined,
  isDefined,
} from 'twenty-shared/utils';

import { LinkedinUnipileRequestService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-request.service';
import {
  ARXENA_TOOL_CATALOG,
  type ArxenaToolPack,
} from 'src/engine/core-modules/arxena-tools/constants/arxena-tool-catalog.const';
import { COMMON_PRELOAD_TOOLS } from 'src/engine/core-modules/tool-provider/constants/common-preload-tools.const';
import { ToolCategory } from 'twenty-shared/ai';
import { ToolRegistryService } from 'src/engine/core-modules/tool-provider/services/tool-registry.service';
import {
  EXECUTE_TOOL_TOOL_NAME,
  LEARN_TOOLS_TOOL_NAME,
  LOAD_SKILL_TOOL_NAME,
} from 'src/engine/core-modules/tool-provider/tools';
import { type ToolIndexEntry } from 'src/engine/core-modules/tool-provider/types/tool-index-entry.type';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import {
  AgentActorContextService,
  type UserContext,
} from 'src/engine/metadata-modules/ai/ai-agent-execution/services/agent-actor-context.service';
import { CHAT_SYSTEM_PROMPTS } from 'src/engine/metadata-modules/ai/ai-chat/constants/chat-system-prompts.const';
import { type FlatSkill } from 'src/engine/metadata-modules/flat-skill/types/flat-skill.type';
import { SkillService } from 'src/engine/metadata-modules/skill/skill.service';

export type SystemPromptSection = {
  title: string;
  content: string;
  estimatedTokenCount: number;
};

export type SystemPromptPreview = {
  sections: SystemPromptSection[];
  estimatedTokenCount: number;
};

export type LinkedinConnectedAccountsContext = {
  connected: boolean;
  accountId: string | null;
  inferredSearchType: 'classic' | 'sales_navigator' | 'recruiter' | null;
  salesNavigatorAvailable: boolean;
  recruiterAvailable: boolean;
};

// ~4 characters per token for mixed English/code content
const estimateTokenCount = (text: string): number => Math.ceil(text.length / 4);

@Injectable()
export class SystemPromptBuilderService {
  private readonly logger = new Logger(SystemPromptBuilderService.name);

  constructor(
    private readonly toolRegistry: ToolRegistryService,
    private readonly skillService: SkillService,
    private readonly agentActorContextService: AgentActorContextService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly linkedinUnipileRequestService: LinkedinUnipileRequestService,
  ) {}

  async buildPreview(
    workspaceId: string,
    userWorkspaceId: string,
    workspaceInstructions?: string,
  ): Promise<SystemPromptPreview> {
    const { roleId, userId, userContext, workspaceMemberId } =
      await this.agentActorContextService.buildUserAndAgentActorContext(
        userWorkspaceId,
        workspaceId,
      );

    const toolCatalog = await this.toolRegistry.buildToolIndex(
      workspaceId,
      roleId,
      { userId, userWorkspaceId },
    );

    const skillCatalog = await this.skillService.findAllFlatSkills(workspaceId);
    const connectedAccountsContext =
      await this.resolveLinkedinConnectedAccountsContext(
        workspaceId,
        workspaceMemberId,
      );

    const sections: SystemPromptSection[] = [];

    const baseContent = [
      CHAT_SYSTEM_PROMPTS.CORE,
      CHAT_SYSTEM_PROMPTS.CHAT_UI,
    ].join('\n');

    sections.push({
      title: 'Base Instructions',
      content: baseContent,
      estimatedTokenCount: estimateTokenCount(baseContent),
    });

    const responseFormatContent = CHAT_SYSTEM_PROMPTS.RESPONSE_FORMAT;

    sections.push({
      title: 'Response Format',
      content: responseFormatContent,
      estimatedTokenCount: estimateTokenCount(responseFormatContent),
    });

    if (workspaceInstructions) {
      const workspaceSection = this.buildWorkspaceInstructionsSection(
        workspaceInstructions,
      );

      sections.push({
        title: 'Workspace Instructions',
        content: workspaceSection,
        estimatedTokenCount: estimateTokenCount(workspaceSection),
      });
    }

    if (userContext) {
      const userSection = this.buildUserContextSection(userContext);

      sections.push({
        title: 'User Context',
        content: userSection,
        estimatedTokenCount: estimateTokenCount(userSection),
      });
    }

    const connectedAccountsSection = this.buildConnectedAccountsSection(
      connectedAccountsContext,
    );

    sections.push({
      title: 'Connected Accounts',
      content: connectedAccountsSection,
      estimatedTokenCount: estimateTokenCount(connectedAccountsSection),
    });

    const toolSection = this.buildToolCatalogSection(
      toolCatalog,
      COMMON_PRELOAD_TOOLS,
    );

    sections.push({
      title: 'Tool Catalog',
      content: toolSection,
      estimatedTokenCount: estimateTokenCount(toolSection),
    });

    const skillSection = this.buildSkillCatalogSection(skillCatalog);

    if (skillSection) {
      sections.push({
        title: 'Skill Catalog',
        content: skillSection,
        estimatedTokenCount: estimateTokenCount(skillSection),
      });
    }

    const totalTokens = sections.reduce(
      (sum, section) => sum + section.estimatedTokenCount,
      0,
    );

    return {
      sections,
      estimatedTokenCount: totalTokens,
    };
  }

  buildFullPrompt(
    toolCatalog: ToolIndexEntry[],
    skillCatalog: FlatSkill[],
    preloadedTools: string[],
    storedFiles?: Array<{
      filename: string;
      fileId: string;
    }>,
    workspaceInstructions?: string,
    userContext?: UserContext,
    connectedAccountsContext?: LinkedinConnectedAccountsContext,
  ): string {
    const parts: string[] = [
      CHAT_SYSTEM_PROMPTS.CORE,
      CHAT_SYSTEM_PROMPTS.CHAT_UI,
      CHAT_SYSTEM_PROMPTS.BROWSING_CONTEXT_INSTRUCTION,
      CHAT_SYSTEM_PROMPTS.RESPONSE_FORMAT,
    ];

    if (workspaceInstructions) {
      parts.push(this.buildWorkspaceInstructionsSection(workspaceInstructions));
    }

    if (userContext) {
      parts.push(this.buildUserContextSection(userContext));
    }

    if (connectedAccountsContext) {
      parts.push(this.buildConnectedAccountsSection(connectedAccountsContext));
    }

    parts.push(this.buildToolCatalogSection(toolCatalog, preloadedTools));
    parts.push(this.buildSkillCatalogSection(skillCatalog));

    if (storedFiles && storedFiles.length > 0) {
      parts.push(this.buildUploadedFilesSection(storedFiles));
    }

    return parts.join('\n');
  }

  async buildMcpInstructions({
    workspaceId,
    roleId,
    userId,
    userWorkspaceId,
    workspaceMemberId,
    userContext,
    excludeTools,
    preloadedTools = COMMON_PRELOAD_TOOLS,
  }: {
    workspaceId: string;
    roleId: string;
    userId?: string;
    userWorkspaceId?: string;
    workspaceMemberId?: string;
    userContext?: UserContext;
    excludeTools?: Set<string>;
    preloadedTools?: string[];
  }): Promise<string> {
    const toolCatalog = await this.toolRegistry.buildToolIndex(
      workspaceId,
      roleId,
      { userId, userWorkspaceId },
    );

    const skillCatalog = await this.skillService.findAllFlatSkills(workspaceId);

    const parts: string[] = [
      CHAT_SYSTEM_PROMPTS.CORE,
      CHAT_SYSTEM_PROMPTS.MCP_TRANSPORT,
    ];

    if (userContext) {
      parts.push(this.buildUserContextSection(userContext));
    }

    if (isDefined(workspaceMemberId)) {
      const connectedAccountsContext =
        await this.resolveLinkedinConnectedAccountsContext(
          workspaceId,
          workspaceMemberId,
        );

      parts.push(this.buildConnectedAccountsSection(connectedAccountsContext));
    }

    parts.push(
      this.buildMcpCompactToolCatalogSection(
        toolCatalog,
        preloadedTools,
        excludeTools,
      ),
    );
    parts.push(this.buildSkillCatalogSection(skillCatalog));

    return parts.join('\n');
  }

  async resolveLinkedinConnectedAccountsContext(
    workspaceId: string,
    workspaceMemberId: string,
  ): Promise<LinkedinConnectedAccountsContext> {
    const disconnected: LinkedinConnectedAccountsContext = {
      connected: false,
      accountId: null,
      inferredSearchType: null,
      salesNavigatorAvailable: false,
      recruiterAvailable: false,
    };

    try {
      const accountId =
        await this.workspaceQueryService.getWorkspaceMemberLinkedinUnipileAccountId(
          workspaceId,
          workspaceMemberId,
        );

      if (!accountId) {
        return disconnected;
      }

      const account =
        await this.linkedinUnipileRequestService.fetchAccountByIdIfExists(
          accountId,
        );

      if (!account) {
        return {
          ...disconnected,
          accountId,
        };
      }

      const capabilities =
        await this.linkedinUnipileRequestService.inferLinkedinSearchTypeForAccount(
          accountId,
        );

      return {
        connected: true,
        accountId,
        inferredSearchType: capabilities?.inferredSearchType ?? 'classic',
        salesNavigatorAvailable:
          capabilities?.salesNavigatorAvailable ?? false,
        recruiterAvailable: capabilities?.recruiterAvailable ?? false,
      };
    } catch (error) {
      this.logger.warn(
        `Failed to resolve LinkedIn connected accounts for workspaceMemberId=${workspaceMemberId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return disconnected;
    }
  }

  buildWorkspaceInstructionsSection(instructions: string): string {
    return `
    ## Workspace Instructions

    The following are custom instructions provided by the workspace administrator:

    ${instructions}`;
  }

  buildUserContextSection(userContext: UserContext): string {
    const parts = [
      `User: ${userContext.firstName} ${userContext.lastName}`.trim(),
      `Locale: ${userContext.locale}`,
    ];

    const resolvedTimeZone = getValidTimeZoneOrUndefined(userContext.timezone);

    if (resolvedTimeZone) {
      parts.push(`Timezone: ${resolvedTimeZone}`);
    }

    parts.push(`Current date: ${this.formatCurrentDate(userContext.timezone)}`);

    return `
    ## User Context

    ${parts.join('\n')}`;
  }

  buildConnectedAccountsSection(
    connectedAccountsContext: LinkedinConnectedAccountsContext,
  ): string {
    const availableSearchTypes = ['classic'];

    if (connectedAccountsContext.salesNavigatorAvailable) {
      availableSearchTypes.push('sales_navigator');
    }

    if (connectedAccountsContext.recruiterAvailable) {
      availableSearchTypes.push('recruiter');
    }

    const lines = connectedAccountsContext.connected
      ? [
          `- LinkedIn (Unipile): connected (account_id=${connectedAccountsContext.accountId})`,
          `- Preferred searchType: ${connectedAccountsContext.inferredSearchType ?? 'classic'}`,
          `- Search types available: ${availableSearchTypes.join(', ')}`,
          `- Sales Navigator: ${connectedAccountsContext.salesNavigatorAvailable ? 'available' : 'not available'}`,
          `- Recruiter: ${connectedAccountsContext.recruiterAvailable ? 'available' : 'not available'}`,
          `- Only use searchType values listed as available. If the user asks for Sales Nav or Recruiter and it is not available, explain that and fall back to classic or Harvest.`,
        ]
      : [
          `- LinkedIn (Unipile): not connected${
            connectedAccountsContext.accountId
              ? ` (stale account_id=${connectedAccountsContext.accountId})`
              : ''
          }`,
          `- Search types available: none via Unipile`,
          `- Do not call search_linkedin_* tools until the user connects LinkedIn. Prefer Harvest People API (dataSource: "harvest") when appropriate, or ask the user to connect LinkedIn.`,
        ];

    return `
    ## Connected Accounts

    Runtime LinkedIn connection status for the current user. Read this before choosing Unipile searchType.
    ${lines.join('\n')}`;
  }

  private formatCurrentDate(timezone: string | null): string {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: getValidTimeZoneOrUndefined(timezone),
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date());
  }

  buildUploadedFilesSection(
    storedFiles: Array<{ filename: string; fileId: string }>,
  ): string {
    const fileList = storedFiles.map((f) => `- ${f.filename}`).join('\n');

    const filesJson = JSON.stringify(
      storedFiles.map((f) => ({ filename: f.filename, fileId: f.fileId })),
    );

    return `
    ## Uploaded Files

    The user has uploaded the following files:
    ${fileList}

    **IMPORTANT**: Use the \`code_interpreter\` tool to analyze these files.
    When calling code_interpreter, include the files parameter with these values (use fileId to reference uploaded files):
    \`\`\`json
    ${filesJson}
    \`\`\`

    In your Python code, access files at \`/home/user/{filename}\`.`;
  }

  buildSkillCatalogSection(skillCatalog: FlatSkill[]): string {
    if (skillCatalog.length === 0) {
      return '';
    }

    const skillsList = skillCatalog
      .map(
        (skill) => `- \`${skill.name}\`: ${skill.description ?? skill.label}`,
      )
      .join('\n');

    return `
    ## Available Skills

    Skills provide detailed expertise for specialized tasks. Load a skill before attempting complex operations.
    To load a skill, call \`${LOAD_SKILL_TOOL_NAME}\` with the skill name(s).

    ${skillsList}`;
  }

  buildMcpCompactToolCatalogSection(
    toolCatalog: ToolIndexEntry[],
    preloadedTools: string[],
    excludeTools?: Set<string>,
  ): string {
    const filteredCatalog = excludeTools
      ? toolCatalog.filter((entry) => !excludeTools.has(entry.name))
      : toolCatalog;

    const filteredPreloaded = excludeTools
      ? preloadedTools.filter((name) => !excludeTools.has(name))
      : preloadedTools;

    const preloadedSet = new Set(filteredPreloaded);
    const toolsByCategory = new Map<string, ToolIndexEntry[]>();

    for (const tool of filteredCatalog) {
      const existing = toolsByCategory.get(tool.category) ?? [];

      existing.push(tool);
      toolsByCategory.set(tool.category, existing);
    }

    const sections: string[] = [];
    const preloadedList =
      filteredPreloaded.length > 0
        ? filteredPreloaded.map((toolName) => `- \`${toolName}\` ✓`).join('\n')
        : '(none)';

    sections.push(`
      ## Available Tools

      You have access to ${filteredCatalog.length} tools via \`learn_tools\` / \`execute_tool\`. They are NOT bound as top-level MCP tools.
      Construct CRUD names from the grammar below. Load a skill for GTM/workflow/metadata tool names.

      ### Pre-loaded Tools (ready to use now)
      ${preloadedList}`);

    const crudTools = toolsByCategory.get(ToolCategory.DATABASE_CRUD);

    if (crudTools && crudTools.length > 0) {
      sections.push(
        this.buildDatabaseCrudCatalogSection(
          crudTools,
          preloadedSet,
          this.getCategoryLabel(ToolCategory.DATABASE_CRUD),
        ),
      );
    }

    const arxenaTools = toolsByCategory.get(ToolCategory.ARXENA);

    if (arxenaTools && arxenaTools.length > 0) {
      sections.push(this.buildArxenaPackCatalogSection(arxenaTools.length));
    }

    const categoryOrder = Object.values(ToolCategory).filter(
      (category) =>
        category !== ToolCategory.DATABASE_CRUD &&
        category !== ToolCategory.ARXENA,
    );

    for (const category of categoryOrder) {
      const tools = toolsByCategory.get(category);

      if (!tools || tools.length === 0) {
        continue;
      }

      const categoryLabel = this.getCategoryLabel(category);

      sections.push(`
      #### ${categoryLabel} (${tools.length} tools)
      ${tools
        .map((tool) => {
          const status = preloadedSet.has(tool.name) ? ' ✓' : '';

          return `- \`${tool.name}\`${status}`;
        })
        .join('\n')}`);
    }

    sections.push(`
      ### How to Use Tools
      1. **Pre-loaded tools** (marked with ✓): Use directly
      2. **Other tools**: First call \`${LEARN_TOOLS_TOOL_NAME}({toolNames: ["tool_name"]})\` to learn the schema, then call \`${EXECUTE_TOOL_TOOL_NAME}({toolName: "tool_name", arguments: {...}})\` to run it`);

    return sections.join('\n');
  }

  private buildArxenaPackCatalogSection(toolCount: number): string {
    const packLabels: Record<ArxenaToolPack, string> = {
      prospecting: 'people/company search',
      enrichment: 'emails/phones',
      orgchart: 'account maps',
      outreach: 'messaging',
      accounts: 'companies/contacts/projects',
      crm_workspace: 'workspace helpers',
      general: 'general',
    };

    const packs = [
      ...new Set(ARXENA_TOOL_CATALOG.map((entry) => entry.pack)),
    ].sort();

    const packLines = packs
      .map((pack) => `- \`${pack}\`: ${packLabels[pack]}`)
      .join('\n');

    return `
      #### ${this.getCategoryLabel(ToolCategory.ARXENA)} (${toolCount} tools)
      Exact names come from the matching skill after \`load_skills\`. Do not \`learn_tools\` this whole pack list.

      Packs:
      ${packLines}

      Preferred tools (learn only these unless a skill names others):
      - \`get_org_chart\`
      - \`get_org_chart_node_people\`
      - \`check_contact_availability\`
      - \`fetch_contacts\``;
  }

  buildToolCatalogSection(
    toolCatalog: ToolIndexEntry[],
    preloadedTools: string[],
  ): string {
    const preloadedSet = new Set(preloadedTools);

    const toolsByCategory = new Map<string, ToolIndexEntry[]>();

    for (const tool of toolCatalog) {
      const category = tool.category;
      const existing = toolsByCategory.get(category) ?? [];

      existing.push(tool);
      toolsByCategory.set(category, existing);
    }

    const sections: string[] = [];

    const preloadedList =
      preloadedTools.length > 0
        ? preloadedTools.map((toolName) => `- \`${toolName}\` ✓`).join('\n')
        : '(none)';

    sections.push(`
      ## Available Tools

      You have access to ${toolCatalog.length} tools. Some are pre-loaded and ready to use immediately.
      To use any other tool, first call \`${LEARN_TOOLS_TOOL_NAME}\` to learn its schema, then call \`${EXECUTE_TOOL_TOOL_NAME}\` to run it.

      ### Pre-loaded Tools (ready to use now)
      ${preloadedList}

      ### Tool Catalog by Category`);

    const crudTools = toolsByCategory.get(ToolCategory.DATABASE_CRUD);

    if (crudTools && crudTools.length > 0) {
      sections.push(
        this.buildDatabaseCrudCatalogSection(
          crudTools,
          preloadedSet,
          this.getCategoryLabel(ToolCategory.DATABASE_CRUD),
        ),
      );
    }

    const arxenaTools = toolsByCategory.get(ToolCategory.ARXENA);

    if (arxenaTools && arxenaTools.length > 0) {
      sections.push(this.buildArxenaPackCatalogSection(arxenaTools.length));
    }

    const categoryOrder = Object.values(ToolCategory).filter(
      (category) =>
        category !== ToolCategory.DATABASE_CRUD &&
        category !== ToolCategory.ARXENA,
    );

    for (const category of categoryOrder) {
      const tools = toolsByCategory.get(category);

      if (!tools || tools.length === 0) {
        continue;
      }

      const categoryLabel = this.getCategoryLabel(category);

      sections.push(`
      #### ${categoryLabel} (${tools.length} tools)
      ${tools
        .map((tool) => {
          const status = preloadedSet.has(tool.name) ? ' ✓' : '';

          return `- \`${tool.name}\`${status}`;
        })
        .join('\n')}`);
    }

    sections.push(`
      ### How to Use Tools
      1. **Pre-loaded tools** (marked with ✓): Use directly
      2. **Other tools**: First call \`${LEARN_TOOLS_TOOL_NAME}({toolNames: ["tool_name"]})\` to learn the schema, then call \`${EXECUTE_TOOL_TOOL_NAME}({toolName: "tool_name", arguments: {...}})\` to run it`);

    return sections.join('\n');
  }

  private buildDatabaseCrudCatalogSection(
    tools: ToolIndexEntry[],
    preloadedSet: Set<string>,
    categoryLabel: string,
  ): string {
    const operationOrder: string[] = [];
    const seenOps = new Set<string>();

    const objectToolsMap = new Map<string, string[]>();
    const standaloneTools: ToolIndexEntry[] = [];

    for (const tool of tools) {
      if (tool.objectName && tool.operation) {
        const ops = objectToolsMap.get(tool.objectName) ?? [];

        ops.push(tool.operation);
        objectToolsMap.set(tool.objectName, ops);

        if (!seenOps.has(tool.operation)) {
          seenOps.add(tool.operation);
          operationOrder.push(tool.operation);
        }
      } else {
        standaloneTools.push(tool);
      }
    }

    const lines: string[] = [`\n#### ${categoryLabel} (${tools.length} tools)`];

    if (objectToolsMap.size > 0) {
      const objectNames = [...objectToolsMap.keys()].sort();

      lines.push(`Operations per object:`);
      lines.push(...operationOrder.map((op) => `- \`${op}_{object}\``));

      lines.push(`\nObjects (${objectNames.length}):`);
      lines.push(...objectNames.map((name) => `- \`${name}\``));

      const findManyExample = tools.find((t) => t.operation === 'find_many');
      const findOneExample = tools.find(
        (t) =>
          t.operation === 'find_one' &&
          t.objectName === findManyExample?.objectName,
      );
      const examplePart =
        findManyExample && findOneExample
          ? ` e.g. \`${findManyExample.name}\` / \`${findOneExample.name}\``
          : '';

      lines.push(
        `\nTool name = operation + object name. *_many_* operations use the plural form, *_one_* use the singular form.${examplePart}`,
      );
    }

    for (const tool of standaloneTools) {
      const status = preloadedSet.has(tool.name) ? ' ✓' : '';

      lines.push(`- \`${tool.name}\`${status}`);
    }

    return lines.join('\n');
  }

  private getCategoryLabel(category: ToolCategory): string {
    switch (category) {
      case ToolCategory.DATABASE_CRUD:
        return 'Database Tools (CRUD operations)';
      case ToolCategory.ACTION:
        return 'Action Tools (HTTP, Email, etc.)';
      case ToolCategory.WORKFLOW:
        return 'Workflow Tools (create/manage workflows)';
      case ToolCategory.METADATA:
        return 'Metadata Tools (schema management)';
      case ToolCategory.VIEW:
        return 'View Tools (manage views, fields, filters, and sorts)';
      case ToolCategory.DASHBOARD:
        return 'Dashboard Tools (create/manage dashboards)';
      case ToolCategory.LOGIC_FUNCTION:
        return 'Logic Functions (custom / native workflow actions)';
      case ToolCategory.NAVIGATION_MENU_ITEM:
        return 'Navigation Menu Item Tools (sidebar entries, folders, and user favorites)';
      case ToolCategory.WEBHOOK:
        return 'Webhook Tools (outgoing webhooks)';
      case ToolCategory.ARXENA:
        return 'Prospecting & enrichment (first-party packs)';
      case ToolCategory.EXTERNAL_MCP:
        return 'Connected apps (workspace MCP servers)';
      default:
        return assertUnreachable(category);
    }
  }
}
