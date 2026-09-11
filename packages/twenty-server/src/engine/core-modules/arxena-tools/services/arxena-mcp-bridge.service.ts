import { Injectable, Logger } from '@nestjs/common';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { existsSync } from 'fs';
import * as path from 'path';

import { isDefined } from 'twenty-shared/utils';

import {
  ARXENA_INTERNAL_TOOL_NAMES,
  ARXENA_TOOL_CATALOG,
} from 'src/engine/core-modules/arxena-tools/constants/arxena-tool-catalog.const';
import { type ArxenaMcpToolDefinition } from 'src/engine/core-modules/arxena-tools/types/arxena-mcp-tool-definition.type';

type CachedCatalog = {
  tools: ArxenaMcpToolDefinition[];
  fetchedAt: number;
};

const CATALOG_TTL_MS = 5 * 60 * 1000;
const LEARN_TOOLS_BATCH_SIZE = 40;

const extractJsonFromMcpResult = (result: unknown): unknown => {
  if (!isDefined(result) || typeof result !== 'object') {
    return result;
  }

  const content = (
    result as { content?: Array<{ type?: string; text?: string }> }
  ).content;

  if (Array.isArray(content)) {
    const textParts = content
      .filter((part) => part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text as string);

    if (textParts.length > 0) {
      const joined = textParts.join('\n');

      try {
        return JSON.parse(joined) as unknown;
      } catch {
        return joined;
      }
    }
  }

  return result;
};

@Injectable()
export class ArxenaMcpBridgeService {
  private readonly logger = new Logger(ArxenaMcpBridgeService.name);
  private catalogCache: CachedCatalog | null = null;

  private resolveMcpServerScriptPath(): string {
    if (isDefined(process.env.MCP_SERVER_SCRIPT_PATH)) {
      return process.env.MCP_SERVER_SCRIPT_PATH;
    }

    // nx start runs with cwd=packages/twenty-server; monorepo root also works.
    // __dirname fallback: dist/.../arxena-tools/services → packages/
    const candidates = [
      path.join(
        process.cwd(),
        'packages',
        'twenty-mcp-server',
        'dist',
        'index.js',
      ),
      path.join(process.cwd(), '..', 'twenty-mcp-server', 'dist', 'index.js'),
      path.resolve(
        __dirname,
        '..',
        '..',
        '..',
        '..',
        '..',
        '..',
        'twenty-mcp-server',
        'dist',
        'index.js',
      ),
    ];

    const existingPath = candidates.find((candidatePath) =>
      existsSync(candidatePath),
    );

    if (!isDefined(existingPath)) {
      this.logger.warn(
        `MCP server script not found. Tried: ${candidates.join(', ')}`,
      );

      return candidates[0];
    }

    return existingPath;
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

  private getCatalogToolNames(): string[] {
    return ARXENA_TOOL_CATALOG.map((entry) => entry.name).filter(
      (name) => !ARXENA_INTERNAL_TOOL_NAMES.has(name),
    );
  }

  private async learnToolDefinitions(
    client: Client,
    toolNames: string[],
  ): Promise<ArxenaMcpToolDefinition[]> {
    const learned: ArxenaMcpToolDefinition[] = [];

    for (
      let offset = 0;
      offset < toolNames.length;
      offset += LEARN_TOOLS_BATCH_SIZE
    ) {
      const batch = toolNames.slice(offset, offset + LEARN_TOOLS_BATCH_SIZE);
      const result = await client.callTool({
        name: 'learn_tools',
        arguments: { toolNames: batch },
      });
      const parsed = extractJsonFromMcpResult(result) as {
        tools?: Array<{
          name?: string;
          description?: string;
          inputSchema?: object;
        }>;
      };

      if (!Array.isArray(parsed?.tools)) {
        continue;
      }

      for (const tool of parsed.tools) {
        if (typeof tool.name !== 'string' || tool.name.length === 0) {
          continue;
        }

        learned.push({
          name: tool.name,
          description: tool.description,
          inputSchema:
            typeof tool.inputSchema === 'object' && isDefined(tool.inputSchema)
              ? tool.inputSchema
              : { type: 'object', properties: {} },
        });
      }
    }

    return learned;
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
      const catalogNames = this.getCatalogToolNames();

      return this.learnToolDefinitions(client, catalogNames);
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
        name: 'execute_tool',
        arguments: {
          toolName: name,
          arguments: args,
        },
      });

      return result;
    });
  }
}
