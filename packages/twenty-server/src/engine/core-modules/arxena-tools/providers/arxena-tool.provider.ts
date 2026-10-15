import {
  ARXENA_INTERNAL_TOOL_NAMES,
  ARXENA_TOOL_CATALOG,
} from 'src/engine/core-modules/arxena-tools/constants/arxena-tool-catalog.const';
import { Injectable, Logger } from '@nestjs/common';

import { ToolCategory } from 'twenty-shared/ai';
import { isDefined } from 'twenty-shared/utils';

import {
  getDisabledSearchToolNames,
  isSearchToolEnabled,
  resolveSearchToolsConfig,
} from 'src/engine/core-modules/arxena-tools/utils/search-tools-config.util';
import { ArxenaInProcessRestTransportService } from 'src/engine/core-modules/arxena-tools/services/arxena-in-process-rest-transport.service';
import { ArxenaMcpBridgeService } from 'src/engine/core-modules/arxena-tools/services/arxena-mcp-bridge.service';
import { createHash } from 'crypto';

import { v5 } from 'uuid';

import { OUTREACH_LIST_FILE_NAMESPACE } from 'src/engine/core-modules/outreach-list/outreach-list.constants';
import { OutreachListService } from 'src/engine/core-modules/outreach-list/services/outreach-list.service';
import {
  isOutreachListSourceTool,
  normalizeToolOutputToListRows,
} from 'src/engine/core-modules/outreach-list/utils/outreach-list-normalizers.util';
import { ApiKeyService } from 'src/engine/core-modules/api-key/services/api-key.service';
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

// Token minting only needs identity fields, so top-level MCP tools (search/fetch)
// can call executeStaticTool without a full tool-provider context.
export type ArxenaToolExecutionContext = Pick<
  ToolProviderContext,
  'workspaceId' | 'authContext' | 'userId' | 'userWorkspaceId' | 'actorContext'
>;

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
    private readonly apiKeyService: ApiKeyService,
    private readonly outreachListService: OutreachListService,
    private readonly arxenaInProcessRestTransportService: ArxenaInProcessRestTransportService,
  ) {}

  async isAvailable(_context: ToolProviderContext): Promise<boolean> {
    try {
      return this.twentyConfigService.get('IS_ARXENA_TOOLS_ENABLED') !== false;
    } catch {
      return true;
    }
  }

  private async resolveApiToken(
    context: ArxenaToolExecutionContext,
  ): Promise<string | null> {
    const authContext = context.authContext;

    if (authContext?.type === 'apiKey') {
      const apiKeyContext = authContext as ApiKeyWorkspaceAuthContext;

      // The flat API key never carries the raw secret, so re-sign a token for the same key id
      const apiKeyToken = await this.apiKeyService.generateApiKeyToken(
        context.workspaceId,
        apiKeyContext.apiKey.id,
      );

      if (isDefined(apiKeyToken?.token)) {
        return apiKeyToken.token;
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
    const searchToolsConfig = resolveSearchToolsConfig(
      this.twentyConfigService,
    );
    const disabledSearchToolNames = new Set(
      getDisabledSearchToolNames(searchToolsConfig),
    );
    const catalogEntries = ARXENA_TOOL_CATALOG.filter(
      (entry) =>
        !ARXENA_INTERNAL_TOOL_NAMES.has(entry.name) &&
        !disabledSearchToolNames.has(entry.name),
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
    context: ArxenaToolExecutionContext,
  ): Promise<ToolOutput> {
    const searchToolsConfig = resolveSearchToolsConfig(
      this.twentyConfigService,
    );

    if (!isSearchToolEnabled(toolName, searchToolsConfig)) {
      return {
        success: false,
        message: `Tool "${toolName}" is not available`,
        error: `Tool "${toolName}" is disabled by server configuration`,
      };
    }

    const apiToken = await this.resolveApiToken(context);

    if (!isDefined(apiToken)) {
      return {
        success: false,
        message: 'Missing API token for Arxena tool execution',
        error: 'UNAUTHORIZED',
      };
    }

    try {
      // Handlers expect a workspace member id; a userWorkspaceId is a different id
      const result = await this.arxenaMcpBridgeService.callTool(
        apiToken,
        context.actorContext?.workspaceMemberId ?? undefined,
        toolName,
        args,
        this.arxenaInProcessRestTransportService.forContext({
          workspaceId: context.workspaceId,
          userId: context.userId,
          userWorkspaceId: context.userWorkspaceId,
        }),
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

      if (!isError) {
        const listed = await this.routeResultsToList(
          toolName,
          args,
          parsed,
          context.workspaceId,
        );

        if (isDefined(listed)) {
          return {
            success: true,
            message: `Arxena tool ${toolName} completed`,
            result: listed,
          };
        }
      }

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

  // Search results never go back to the model. Providers that return rows are
  // routed into a list (Redis + S3 backup) and the model gets the listId and
  // counts; the user reads the rows in the list, a project tab or an export.
  private async routeResultsToList(
    toolName: string,
    args: Record<string, unknown>,
    parsed: object,
    workspaceId: string,
  ): Promise<Record<string, unknown> | undefined> {
    if (!isOutreachListSourceTool(toolName)) {
      return undefined;
    }

    try {
      const normalized = normalizeToolOutputToListRows(toolName, args, parsed);

      if (!isDefined(normalized)) {
        return undefined;
      }

      const signature = createHash('sha1')
        .update(
          JSON.stringify([
            workspaceId,
            normalized.source,
            normalized.entity,
            normalized.signatureArgs,
          ]),
        )
        .digest('hex');
      const listId = v5(signature, OUTREACH_LIST_FILE_NAMESPACE);
      const outcome = await this.outreachListService.ingest({
        workspaceId,
        listId,
        name: `${normalized.source} ${normalized.entity === 'company' ? 'companies' : 'people'}: ${normalized.label.slice(0, 60) || toolName}`,
        entity: normalized.entity,
        source: normalized.source,
        rows: normalized.rows,
        query: normalized.label || undefined,
      });
      const paging = this.extractPaging(parsed);

      return {
        listId: outcome.listId,
        name: outcome.name,
        entity: outcome.entity,
        source: normalized.source,
        fetched: normalized.rows.length,
        added: outcome.added,
        duplicates: outcome.duplicates,
        total: outcome.total,
        ...paging,
        nextStep:
          'The rows are in the list, not in this result. Use the outreach_list tool: summary, peek (max 10 rows), export (CSV link for the user), dedupe, attach (show on a project tab) or save_to_crm. Do not try to read the rows.',
      };
    } catch (error) {
      this.logger.warn(
        `Could not route ${toolName} results to a list: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return undefined;
    }
  }

  // Small paging fields the model needs to ask for the next page
  private extractPaging(parsed: object): Record<string, unknown> {
    const root = (parsed as { result?: unknown }).result ?? parsed;

    if (typeof root !== 'object' || root === null) {
      return {};
    }

    const record = root as Record<string, unknown>;
    const organizations = record.organizations as
      | { pagination?: unknown }
      | undefined;
    const searchResults = record.searchResults as
      | { paging?: unknown; cursor?: unknown }
      | undefined;

    return {
      ...(typeof record.cursor === 'string' ? { cursor: record.cursor } : {}),
      ...(record.paging ? { paging: record.paging } : {}),
      ...(organizations?.pagination
        ? { paging: organizations.pagination }
        : {}),
      ...(searchResults?.paging ? { paging: searchResults.paging } : {}),
    };
  }
}
