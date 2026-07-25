import { createHash } from 'crypto';

import { Injectable, Logger } from '@nestjs/common';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

import { isDefined } from 'twenty-shared/utils';

export type DownstreamMcpCachedTool = {
  name: string;
  description?: string;
  inputSchema?: object;
};

export type DownstreamMcpConnectOptions = {
  url: string;
  authHeaderName?: string;
  authToken?: string;
  timeoutMs: number;
};

@Injectable()
export class DownstreamMcpConnectionManager {
  private readonly logger = new Logger(DownstreamMcpConnectionManager.name);

  hashCatalog(tools: DownstreamMcpCachedTool[]): string {
    return createHash('sha256')
      .update(
        JSON.stringify(
          tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
          })),
        ),
      )
      .digest('hex')
      .slice(0, 32);
  }

  async listTools(
    options: DownstreamMcpConnectOptions,
  ): Promise<DownstreamMcpCachedTool[]> {
    return this.withClient(options, async (client) => {
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
  }

  async callTool(
    options: DownstreamMcpConnectOptions,
    name: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    return this.withClient(options, async (client) => {
      return client.callTool({ name, arguments: args });
    });
  }

  private async withClient<T>(
    options: DownstreamMcpConnectOptions,
    fn: (client: Client) => Promise<T>,
  ): Promise<T> {
    const client = new Client({
      name: 'arxena-downstream-mcp',
      version: '1.0.0',
    });

    const headers: Record<string, string> = {};

    if (isDefined(options.authToken) && options.authToken !== '') {
      const headerName = options.authHeaderName ?? 'Authorization';
      const value =
        headerName.toLowerCase() === 'authorization' &&
        !options.authToken.toLowerCase().startsWith('bearer ')
          ? `Bearer ${options.authToken}`
          : options.authToken;

      headers[headerName] = value;
    }

    const transport = new StreamableHTTPClientTransport(new URL(options.url), {
      requestInit: { headers },
    });

    const timeoutMs = options.timeoutMs > 0 ? options.timeoutMs : 30000;

    await Promise.race([
      client.connect(transport),
      new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error(`MCP connect timed out after ${timeoutMs}ms`)),
          timeoutMs,
        );
      }),
    ]);

    try {
      return await Promise.race([
        fn(client),
        new Promise<never>((_, reject) => {
          setTimeout(
            () =>
              reject(new Error(`MCP request timed out after ${timeoutMs}ms`)),
            timeoutMs,
          );
        }),
      ]);
    } finally {
      await client.close().catch((error) => {
        this.logger.warn(
          `Failed to close downstream MCP client: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      });
    }
  }
}
