/**
 * Type declarations for @modelcontextprotocol/sdk client when the package
 * is resolved from the workspace (e.g. via another package's node_modules).
 */
declare module '@modelcontextprotocol/sdk/client/index.js' {
  type RequestOptions = { signal?: AbortSignal; timeout?: number };

  export interface TransportLike {
    send(message: unknown): Promise<void>;
    close(): Promise<void>;
  }

  export type ClientOptions = {
    name: string;
    version: string;
    capabilities?: Record<string, unknown>;
  };

  export class Client {
    constructor(info: { name: string; version: string }, options?: ClientOptions);
    connect(transport: TransportLike, options?: RequestOptions): Promise<void>;
    close(): Promise<void>;
    listTools(): Promise<{ tools: Array<{ name: string; description?: string; inputSchema: unknown }> }>;
    callTool(params: { name: string; arguments?: Record<string, unknown> }): Promise<{
      content?: Array<{ type: string; text?: string }>;
    }>;
  }
}

declare module '@modelcontextprotocol/sdk/client/stdio.js' {
  export type StdioClientTransportOptions = {
    command: string;
    args?: string[];
    env?: Record<string, string>;
  };

  export class StdioClientTransport {
    constructor(options: StdioClientTransportOptions);
    send(message: unknown): Promise<void>;
    close(): Promise<void>;
  }
}
