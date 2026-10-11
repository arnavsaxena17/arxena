import { Injectable, Logger } from '@nestjs/common';
import { existsSync } from 'fs';
import * as path from 'path';

import { isDefined } from 'twenty-shared/utils';

import {
  ARXENA_INTERNAL_TOOL_NAMES,
  ARXENA_TOOL_CATALOG,
} from 'twenty-shared/outreach';
import {
  getDisabledSearchToolNames,
  resolveSearchToolsConfig,
} from 'src/engine/core-modules/arxena-tools/utils/search-tools-config.util';
import { type ArxenaMcpToolDefinition } from 'src/engine/core-modules/arxena-tools/types/arxena-mcp-tool-definition.type';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

// Contract of twenty-mcp-server's dist/lib.js, which is loaded in-process
type ArxenaToolConfig = {
  apiToken: string;
  baseUrl: string;
  workspaceMemberId?: string;
  disabledToolNames?: readonly string[];
};

type ArxenaToolCallResult = {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: unknown;
  isError?: boolean;
};

export type ArxenaToolLibrary = {
  callArxenaTool: (
    config: ArxenaToolConfig,
    name: string,
    args: Record<string, unknown>,
  ) => Promise<ArxenaToolCallResult>;
};

type CachedCatalog = {
  tools: ArxenaMcpToolDefinition[];
  fetchedAt: number;
};

const CATALOG_TTL_MS = 5 * 60 * 1000;
const LEARN_TOOLS_BATCH_SIZE = 40;

// Top-level tools in the library; execute_tool refuses them
const TOP_LEVEL_TOOL_NAMES = new Set(['search', 'fetch']);

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
  private toolLibrary: ArxenaToolLibrary | null = null;

  constructor(private readonly twentyConfigService: TwentyConfigService) {}

  private resolveToolLibraryPath(): string {
    if (isDefined(process.env.MCP_TOOL_LIBRARY_PATH)) {
      return process.env.MCP_TOOL_LIBRARY_PATH;
    }

    // nx start runs with cwd=packages/twenty-server; monorepo root also works.
    // __dirname fallback: dist/.../arxena-tools/services → packages/
    const candidates = [
      path.join(
        process.cwd(),
        'packages',
        'twenty-mcp-server',
        'dist',
        'lib.js',
      ),
      path.join(process.cwd(), '..', 'twenty-mcp-server', 'dist', 'lib.js'),
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
        'lib.js',
      ),
    ];

    const existingPath = candidates.find((candidatePath) =>
      existsSync(candidatePath),
    );

    if (!isDefined(existingPath)) {
      throw new Error(
        `Arxena tool library not found (build twenty-mcp-server). Tried: ${candidates.join(', ')}`,
      );
    }

    return existingPath;
  }

  private loadToolLibrary(): ArxenaToolLibrary {
    if (!isDefined(this.toolLibrary)) {
      // Loaded lazily so the server still boots when the package is not built
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      this.toolLibrary = require(
        this.resolveToolLibraryPath(),
      ) as ArxenaToolLibrary;
    }

    return this.toolLibrary;
  }

  private resolveServerBaseUrl(): string {
    return (
      process.env.SERVER_BASE_URL ??
      process.env.ARXENA_SITE_BASE_URL ??
      'http://localhost:3000'
    );
  }

  private async callLibraryTool(
    apiToken: string,
    workspaceMemberId: string | undefined,
    name: string,
    args: Record<string, unknown>,
  ): Promise<ArxenaToolCallResult> {
    return this.loadToolLibrary().callArxenaTool(
      {
        apiToken: apiToken.replace(/[\r\n]+/g, ''),
        baseUrl: this.resolveServerBaseUrl(),
        ...(isDefined(workspaceMemberId) && workspaceMemberId !== ''
          ? { workspaceMemberId }
          : {}),
        disabledToolNames: getDisabledSearchToolNames(
          resolveSearchToolsConfig(this.twentyConfigService),
        ),
      },
      name,
      args,
    );
  }

  private getCatalogToolNames(): string[] {
    return ARXENA_TOOL_CATALOG.map((entry) => entry.name).filter(
      (name) => !ARXENA_INTERNAL_TOOL_NAMES.has(name),
    );
  }

  private async learnToolDefinitions(
    apiToken: string,
    toolNames: string[],
  ): Promise<ArxenaMcpToolDefinition[]> {
    const learned: ArxenaMcpToolDefinition[] = [];

    for (
      let offset = 0;
      offset < toolNames.length;
      offset += LEARN_TOOLS_BATCH_SIZE
    ) {
      const batch = toolNames.slice(offset, offset + LEARN_TOOLS_BATCH_SIZE);
      const result = await this.callLibraryTool(
        apiToken,
        undefined,
        'learn_tools',
        { toolNames: batch },
      );
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

    const tools = await this.learnToolDefinitions(
      apiToken,
      this.getCatalogToolNames(),
    );

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
    return TOP_LEVEL_TOOL_NAMES.has(name)
      ? this.callLibraryTool(apiToken, workspaceMemberId, name, args)
      : this.callLibraryTool(apiToken, workspaceMemberId, 'execute_tool', {
          toolName: name,
          arguments: args,
        });
  }
}
