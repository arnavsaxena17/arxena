import { Injectable, Logger } from '@nestjs/common';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import * as path from 'path';

import { isDefined } from 'twenty-shared/utils';

import { type ArxenaMcpToolDefinition } from 'src/engine/core-modules/arxena-tools/types/arxena-mcp-tool-definition.type';

type CachedCatalog = {
  tools: ArxenaMcpToolDefinition[];
  fetchedAt: number;
};

const CATALOG_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class ArxenaMcpBridgeService {
  private readonly logger = new Logger(ArxenaMcpBridgeService.name);
  private catalogCache: CachedCatalog | null = null;

  private resolveMcpServerScriptPath(): string {
    if (isDefined(process.env.MCP_SERVER_SCRIPT_PATH)) {
      return process.env.MCP_SERVER_SCRIPT_PATH;
    }

    return path.join(
      process.cwd(),
      'packages',
      'twenty-mcp-server',
      'dist',
      'index.js',
    );
  }

  private resolveServerBaseUrl(): string {
    return (
      process.env.SERVER_BASE_URL ??
      process.env.ARXENA_SITE_BASE_URL ??
      'http://localhost:3000'
    );
  }

  private async withClient<T>(
    apiToken: string,
    workspaceMemberId: string | undefined,
    fn: (client: Client) => Promise<T>,
  ): Promise<T> {
    const client = new Client({
      name: 'arxena-tool-provider-bridge',
      version: '1.0.0',
    });
    const env: Record<string, string> = {
      ...(process.env as Record<string, string>),
      ARXENA_API_TOKEN: apiToken.replace(/[\r\n]+/g, ''),
      ARXENA_BASE_URL: this.resolveServerBaseUrl(),
    };

    if (isDefined(workspaceMemberId) && workspaceMemberId !== '') {
      env.ARXENA_WORKSPACE_MEMBER_ID = workspaceMemberId;
    }

    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [this.resolveMcpServerScriptPath()],
      env,
    });

    await client.connect(transport);

    try {
      return await fn(client);
    } finally {
      await client.close().catch(() => undefined);
    }
  }

  async listTools(apiToken: string): Promise<ArxenaMcpToolDefinition[]> {
    const now = Date.now();

    if (
      isDefined(this.catalogCache) &&
      now - this.catalogCache.fetchedAt < CATALOG_TTL_MS
    ) {
      return this.catalogCache.tools;
    }

    const tools = await this.withClient(apiToken, undefined, async (client) => {
      const result = await client.listTools();

      return result.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema:
          typeof tool.inputSchema === 'object' && isDefined(tool.inputSchema)
            ? (tool.inputSchema as object)
            : { type: 'object', properties: {} },
      }));
    });

    this.catalogCache = { tools, fetchedAt: now };
    this.logger.log(`Cached ${tools.length} Arxena MCP tool definitions`);

    return tools;
  }

  async callTool(
    apiToken: string,
    workspaceMemberId: string | undefined,
    name: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    return this.withClient(apiToken, workspaceMemberId, async (client) => {
      const result = await client.callTool({
        name,
        arguments: args,
      });

      return result;
    });
  }
}
