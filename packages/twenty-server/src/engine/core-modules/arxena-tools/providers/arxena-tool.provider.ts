import {
  ARXENA_INTERNAL_TOOL_NAMES,
  ARXENA_TOOL_CATALOG,
} from 'src/engine/core-modules/arxena-tools/constants/arxena-tool-catalog.const';
import { Injectable, Logger, Optional } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { ToolCategory } from 'twenty-shared/ai';
import { isDefined } from 'twenty-shared/utils';

import { applyDefaultProjectId } from 'src/engine/core-modules/arxena-tools/utils/apply-default-project-id.util';
import {
  getDisabledSearchToolNames,
  isSearchToolEnabled,
  resolveSearchToolsConfig,
} from 'src/engine/core-modules/arxena-tools/utils/search-tools-config.util';
import { ArxenaInProcessRestTransportService } from 'src/engine/core-modules/arxena-tools/services/arxena-in-process-rest-transport.service';
import { ArxenaMcpBridgeService } from 'src/engine/core-modules/arxena-tools/services/arxena-mcp-bridge.service';

import { SourcingBudgetService } from 'src/engine/core-modules/outreach-command/services/sourcing-budget.service';
import { SourcingLedgerService } from 'src/engine/core-modules/outreach-command/services/sourcing-ledger.service';
import { sourceKeyOfTool } from 'src/engine/core-modules/tool-provider/utils/sourcing-source-guard.util';
import {
  buildEmptyTabShape,
  isOutreachTabSourceTool,
  normalizeToolOutputToTabRows,
} from 'src/engine/core-modules/outreach-command/rows/utils/outreach-rows-normalizers.util';
import { ApiKeyService } from 'src/engine/core-modules/api-key/services/api-key.service';
import { AccessTokenService } from 'src/engine/core-modules/auth/token/services/access-token.service';
import { type ApiKeyWorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { type GenerateDescriptorOptions } from 'src/engine/core-modules/tool-provider/interfaces/generate-descriptor-options.type';
import { type ToolProvider } from 'src/engine/core-modules/tool-provider/interfaces/tool-provider.interface';
import { type ToolProviderContext } from 'src/engine/core-modules/tool-provider/interfaces/tool-provider-context.type';
import { type ToolDescriptor } from 'src/engine/core-modules/tool-provider/types/tool-descriptor.type';
import { type ToolIndexEntry } from 'src/engine/core-modules/tool-provider/types/tool-index-entry.type';
import { WriteSearchRowsToProjectTabService } from 'src/engine/core-modules/tool/tools/outreach-tab-tool/write-search-rows-to-project-tab.service';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { AuthProviderEnum } from 'src/engine/core-modules/workspace/types/workspace.type';

// Token minting only needs identity fields, so top-level MCP tools (search/fetch)
// can call executeStaticTool without a full tool-provider context.
export type ArxenaToolExecutionContext = Pick<
  ToolProviderContext,
  | 'workspaceId'
  | 'authContext'
  | 'userId'
  | 'userWorkspaceId'
  | 'actorContext'
  | 'projectId'
>;

// Sources that bill per call or per record and must ask the run budget first
const PAID_SOURCE_KEYS = new Set(['bright-data', 'harvest', 'apollo', 'serp']);

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
    private readonly sourcingLedgerService: SourcingLedgerService,
    private readonly arxenaInProcessRestTransportService: ArxenaInProcessRestTransportService,
    private readonly writeSearchRowsToProjectTabService: WriteSearchRowsToProjectTabService,
    @Optional()
    private readonly sourcingBudgetService?: SourcingBudgetService,
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
    requestedArgs: Record<string, unknown>,
    context: ArxenaToolExecutionContext,
  ): Promise<ToolOutput> {
    const args = applyDefaultProjectId(
      toolName,
      requestedArgs,
      context.projectId,
    );
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

    const sourceKey = sourceKeyOfTool(toolName);

    if (
      sourceKey !== undefined &&
      PAID_SOURCE_KEYS.has(sourceKey) &&
      isNonEmptyString(context.projectId)
    ) {
      const budget = await this.sourcingBudgetService?.check({
        workspaceId: context.workspaceId,
        projectId: context.projectId,
        // No per-call estimate is available here; this refuses once the run
        // cap is spent, before another paid call goes out
        estimatedUsd: 0,
        tool: toolName,
      });

      if (isDefined(budget) && !budget.allowed) {
        return {
          success: false,
          message: `Arxena tool ${toolName} refused by the run budget`,
          error: budget.message,
        };
      }
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
          projectId: context.projectId,
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
        const listed = await this.routeResultsToTab(
          toolName,
          args,
          parsed,
          context,
        );

        if (isDefined(listed)) {
          await this.recordSearchSpend(listed, context);

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
  // written to the project tab and recorded as a search event; the model gets
  // counts, paging and a next step. A project is required.
  private async routeResultsToTab(
    toolName: string,
    args: Record<string, unknown>,
    parsed: object,
    context: ArxenaToolExecutionContext,
  ): Promise<Record<string, unknown> | undefined> {
    if (!isOutreachTabSourceTool(toolName)) {
      return undefined;
    }

    const workspaceId = context.workspaceId;

    try {
      const normalized =
        normalizeToolOutputToTabRows(toolName, args, parsed) ??
        buildEmptyTabShape(toolName, args, parsed);

      if (!isDefined(normalized)) {
        return undefined;
      }

      const paging = this.extractPaging(parsed);
      const projectId = isNonEmptyString(args.projectId)
        ? args.projectId.trim()
        : '';

      if (projectId === '') {
        return {
          error:
            'projectId is required. Open the project whose tab should receive the rows, then retry.',
          entity: normalized.entity,
          source: normalized.source,
          fetched: normalized.rows.length,
          added: 0,
          duplicates: 0,
          total: 0,
          ephemeralWritten: 0,
          ...paging,
          nextStep:
            'Nothing was written. Open or name a project, then run the search again.',
        };
      }

      const rows = normalized.rows;
      const uniqueKeys = new Set(
        rows.map((row) =>
          (
            row.domain ||
            row.linkedinUrl ||
            row.email ||
            row.name ||
            ''
          ).toLowerCase(),
        ),
      );
      const duplicates = Math.max(0, rows.length - uniqueKeys.size);
      const tab =
        rows.length === 0
          ? { written: 0, total: 0, createdCount: 0, updatedCount: 0 }
          : await this.writeSearchRowsToProjectTabService.write({
              projectId,
              entity: normalized.entity,
              rows,
              context: { workspaceId },
            });

      await this.sourcingLedgerService.append(workspaceId, projectId, {
        kind: 'search',
        at: new Date().toISOString(),
        source: normalized.source,
        entity: normalized.entity,
        query: normalized.label || toolName,
        fetched: rows.length,
        duplicates,
        newUnique: tab.createdCount,
        alreadyKnown: tab.updatedCount,
        spentUsd: normalized.spentUsd ?? 0,
      });

      const emptyResult = rows.length === 0;
      const nextStep = emptyResult
        ? 'The search returned no rows. It is recorded for coverage; the tab is unchanged.'
        : tab.error === undefined
          ? 'Records were written to the project tab. To create CRM records call save_outreach_targets_to_crm with the same projectId. Use get_outreach_tab to read the tab.'
          : `The search returned rows but the tab write failed: ${tab.error}. Retry the search.`;

      return {
        entity: normalized.entity,
        source: normalized.source,
        fetched: rows.length,
        added: tab.written,
        duplicates,
        // Rows new to the project tab vs rows that merged into one already
        // there: the overlap with earlier queries in the same run
        newUnique: tab.createdCount,
        alreadyKnown: tab.updatedCount,
        ...(emptyResult && { emptyResult: true }),
        total: tab.written,
        ephemeralWritten: tab.written,
        ...(normalized.spentUsd !== undefined
          ? { costUsd: normalized.spentUsd }
          : {}),
        ...(tab.error !== undefined && { ephemeralError: tab.error }),
        ...paging,
        nextStep,
      };
    } catch (error) {
      this.logger.warn(
        `Could not route ${toolName} results to the project tab: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return undefined;
    }
  }

  // The provider reports what it billed; add it to the run's spend so the
  // next paid tool sees the smaller remainder
  private async recordSearchSpend(
    listed: Record<string, unknown>,
    context: ArxenaToolExecutionContext,
  ): Promise<void> {
    const costUsd = listed.costUsd;

    if (
      typeof costUsd !== 'number' ||
      costUsd <= 0 ||
      !isNonEmptyString(context.projectId)
    ) {
      return;
    }

    await this.sourcingBudgetService
      ?.recordSpend({
        workspaceId: context.workspaceId,
        projectId: context.projectId,
        usd: costUsd,
      })
      .catch(() => undefined);
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
      // Pages the server followed for a maxPages call, and why it stopped
      ...(record.autoContinue ? { autoContinue: record.autoContinue } : {}),
      ...(record.paging ? { paging: record.paging } : {}),
      ...(organizations?.pagination
        ? { paging: organizations.pagination }
        : {}),
      ...(searchResults?.paging ? { paging: searchResults.paging } : {}),
    };
  }
}
