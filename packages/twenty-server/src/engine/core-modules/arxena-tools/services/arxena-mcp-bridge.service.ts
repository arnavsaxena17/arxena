import {
  ARXENA_INTERNAL_TOOL_NAMES,
  ARXENA_TOOL_CATALOG,
} from 'src/engine/core-modules/arxena-tools/constants/arxena-tool-catalog.const';
import { Injectable, Logger } from '@nestjs/common';

import { isDefined } from 'twenty-shared/utils';

import {
  getDisabledSearchToolNames,
  resolveSearchToolsConfig,
} from 'src/engine/core-modules/arxena-tools/utils/search-tools-config.util';
import {
  callArxenaTool,
  type ArxenaToolCallResult,
} from 'src/engine/core-modules/arxena-tools/library/lib';
import { type RestTransport } from 'src/engine/core-modules/arxena-tools/library/api/rest-client';
import { type ArxenaMcpToolDefinition } from 'src/engine/core-modules/arxena-tools/types/arxena-mcp-tool-definition.type';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

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

  constructor(private readonly twentyConfigService: TwentyConfigService) {}

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
    restTransport?: RestTransport,
  ): Promise<ArxenaToolCallResult> {
    return callArxenaTool(
      {
        apiToken: apiToken.replace(/[\r\n]+/g, ''),
        baseUrl: this.resolveServerBaseUrl(),
        ...(isDefined(workspaceMemberId) && workspaceMemberId !== ''
          ? { workspaceMemberId }
          : {}),
        disabledToolNames: getDisabledSearchToolNames(
          resolveSearchToolsConfig(this.twentyConfigService),
        ),
        ...(isDefined(restTransport) ? { restTransport } : {}),
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
    restTransport?: RestTransport,
  ): Promise<unknown> {
    return TOP_LEVEL_TOOL_NAMES.has(name)
      ? this.callLibraryTool(
          apiToken,
          workspaceMemberId,
          name,
          args,
          restTransport,
        )
      : this.callLibraryTool(
          apiToken,
          workspaceMemberId,
          'execute_tool',
          { toolName: name, arguments: args },
          restTransport,
        );
  }
}
