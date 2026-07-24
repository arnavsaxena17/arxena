import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { truncateToolResult } from './auth';
import { ArxenaConfig, loadConfig } from './config';
import { allTools } from './tools/index';
import { McpTool } from './types/tool-types';
import { formatToolDefinitionForMcp } from './utils/format-tool-definition';

const MCP_SERVER_INSTRUCTIONS =
  'Arxena  MCP server. Use search then fetch for org charts and workspace records. ' +
  'Use get_org_chart when the company is known. Write tools modify candidates, jobs, and send messages.';

export const buildMcpServer = (
  config: ArxenaConfig,
  tools: McpTool[],
): Server => {
  const server = new Server(
    {
      name: 'arxena-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
      instructions: MCP_SERVER_INSTRUCTIONS,
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((tool) => formatToolDefinitionForMcp(tool)),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    const tool = tools.find((toolEntry) => toolEntry.definition.name === name);
    if (!tool) {
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

    try {
      const result = await tool.handler(
        (args ?? {}) as Record<string, unknown>,
        config,
      );

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
