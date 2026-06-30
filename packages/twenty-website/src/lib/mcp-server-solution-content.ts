export const MCP_SERVER_URL = 'https://mcp.arxena.com/mcp';
export const MCP_DOCS_URL = 'https://mcp.arxena.com/docs/mcp';
export const MCP_OAUTH_ISSUER_URL = 'https://mcp.arxena.com';

export const MCP_REMOTE_CONFIG_EXAMPLE = `{
  "mcpServers": {
    "arxena": {
      "url": "${MCP_SERVER_URL}",
      "headers": {
        "X-API-KEY": "<your-workspace-api-key-jwt>"
      }
    }
  }
}`;

export const MCP_STDIO_CONFIG_EXAMPLE = `{
  "mcpServers": {
    "arxena": {
      "command": "node",
      "args": ["/path/to/arxena/packages/twenty-mcp-server/dist/index.js"],
      "env": {
        "ARXENA_API_TOKEN": "<your-workspace-api-key-jwt>",
        "ARXENA_BASE_URL": "https://app.arxena.com"
      }
    }
  }
}`;

export const MCP_SERVER_SOLUTION_PAGE = {
  slug: 'mcp-server',
  title: 'MCP server',
  headline: 'Connect Arxena to Cursor, Claude, and ChatGPT',
  metaDescription:
    'Use the Arxena remote MCP server to query org charts, candidates, and outreach from your AI client—with your workspace API key.',
  lead: 'Arxena exposes a remote Model Context Protocol (MCP) server so authorized AI clients can read and act on your recruitment workspace—org charts, candidates, jobs, and messaging—using the same data you see in the app.',
};
