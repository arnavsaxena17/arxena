import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { ArxenaConfig, isMetaToolsOnlyEnabled, loadConfig } from './config';
import { allTools, resolveListedTools } from './tools/index';
import {
  buildMetaServerInstructions,
  runToolCall,
} from './tools/meta-tools';
import { McpTool } from './types/tool-types';
import { formatToolDefinitionForMcp } from './utils/format-tool-definition';

export const buildMcpServer = (
  config: ArxenaConfig,
  executablePool: McpTool[],
  options?: { metaToolsOnly?: boolean },
): Server => {
  const metaToolsOnly = options?.metaToolsOnly ?? isMetaToolsOnlyEnabled();
  const listedTools = resolveListedTools(executablePool, { metaToolsOnly });

  const server = new Server(
    {
      name: 'arxena-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
      instructions: metaToolsOnly
        ? buildMetaServerInstructions()
        : 'Arxena MCP server (flat tools mode). Use search then fetch for org charts and workspace records.',
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: listedTools.map((tool) => formatToolDefinitionForMcp(tool)),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    return runToolCall(
      listedTools,
      executablePool,
      name,
      (args ?? {}) as Record<string, unknown>,
      config,
      metaToolsOnly,
    );
  });

  return server;
};

export const startStdioMcpServer = async (
  tools: McpTool[] = allTools,
): Promise<void> => {
  const config = loadConfig();
  const server = buildMcpServer(config, tools);
  const transport = new StdioServerTransport();
  await server.connect(transport);
};

/** @deprecated Use startStdioMcpServer */
export const createMcpServer = startStdioMcpServer;
