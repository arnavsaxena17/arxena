import { Injectable, Logger } from '@nestjs/common';

import { ToolCategory } from 'twenty-shared/ai';
import { isDefined } from 'twenty-shared/utils';

import { DownstreamMcpConnectionManager } from 'src/engine/core-modules/mcp-federation/services/downstream-mcp-connection.manager';
import { WorkspaceMcpServerService } from 'src/engine/core-modules/mcp-federation/services/workspace-mcp-server.service';
import { type GenerateDescriptorOptions } from 'src/engine/core-modules/tool-provider/interfaces/generate-descriptor-options.type';
import { type ToolProvider } from 'src/engine/core-modules/tool-provider/interfaces/tool-provider.interface';
import { type ToolProviderContext } from 'src/engine/core-modules/tool-provider/interfaces/tool-provider-context.type';
import { type ToolDescriptor } from 'src/engine/core-modules/tool-provider/types/tool-descriptor.type';
import { type ToolIndexEntry } from 'src/engine/core-modules/tool-provider/types/tool-index-entry.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';

const NAMESPACE_SEPARATOR = '__';

const parseNamespacedName = (
  toolName: string,
): { slug: string; originalName: string } | null => {
  const separatorIndex = toolName.indexOf(NAMESPACE_SEPARATOR);

  if (separatorIndex <= 0) {
    return null;
  }

  return {
    slug: toolName.slice(0, separatorIndex),
    originalName: toolName.slice(separatorIndex + NAMESPACE_SEPARATOR.length),
  };
};

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
export class DownstreamMcpToolProvider implements ToolProvider {
  readonly category = ToolCategory.EXTERNAL_MCP;
  private readonly logger = new Logger(DownstreamMcpToolProvider.name);

  constructor(
    private readonly workspaceMcpServerService: WorkspaceMcpServerService,
    private readonly connectionManager: DownstreamMcpConnectionManager,
  ) {}

  async isAvailable(_context: ToolProviderContext): Promise<boolean> {
    return true;
  }

  async generateDescriptors(
    context: ToolProviderContext,
    options?: GenerateDescriptorOptions,
  ): Promise<(ToolIndexEntry | ToolDescriptor)[]> {
    const includeSchemas = options?.includeSchemas ?? true;
    const servers = await this.workspaceMcpServerService.findEnabled(
      context.workspaceId,
    );
    const descriptors: (ToolIndexEntry | ToolDescriptor)[] = [];

    for (const server of servers) {
      const tools = this.workspaceMcpServerService.getCachedTools(server);

      for (const tool of tools) {
        const namespacedName = `${server.slug}${NAMESPACE_SEPARATOR}${tool.name}`;
        const base: ToolIndexEntry = {
          name: namespacedName,
          label: `${server.label}: ${tool.name}`,
          description:
            tool.description ??
            `Tool ${tool.name} from MCP server ${server.label}`,
          category: ToolCategory.EXTERNAL_MCP,
          executionRef: { kind: 'static', toolId: namespacedName },
        };

        if (!includeSchemas) {
          descriptors.push(base);
          continue;
        }

        descriptors.push({
          ...base,
          inputSchema: tool.inputSchema ?? {
            type: 'object',
            properties: {},
          },
        } satisfies ToolDescriptor);
      }
    }

    return descriptors;
  }

  async executeStaticTool(
    toolName: string,
    args: Record<string, unknown>,
    context: ToolProviderContext,
  ): Promise<ToolOutput> {
    const parsed = parseNamespacedName(toolName);

    if (!isDefined(parsed)) {
      return {
        success: false,
        message: `Invalid external MCP tool name: ${toolName}`,
        error: 'INVALID_TOOL_NAME',
      };
    }

    const servers = await this.workspaceMcpServerService.findEnabled(
      context.workspaceId,
    );
    const server = servers.find((entry) => entry.slug === parsed.slug);

    if (!isDefined(server)) {
      return {
        success: false,
        message: `MCP server '${parsed.slug}' not found or disabled`,
        error: 'SERVER_NOT_FOUND',
      };
    }

    try {
      const result = await this.connectionManager.callTool(
        {
          url: server.url,
          authHeaderName: server.authHeaderName,
          authToken:
            this.workspaceMcpServerService.decryptAuthToken(server),
          timeoutMs: server.timeoutMs,
        },
        parsed.originalName,
        args,
      );
      const text = extractTextFromMcpResult(result);
      let parsedResult: object = { raw: text };

      try {
        parsedResult = JSON.parse(text) as object;
      } catch {
        parsedResult = { raw: text };
      }

      const isError =
        typeof result === 'object' &&
        isDefined(result) &&
        (result as { isError?: boolean }).isError === true;

      return {
        success: !isError,
        message: isError
          ? `External MCP tool ${toolName} failed`
          : `External MCP tool ${toolName} completed`,
        result: parsedResult,
        error: isError ? text : undefined,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(`External MCP tool ${toolName} failed: ${message}`);

      return {
        success: false,
        message: `External MCP tool ${toolName} failed`,
        error: message,
      };
    }
  }
}
