import { MCP_TOOL_DESCRIPTIONS } from 'src/engine/core-modules/arxena-tools/constants/mcp-tool-descriptions.const';
import { ARXENA_INTERNAL_TOOL_NAMES } from 'src/engine/core-modules/arxena-tools/constants/arxena-tool-catalog.const';
import { getDisabledSearchToolNames } from 'src/engine/core-modules/arxena-tools/utils/search-tools-config';
import { truncateToolResult } from '../auth';

import { getSearchToolsConfig } from '../api/search-tools-config';
import { ArxenaConfig } from '../config';
import { McpTool } from '../types/tool-types';

const OPENAI_TOP_LEVEL_TOOL_NAMES = new Set(['search', 'fetch']);

export const META_TOOL_NAMES = new Set([
  'learn_tools',
  'execute_tool',
  'search',
  'fetch',
]);

const getDisabledToolNames = async (
  config: ArxenaConfig,
): Promise<Set<string>> =>
  config.disabledToolNames
    ? new Set(config.disabledToolNames)
    : new Set(
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

  const learnTools: McpTool = {
    definition: {
      name: 'learn_tools',
      title: 'Learn Tools',
      description: MCP_TOOL_DESCRIPTIONS.learn_tools,
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
      description: MCP_TOOL_DESCRIPTIONS.execute_tool,
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

      return truncateToolResult(result, toolName);
    },
  };

  return [learnTools, executeTool];
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

      // execute_tool wraps the real tool, so the cap follows the inner name
      const truncated = truncateToolResult(
        result,
        name === 'execute_tool' && typeof args.toolName === 'string'
          ? args.toolName
          : name,
      );

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
