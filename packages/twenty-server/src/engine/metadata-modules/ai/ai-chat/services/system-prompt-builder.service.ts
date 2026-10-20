import { Injectable, Logger } from '@nestjs/common';

import {
  assertUnreachable,
  getValidTimeZoneOrUndefined,
} from 'twenty-shared/utils';

import { LinkedinUnipileRequestService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-request.service';
import { COMMON_PRELOAD_TOOLS } from 'src/engine/core-modules/tool-provider/constants/common-preload-tools.const';
import { ToolCategory } from 'twenty-shared/ai';
import { ToolRegistryService } from 'src/engine/core-modules/tool-provider/services/tool-registry.service';
import {
  EXECUTE_TOOL_TOOL_NAME,
  LEARN_TOOLS_TOOL_NAME,
  LOAD_SKILL_TOOL_NAME,
} from 'src/engine/core-modules/tool-provider/tools';
import { GET_TOOL_CATALOG_TOOL_NAME } from 'src/engine/core-modules/tool-provider/tools/get-tool-catalog.tool';
import { type ToolIndexEntry } from 'src/engine/core-modules/tool-provider/types/tool-index-entry.type';
import { getExternalMcpServerSlug } from 'src/engine/core-modules/tool-provider/utils/build-tool-catalog-response.util';
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

// Categories above this size are summarized instead of listing every tool name
const LARGE_CATEGORY_TOOL_LIST_THRESHOLD = 15;

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
    const { roleId, userId, userContext } =
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

    const contextSection = this.buildContextSection({
      userContext,
      workspaceInstructions,
      includeBrowsingContext: true,
    });

    sections.push({
      title: 'Context',
      content: contextSection,
      estimatedTokenCount: estimateTokenCount(contextSection),
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
  ): string {
    const parts: string[] = [
      CHAT_SYSTEM_PROMPTS.CORE,
      CHAT_SYSTEM_PROMPTS.CHAT_UI,
      CHAT_SYSTEM_PROMPTS.RESPONSE_FORMAT,
    ];
    const contextSection = this.buildContextSection({
      userContext,
      workspaceInstructions,
      includeBrowsingContext: true,
    });
    console.log('contextSection content:', contextSection);

    if (contextSection) {
      parts.push(contextSection);
    }

    const toolCatalogSection = this.buildToolCatalogSection(
      toolCatalog,
      preloadedTools,
    );
    console.log('toolCatalogSection content:', toolCatalogSection);

    const skillCatalogSection = this.buildSkillCatalogSection(skillCatalog);
    console.log('skillCatalogSection content:', skillCatalogSection);

    parts.push(toolCatalogSection);
    parts.push(skillCatalogSection);

    if (storedFiles && storedFiles.length > 0) {
      const uploadedFilesSection = this.buildUploadedFilesSection(storedFiles);
      console.log('uploadedFilesSection content:', uploadedFilesSection);
      parts.push(uploadedFilesSection);
    }

    const fullPrompt = parts.join('\n');
    console.log('fullPrompt content:', fullPrompt);

    return fullPrompt;
  }

  async buildMcpInstructions({
    workspaceId,
    roleId,
    userId,
    userWorkspaceId,
    userContext,
    excludeTools,
    preloadedTools = COMMON_PRELOAD_TOOLS,
  }: {
    workspaceId: string;
    roleId: string;
    userId?: string;
    userWorkspaceId?: string;
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

    const contextSection = this.buildContextSection({ userContext });

    if (contextSection) {
      parts.push(contextSection);
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
        salesNavigatorAvailable: capabilities?.salesNavigatorAvailable ?? false,
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

  buildContextSection({
    userContext,
    workspaceInstructions,
    includeBrowsingContext = false,
  }: {
    userContext?: UserContext;
    workspaceInstructions?: string;
    includeBrowsingContext?: boolean;
  }): string {
    const blocks: string[] = [];

    if (workspaceInstructions) {
      blocks.push(
        `The following are custom instructions provided by the workspace administrator:\n${workspaceInstructions}`,
      );
    }

    if (userContext) {
      const userLines = [
        `User: ${userContext.firstName} ${userContext.lastName}`.trim(),
        `Locale: ${userContext.locale}`,
      ];
      const resolvedTimeZone = getValidTimeZoneOrUndefined(
        userContext.timezone,
      );

      if (resolvedTimeZone) {
        userLines.push(`Timezone: ${resolvedTimeZone}`);
      }

      userLines.push(
        `Current date: ${this.formatCurrentDate(userContext.timezone)}`,
      );
      blocks.push(userLines.join('\n'));
    }

    if (includeBrowsingContext) {
      blocks.push(
        "A <browsing_context> tag may appear in the user's last message. Only use it when directly relevant to the question.",
      );
    }

    if (blocks.length === 0) {
      return '';
    }

    return `
    ## Context

    ${blocks.join('\n\n')}`;
  }

  formatLinkedinConnectionStatus(
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
        ]
      : [
          `- LinkedIn (Unipile): not connected${
            connectedAccountsContext.accountId
              ? ` (stale account_id=${connectedAccountsContext.accountId})`
              : ''
          }`,
          `- Search types available: none via Unipile`,
        ];

    return [
      'LinkedIn for this user. Use only these searchType values.',
      ...lines,
    ].join('\n');
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
    return this.buildToolCatalogSection(toolCatalog, preloadedTools, {
      excludeTools,
      intro: 'mcp',
    });
  }

  private buildGenericCategoryCatalogSection(
    category: ToolCategory,
    tools: ToolIndexEntry[],
    preloadedSet: Set<string>,
  ): string {
    const categoryLabel = this.getCategoryLabel(category);

    if (tools.length <= LARGE_CATEGORY_TOOL_LIST_THRESHOLD) {
      return `
      #### ${categoryLabel} (${tools.length} tools)
      ${tools
        .map((tool) => {
          const status = preloadedSet.has(tool.name) ? ' ✓' : '';

          return `- \`${tool.name}\`${status}`;
        })
        .join('\n')}`;
    }

    if (category === ToolCategory.EXTERNAL_MCP) {
      const countsBySlug = new Map<string, number>();

      for (const tool of tools) {
        const slug = getExternalMcpServerSlug(tool.name) ?? 'other';

        countsBySlug.set(slug, (countsBySlug.get(slug) ?? 0) + 1);
      }

      const serverLines = [...countsBySlug.entries()]
        .sort((first, second) => second[1] - first[1])
        .map(
          ([slug, count]) =>
            `- \`${slug}\` (${count} tools) → \`${GET_TOOL_CATALOG_TOOL_NAME}({server: "${slug}"})\``,
        )
        .join('\n');

      return `
      #### ${categoryLabel} (${tools.length} tools across ${countsBySlug.size} connected servers)
      Tool names are not listed here. Browse a server, then \`${LEARN_TOOLS_TOOL_NAME}\` only the tools you will run. Use \`${GET_TOOL_CATALOG_TOOL_NAME}({query: "..."})\` to search by keyword.
      ${serverLines}`;
    }

    return `
      #### ${categoryLabel} (${tools.length} tools)
      Tool names are not listed here. Browse with \`${GET_TOOL_CATALOG_TOOL_NAME}({categories: ["${category}"]})\` or search with \`${GET_TOOL_CATALOG_TOOL_NAME}({query: "..."})\`.`;
  }

  private buildArxenaCatalogSection(toolCount: number): string {
    return `
      #### ${this.getCategoryLabel(ToolCategory.ARXENA)} (${toolCount} tools)
      Names come from the loaded skill. If the skill does not name the tool, search with \`${GET_TOOL_CATALOG_TOOL_NAME}({query: "..."})\`.`;
  }

  buildToolCatalogSection(
    toolCatalog: ToolIndexEntry[],
    preloadedTools: string[],
    options?: {
      excludeTools?: Set<string>;
      intro?: 'chat' | 'mcp';
    },
  ): string {
    const excludeTools = options?.excludeTools;
    const intro = options?.intro ?? 'chat';

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

    const preloadedList =
      filteredPreloaded.length > 0
        ? filteredPreloaded.map((toolName) => `- \`${toolName}\` ✓`).join('\n')
        : '(none)';

    const introLead =
      intro === 'mcp'
        ? `You have access to ${filteredCatalog.length} tools via \`learn_tools\` / \`execute_tool\`. They are NOT bound as top-level MCP tools.
      Construct CRUD names from the grammar below. Load a skill for GTM/workflow/metadata tool names.`
        : `You have access to ${filteredCatalog.length} tools. Some are pre-loaded and ready to use immediately.
      To use any other tool, first call \`${LEARN_TOOLS_TOOL_NAME}\` to learn its schema, then call \`${EXECUTE_TOOL_TOOL_NAME}\` to run it.`;

    const sections: string[] = [
      `
      ## Available Tools

      ${introLead}

      ### Pre-loaded Tools (ready to use now)
      ${preloadedList}${
        intro === 'chat' ? '\n\n      ### Tool Catalog by Category' : ''
      }`,
    ];

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
      sections.push(this.buildArxenaCatalogSection(arxenaTools.length));
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

      sections.push(
        this.buildGenericCategoryCatalogSection(category, tools, preloadedSet),
      );
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
        return 'People and company search';
      case ToolCategory.EXTERNAL_MCP:
        return 'Connected apps (workspace MCP servers)';
      default:
        return assertUnreachable(category);
    }
  }
}
