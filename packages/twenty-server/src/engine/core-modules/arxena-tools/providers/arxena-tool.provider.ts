import { Injectable, Logger } from '@nestjs/common';

import { ToolCategory } from 'twenty-shared/ai';
import { isDefined } from 'twenty-shared/utils';

import {
  ARXENA_INTERNAL_TOOL_NAMES,
  ARXENA_TOOL_CATALOG,
  type ArxenaToolPack,
} from 'src/engine/core-modules/arxena-tools/constants/arxena-tool-catalog.const';
import { ArxenaMcpBridgeService } from 'src/engine/core-modules/arxena-tools/services/arxena-mcp-bridge.service';
import { AccessTokenService } from 'src/engine/core-modules/auth/token/services/access-token.service';
import { type ApiKeyWorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { type GenerateDescriptorOptions } from 'src/engine/core-modules/tool-provider/interfaces/generate-descriptor-options.type';
import { type ToolProvider } from 'src/engine/core-modules/tool-provider/interfaces/tool-provider.interface';
import { type ToolProviderContext } from 'src/engine/core-modules/tool-provider/interfaces/tool-provider-context.type';
import { type ToolDescriptor } from 'src/engine/core-modules/tool-provider/types/tool-descriptor.type';
import { type ToolIndexEntry } from 'src/engine/core-modules/tool-provider/types/tool-index-entry.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { AuthProviderEnum } from 'src/engine/core-modules/workspace/types/workspace.type';

const extractTextFromMcpResult = (result: unknown): string => {
  if (!isDefined(result) || typeof result !== 'object') {
    return JSON.stringify(result ?? null);
  }

  const content = (
    result as { content?: Array<{ type?: string; text?: string }> }
  ).content;

  if (Array.isArray(content)) {
    const textParts = content
      .filter((part) => part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text as string);

    if (textParts.length > 0) {
      return textParts.join('\n');
    }
  }

  return JSON.stringify(result);
};

@Injectable()
export class ArxenaToolProvider implements ToolProvider {
  readonly category = ToolCategory.ARXENA;
  private readonly logger = new Logger(ArxenaToolProvider.name);

  constructor(
    private readonly arxenaMcpBridgeService: ArxenaMcpBridgeService,
    private readonly twentyConfigService: TwentyConfigService,
    private readonly accessTokenService: AccessTokenService,
  ) {}

  async isAvailable(_context: ToolProviderContext): Promise<boolean> {
    try {
      return this.twentyConfigService.get('IS_ARXENA_TOOLS_ENABLED') !== false;
    } catch {
      return true;
    }
  }

  private resolvePackFilter(
    options?: GenerateDescriptorOptions,
  ): ArxenaToolPack | undefined {
    const retrieval = options as
      | { pack?: ArxenaToolPack; toolPack?: ArxenaToolPack }
      | undefined;

    return retrieval?.pack ?? retrieval?.toolPack;
  }

  private async resolveApiToken(
    context: ToolProviderContext,
  ): Promise<string | null> {
    const authContext = context.authContext;

    if (authContext?.type === 'apiKey') {
      const apiKeyContext = authContext as ApiKeyWorkspaceAuthContext & {
        apiKey: { token?: string };
      };

      if (isDefined(apiKeyContext.apiKey?.token)) {
        return apiKeyContext.apiKey.token;
      }
    }

    if (isDefined(context.userId)) {
      const { token } = await this.accessTokenService.generateAccessToken({
        userId: context.userId,
        workspaceId: context.workspaceId,
        authProvider: AuthProviderEnum.Password,
      });

      return token;
    }

    return null;
  }

  async generateDescriptors(
    context: ToolProviderContext,
    options?: GenerateDescriptorOptions,
  ): Promise<(ToolIndexEntry | ToolDescriptor)[]> {
    const includeSchemas = options?.includeSchemas ?? true;
    const packFilter = this.resolvePackFilter(options);
    const catalogEntries = ARXENA_TOOL_CATALOG.filter(
      (entry) =>
        !ARXENA_INTERNAL_TOOL_NAMES.has(entry.name) &&
        (!isDefined(packFilter) || entry.pack === packFilter),
    );

    let schemaByName = new Map<string, object>();

    if (includeSchemas) {
      const apiToken = await this.resolveApiToken(context);

      if (isDefined(apiToken)) {
        try {
          const mcpTools =
            await this.arxenaMcpBridgeService.listTools(apiToken);

          schemaByName = new Map(
            mcpTools
              .filter((tool) => isDefined(tool.inputSchema))
              .map((tool) => [tool.name, tool.inputSchema as object]),
          );
        } catch (error) {
          this.logger.warn(
            `Failed to load Arxena MCP schemas: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
    }

    return catalogEntries.map((entry) => {
      const base: ToolIndexEntry = {
        name: entry.name,
        label: entry.label,
        description: entry.description,
        category: ToolCategory.ARXENA,
        executionRef: { kind: 'static', toolId: entry.name },
      };

      if (!includeSchemas) {
        return base;
      }

      return {
        ...base,
        inputSchema: schemaByName.get(entry.name) ?? {
          type: 'object',
          properties: {},
        },
      } satisfies ToolDescriptor;
    });
  }

  async executeStaticTool(
    toolName: string,
    args: Record<string, unknown>,
    context: ToolProviderContext,
  ): Promise<ToolOutput> {
    const apiToken = await this.resolveApiToken(context);

    if (!isDefined(apiToken)) {
      return {
        success: false,
        message: 'Missing API token for Arxena tool execution',
        error: 'UNAUTHORIZED',
      };
    }

    try {
      const result = await this.arxenaMcpBridgeService.callTool(
        apiToken,
        context.userWorkspaceId,
        toolName,
        args,
      );
      const text = extractTextFromMcpResult(result);
      let parsed: object = { raw: text };

      try {
        parsed = JSON.parse(text) as object;
      } catch {
        parsed = { raw: text };
      }

      const isError =
        typeof result === 'object' &&
        isDefined(result) &&
        (result as { isError?: boolean }).isError === true;

      return {
        success: !isError,
        message: isError
          ? `Arxena tool ${toolName} failed`
          : `Arxena tool ${toolName} completed`,
        result: parsed,
        error: isError ? text : undefined,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(`Arxena tool ${toolName} failed: ${message}`);

      return {
        success: false,
        message: `Arxena tool ${toolName} failed`,
        error: message,
      };
    }
  }
}
