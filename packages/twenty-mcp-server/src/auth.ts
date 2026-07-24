import { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';

import { ArxenaConfig } from './config';

const MCP_RESULT_MAX_CHARS = 100_000;

export const extractApiTokenFromHeaders = (
  headers: Record<string, string | string[] | undefined>,
): string | undefined => {
  const apiKeyHeader = headers['x-api-key'];
  if (typeof apiKeyHeader === 'string' && apiKeyHeader.trim()) {
    return apiKeyHeader.trim();
  }

  const authorization = headers.authorization;
  if (typeof authorization === 'string' && authorization.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length).trim();
  }

  return undefined;
};

export const validateApiToken = async (
  baseUrl: string,
  apiToken: string,
): Promise<boolean> => {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
  const response = await fetch(`${normalizedBaseUrl}/assistant/threads`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiToken}`,
    },
  });

  return response.ok;
};

export const buildArxenaConfigFromToken = (
  apiToken: string,
  baseUrl: string,
  workspaceMemberId?: string,
): ArxenaConfig => ({
  apiToken,
  baseUrl: baseUrl.replace(/\/$/, ''),
  workspaceMemberId,
});

export const createAuthInfoFromToken = (
  token: string,
  resourceUrl: string,
): AuthInfo => ({
  token,
  clientId: 'arxena-mcp',
  scopes: ['mcp'],
  extra: {},
  resource: new URL(resourceUrl),
});

export const truncateToolResult = (value: unknown): unknown => {
  const serialized = JSON.stringify(value);
  if (serialized.length <= MCP_RESULT_MAX_CHARS) {
    return value;
  }

  return {
    truncated: true,
    message: `Result exceeded ${MCP_RESULT_MAX_CHARS} characters and was truncated.`,
    preview: serialized.slice(0, MCP_RESULT_MAX_CHARS),
  };
};
