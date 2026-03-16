export interface ArxenaConfig {
  apiToken: string;
  baseUrl: string;
  workspaceMemberId?: string;
}

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
