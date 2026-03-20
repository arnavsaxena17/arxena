import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { throwIfAborted } from './mcp-assistant-abort.util';

export type McpClientSessionConfig = {
  serverBaseUrl: string;
  mcpServerScriptPath: string;
  apiToken: string;
  workspaceMemberId?: string | null;
};

export const withMcpClient = async <T>(
  config: McpClientSessionConfig,
  signal: AbortSignal | undefined,
  fn: (client: Client) => Promise<T>,
): Promise<T> => {
  throwIfAborted(signal);
  const client = new Client({
    name: 'arxena-assistant-client',
    version: '1.0.0',
  });
  const env: Record<string, string> = { ...process.env } as Record<
    string,
    string
  >;
  env.ARXENA_API_TOKEN = config.apiToken.replace(/[\r\n]+/g, '');
  env.ARXENA_BASE_URL = config.serverBaseUrl;
  if (config.workspaceMemberId != null && config.workspaceMemberId !== '') {
    env.ARXENA_WORKSPACE_MEMBER_ID = config.workspaceMemberId;
  }
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [config.mcpServerScriptPath],
    env,
  });
  const abortHandler = () => {
    void client.close().catch(() => undefined);
  };
  signal?.addEventListener('abort', abortHandler, { once: true });
  await client.connect(transport);
  try {
    throwIfAborted(signal);
    return await fn(client);
  } finally {
    signal?.removeEventListener('abort', abortHandler);
    await client.close();
  }
};
