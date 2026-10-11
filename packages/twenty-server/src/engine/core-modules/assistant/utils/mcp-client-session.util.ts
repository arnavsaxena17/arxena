import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { throwIfAborted } from './mcp-assistant-abort.util';

export type McpClientSessionConfig = {
  // Base URL of this server; the client talks to its own public /mcp endpoint
  // so the assistant gets the same tools, auth and workspace scoping as any MCP client.
  serverBaseUrl: string;
  apiToken: string;
};

export const buildMcpEndpointUrl = (serverBaseUrl: string): URL =>
  new URL(`${serverBaseUrl.replace(/\/+$/, '')}/mcp`);

export const createMcpClient = async (
  config: McpClientSessionConfig,
  signal?: AbortSignal,
): Promise<Client> => {
  const client = new Client({
    name: 'arxena-assistant-client',
    version: '1.0.0',
  });
  const transport = new StreamableHTTPClientTransport(
    buildMcpEndpointUrl(config.serverBaseUrl),
    {
      requestInit: {
        headers: {
          Authorization: `Bearer ${config.apiToken.replace(/[\r\n]+/g, '')}`,
        },
        ...(signal ? { signal } : {}),
      },
    },
  );

  await client.connect(transport);

  return client;
};

export const withMcpClient = async <T>(
  config: McpClientSessionConfig,
  signal: AbortSignal | undefined,
  fn: (client: Client) => Promise<T>,
): Promise<T> => {
  throwIfAborted(signal);
  const client = await createMcpClient(config, signal);
  const abortHandler = () => {
    void client.close().catch(() => undefined);
  };

  signal?.addEventListener('abort', abortHandler, { once: true });

  try {
    throwIfAborted(signal);

    return await fn(client);
  } finally {
    signal?.removeEventListener('abort', abortHandler);
    await client.close();
  }
};
