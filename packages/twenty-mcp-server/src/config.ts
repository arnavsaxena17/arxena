export interface ArxenaConfig {
  apiToken: string;
  baseUrl: string;
  workspaceMemberId?: string;
}

export type HttpServerConfig = {
  arxenaBaseUrl: string;
  mcpPublicUrl: string;
  mcpHttpPort: number;
  mcpHttpPath: string;
  mcpPublicToolsOnly: boolean;
  oauthEnabled: boolean;
  oauthIssuerUrl: string;
  privacyPolicyUrl: string;
  documentationUrl: string;
};

export function loadConfig(): ArxenaConfig {
  const apiToken = process.env.ARXENA_API_TOKEN;
  const baseUrl = process.env.ARXENA_BASE_URL ?? 'http://localhost:3000';
  const workspaceMemberId = process.env.ARXENA_WORKSPACE_MEMBER_ID;

  if (!apiToken) {
    throw new Error(
      'ARXENA_API_TOKEN environment variable is required. ' +
        'Set it in your MCP server config (claude_desktop_config.json or .claude/mcp.json).',
    );
  }

  return { apiToken, baseUrl, workspaceMemberId };
}

export function loadHttpServerConfig(): HttpServerConfig {
  const arxenaBaseUrl = (
    process.env.ARXENA_BASE_URL ?? 'http://localhost:3000'
  ).replace(/\/$/, '');
  const mcpPublicUrl = (
    process.env.MCP_PUBLIC_URL ?? 'https://mcp.arxena.com/mcp'
  ).replace(/\/$/, '');
  const oauthIssuerUrl = (
    process.env.MCP_OAUTH_ISSUER_URL ?? mcpPublicUrl.replace(/\/mcp$/, '')
  ).replace(/\/$/, '');

  return {
    arxenaBaseUrl,
    mcpPublicUrl,
    mcpHttpPort: Number(process.env.MCP_HTTP_PORT ?? '3005'),
    mcpHttpPath: process.env.MCP_HTTP_PATH ?? '/mcp',
    mcpPublicToolsOnly: (process.env.MCP_PUBLIC_TOOLS_ONLY ?? 'true') === 'true',
    oauthEnabled: (process.env.MCP_OAUTH_ENABLED ?? 'true') === 'true',
    oauthIssuerUrl,
    privacyPolicyUrl:
      process.env.MCP_PRIVACY_POLICY_URL ?? 'https://arxena.com/legal/privacy',
    documentationUrl:
      process.env.MCP_DOCUMENTATION_URL ?? 'https://arxena.com/docs/mcp',
  };
}
