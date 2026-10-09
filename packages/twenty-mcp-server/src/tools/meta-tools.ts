import { truncateToolResult } from '../auth';
import {
  ARXENA_INTERNAL_TOOL_NAMES,
  ARXENA_TOOL_CATALOG,
  ARXENA_TOOL_PACK_LABELS,
  OUTREACH_COMPLETE_REQUESTS_PROMPT,
  OUTREACH_DESTINATION_VERBS_PROMPT,
  OUTREACH_SOURCING_PREFERENCE_PROMPT,
  buildOutreachRoutingLines,
  type ArxenaToolPack,
  filterSearchSkillContent,
  getDisabledSearchToolNames,
  getOutreachSkillByName,
  listOutreachSkillNames,
  type OutreachSkill,
} from 'twenty-shared/outreach';

import { getSearchToolsConfig } from '../api/search-tools-config';
import { ArxenaConfig } from '../config';
import { McpTool } from '../types/tool-types';

const OPENAI_TOP_LEVEL_TOOL_NAMES = new Set(['search', 'fetch']);

export const META_TOOL_NAMES = new Set([
  'get_tool_catalog',
  'learn_tools',
  'execute_tool',
  'list_skills',
  'load_skills',
  'search',
  'fetch',
]);

const PACK_LABELS = ARXENA_TOOL_PACK_LABELS;

// Skills whose markdown carries provider markers (see filterSearchSkillContent).
const PROVIDER_FILTERED_SKILL_NAMES = new Set([
  'search',
  'org-structure-insights',
]);

const getDisabledToolNames = async (
  config: ArxenaConfig,
): Promise<Set<string>> =>
  new Set(
    getDisabledSearchToolNames(
      await getSearchToolsConfig(config.baseUrl, config.apiToken),
    ),
  );

const asRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
};

const parseStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

const coerceExecuteArguments = (value: unknown): Record<string, unknown> => {
  if (typeof value === 'string') {
    try {
      return asRecord(JSON.parse(value));
    } catch {
      return {};
    }
  }

  return asRecord(value);
};

export const isExecutableOutreachToolName = (
  toolName: string,
  executableByName: Map<string, McpTool>,
): boolean => {
  if (
    META_TOOL_NAMES.has(toolName) ||
    OPENAI_TOP_LEVEL_TOOL_NAMES.has(toolName)
  ) {
    return false;
  }

  if (ARXENA_INTERNAL_TOOL_NAMES.has(toolName)) {
    return false;
  }

  return executableByName.has(toolName);
};

export const buildExecutableToolMap = (
  tools: McpTool[],
): Map<string, McpTool> => {
  const executableByName = new Map<string, McpTool>();

  for (const tool of tools) {
    const name = tool.definition.name;

    if (
      META_TOOL_NAMES.has(name) ||
      OPENAI_TOP_LEVEL_TOOL_NAMES.has(name) ||
      ARXENA_INTERNAL_TOOL_NAMES.has(name)
    ) {
      continue;
    }

    executableByName.set(name, tool);
  }

  return executableByName;
};

export const buildMetaTools = (executableTools: McpTool[]): McpTool[] => {
  const executableByName = buildExecutableToolMap(executableTools);

  const getToolCatalog: McpTool = {
    definition: {
      name: 'get_tool_catalog',
      title: 'Get Tool Catalog',
      description:
        'Browse available Arxena tools by pack when instructions look stale. Prefer load_skills for exact names. Packs: prospecting, enrichment, orgchart, outreach, accounts, crm_workspace, general.',
      annotations: { readOnlyHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          packs: {
            type: 'array',
            description:
              'Optional pack filter (e.g. ["orgchart","outreach"]). Omit to list all packs.',
            items: { type: 'string' },
          },
        },
      },
    },
    handler: async (args, config) => {
      const disabledToolNames = await getDisabledToolNames(config);
      const packFilter = new Set(parseStringArray(args.packs));
      const catalog: Record<
        string,
        Array<{ name: string; description: string }>
      > = {};

      for (const entry of ARXENA_TOOL_CATALOG) {
        if (
          !executableByName.has(entry.name) ||
          disabledToolNames.has(entry.name)
        ) {
          continue;
        }

        if (packFilter.size > 0 && !packFilter.has(entry.pack)) {
          continue;
        }

        if (!catalog[entry.pack]) {
          catalog[entry.pack] = [];
        }

        catalog[entry.pack].push({
          name: entry.name,
          description: entry.description,
        });
      }

      // Include executable tools missing from the synced catalog under general.
      for (const [name, tool] of executableByName) {
        const listed = ARXENA_TOOL_CATALOG.some((entry) => entry.name === name);

        if (listed || disabledToolNames.has(name)) {
          continue;
        }

        if (packFilter.size > 0 && !packFilter.has('general')) {
          continue;
        }

        if (!catalog.general) {
          catalog.general = [];
        }

        catalog.general.push({
          name,
          description: tool.definition.description,
        });
      }

      const totalTools = Object.values(catalog).reduce(
        (sum, tools) => sum + tools.length,
        0,
      );

      return {
        catalog,
        packLabels: PACK_LABELS,
        message: `Found ${totalTools} tool(s) across ${Object.keys(catalog).length} pack(s).`,
      };
    },
  };

  const learnTools: McpTool = {
    definition: {
      name: 'learn_tools',
      title: 'Learn Tools',
      description:
        'Get input schemas for Arxena tools. Pass every tool you need in one call (toolNames array), then call execute_tool.',
      annotations: { readOnlyHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          toolNames: {
            type: 'array',
            description: 'Exact tool names to learn.',
            items: { type: 'string' },
          },
        },
        required: ['toolNames'],
      },
    },
    handler: async (args, config) => {
      const disabledToolNames = await getDisabledToolNames(config);
      const toolNames = parseStringArray(args.toolNames);
      const tools: Array<{
        name: string;
        description: string;
        inputSchema: object;
      }> = [];
      const notFound: string[] = [];

      for (const toolName of toolNames) {
        const tool = executableByName.get(toolName);

        if (
          !tool ||
          disabledToolNames.has(toolName) ||
          !isExecutableOutreachToolName(toolName, executableByName)
        ) {
          notFound.push(toolName);
          continue;
        }

        tools.push({
          name: tool.definition.name,
          description: tool.definition.description,
          inputSchema: tool.definition.inputSchema,
        });
      }

      return {
        tools,
        notFound,
        message:
          notFound.length === 0
            ? `Learned ${tools.length} tool(s).`
            : `Learned ${tools.length} tool(s). Not found: ${notFound.join(', ')}.`,
      };
    },
  };

  const executeTool: McpTool = {
    definition: {
      name: 'execute_tool',
      title: 'Execute Tool',
      description:
        'Execute a Arxena tool by name with arguments. Call learn_tools first for the input schema. Pass arguments as a JSON object, never a stringified JSON string.',
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
      },
      inputSchema: {
        type: 'object',
        properties: {
          toolName: {
            type: 'string',
            description: 'Exact tool name. Do not guess.',
          },
          arguments: {
            type: 'object',
            description:
              'Object matching the schema from learn_tools. Pass a JSON object, never a stringified JSON string.',
          },
        },
        required: ['toolName'],
      },
    },
    handler: async (args, config) => {
      const toolName =
        typeof args.toolName === 'string' ? args.toolName.trim() : '';
      const toolArgs = coerceExecuteArguments(args.arguments);

      if (!toolName) {
        return {
          success: false,
          message: 'toolName is required',
          error: 'toolName is required',
        };
      }

      if (
        !isExecutableOutreachToolName(toolName, executableByName) ||
        (await getDisabledToolNames(config)).has(toolName)
      ) {
        return {
          success: false,
          message: `Tool "${toolName}" is not available`,
          error: `Tool "${toolName}" is not available via execute_tool. Use get_tool_catalog or load_skills for exact names, then learn_tools.`,
        };
      }

      const tool = executableByName.get(toolName);

      if (!tool) {
        return {
          success: false,
          message: `Tool "${toolName}" is not available`,
          error: `Unknown tool: ${toolName}`,
        };
      }

      const result = await tool.handler(toolArgs, config);

      return truncateToolResult(result);
    },
  };

  const listSkills: McpTool = {
    definition: {
      name: 'list_skills',
      title: 'List Skills',
      description:
        'List skill names when initialize instructions look stale. Prefer the skill names already listed in server instructions, then load_skills.',
      annotations: { readOnlyHint: true },
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    handler: async () => {
      const skillNames = listOutreachSkillNames();

      return {
        skillNames,
        message:
          skillNames.length > 0
            ? `Found ${skillNames.length} skill(s): ${skillNames.join(', ')}.`
            : 'No skills are currently available.',
      };
    },
  };

  const loadSkills: McpTool = {
    definition: {
      name: 'load_skills',
      title: 'Load Skills',
      description:
        'Load specialized Outreach skills (playbooks + exact tool names). Call before complex org-chart, search, or outreach work.',
      annotations: { readOnlyHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          skillNames: {
            type: 'array',
            description:
              'Skill names to load (e.g. ["org-structure-insights","search"]).',
            items: { type: 'string' },
          },
        },
        required: ['skillNames'],
      },
    },
    handler: async (args, config) => {
      const skillNames = parseStringArray(args.skillNames);
      const skills = skillNames
        .map((name) => getOutreachSkillByName(name))
        .filter((skill): skill is OutreachSkill => skill !== undefined);

      if (skills.length === 0) {
        const availableNames = listOutreachSkillNames();

        return {
          skills: [],
          message: `No skills found with names: ${skillNames.join(', ')}. Available: ${availableNames.join(', ')}.`,
        };
      }

      const needsProviderFilter = skills.some((skill) =>
        PROVIDER_FILTERED_SKILL_NAMES.has(skill.name),
      );
      const searchToolsConfig = needsProviderFilter
        ? await getSearchToolsConfig(config.baseUrl, config.apiToken)
        : undefined;

      return {
        skills: skills.map((skill) => ({
          name: skill.name,
          label: skill.label,
          content:
            searchToolsConfig && PROVIDER_FILTERED_SKILL_NAMES.has(skill.name)
              ? filterSearchSkillContent(skill.content, searchToolsConfig)
              : skill.content,
        })),
        message: `Loaded ${skills.map((skill) => skill.label).join(', ')}.`,
      };
    },
  };

  return [getToolCatalog, learnTools, executeTool, listSkills, loadSkills];
};

export const buildMetaServerInstructions = (): string => {
  const packLines = (
    Object.entries(PACK_LABELS) as Array<[ArxenaToolPack, string]>
  )
    .map(([pack, label]) => `- \`${pack}\`: ${label}`)
    .join('\n');

  const skillLines = listOutreachSkillNames()
    .map((name) => `- \`${name}\`: ${getOutreachSkillByName(name)?.label}`)
    .join('\n');

  return [
    'Arxena MCP server. Arxena tools are NOT bound top-level.',
    'Flow: load_skills → learn_tools({ toolNames }) → execute_tool({ toolName, arguments }).',
    'OpenAI company knowledge: use top-level search then fetch.',
    '',
    'Packs:',
    packLines,
    '',
    'Skills:',
    skillLines,
    '',
    '### Intent routing (load these)',
    buildOutreachRoutingLines(),
    '',
    OUTREACH_SOURCING_PREFERENCE_PROMPT,
    '',
    OUTREACH_DESTINATION_VERBS_PROMPT,
    '',
    OUTREACH_COMPLETE_REQUESTS_PROMPT,
    '',
    'Preferred starters: list_org_chart_positions, get_org_chart_node_people, check_contact_availability, fetch_email, fetch_phone, fetch_contacts.',
    'Browse packs with get_tool_catalog when needed. Never learn the entire catalog at once.',
  ].join('\n');
};

export const resolveSurfaceTools = (
  allAvailableTools: McpTool[],
  options: { metaToolsOnly: boolean },
): McpTool[] => {
  if (!options.metaToolsOnly) {
    return allAvailableTools;
  }

  const openaiTools = allAvailableTools.filter((tool) =>
    OPENAI_TOP_LEVEL_TOOL_NAMES.has(tool.definition.name),
  );
  const metaTools = buildMetaTools(allAvailableTools);

  return [...metaTools, ...openaiTools];
};

export const runToolCall = async (
  tools: McpTool[],
  executablePool: McpTool[],
  name: string,
  args: Record<string, unknown>,
  config: ArxenaConfig,
  metaToolsOnly: boolean,
): Promise<{
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: unknown;
  isError?: boolean;
}> => {
  const surfaceTool = tools.find((tool) => tool.definition.name === name);

  if (surfaceTool) {
    try {
      const result = await surfaceTool.handler(args, config);

      if (
        (name === 'search' || name === 'fetch') &&
        result &&
        typeof result === 'object'
      ) {
        const structuredContent = truncateToolResult(result);

        return {
          structuredContent,
          content: [
            {
              type: 'text',
              text: JSON.stringify(structuredContent),
            },
          ],
        };
      }

      const truncated = truncateToolResult(result);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(truncated, null, 2),
          },
        ],
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

      return {
        content: [{ type: 'text', text: `Error: ${message}` }],
        isError: true,
      };
    }
  }

  if (metaToolsOnly) {
    const executableByName = buildExecutableToolMap(executablePool);

    if (isExecutableOutreachToolName(name, executableByName)) {
      return {
        content: [
          {
            type: 'text',
            text: `Tool "${name}" is not top-level. Call learn_tools({ toolNames: ["${name}"] }) then execute_tool({ toolName: "${name}", arguments: {...} }).`,
          },
        ],
        isError: true,
      };
    }
  }

  return {
    content: [{ type: 'text', text: `Unknown tool: ${name}` }],
    isError: true,
  };
};
