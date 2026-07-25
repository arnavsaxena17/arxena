export const MCP_SERVER_URL = 'https://mcp.arxena.com/mcp';
export const MCP_DOCS_URL = 'https://mcp.arxena.com/docs/mcp';
export const MCP_OAUTH_ISSUER_URL = 'https://mcp.arxena.com';
export const ARXENA_APP_BASE_URL = 'https://app.arxena.com';

export const MCP_CURSOR_CONFIG_EXAMPLE = `{
  "mcpServers": {
    "arxena": {
      "url": "${MCP_SERVER_URL}",
      "headers": {
        "X-API-KEY": "<your-workspace-api-key-jwt>"
      }
    }
  }
}`;

/** Claude Desktop claude_desktop_config.json — stdio bridge via mcp-remote */
export const MCP_CLAUDE_DESKTOP_CONFIG_EXAMPLE = `{
  "mcpServers": {
    "arxena": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "${MCP_SERVER_URL}",
        "--header",
        "X-API-KEY: \${ARXENA_API_KEY}"
      ],
      "env": {
        "ARXENA_API_KEY": "<your-workspace-api-key-jwt>"
      }
    }
  }
}`;

/** @deprecated Use MCP_CURSOR_CONFIG_EXAMPLE */
export const MCP_REMOTE_CONFIG_EXAMPLE = MCP_CURSOR_CONFIG_EXAMPLE;

export const MCP_STDIO_CONFIG_EXAMPLE = `{
  "mcpServers": {
    "arxena": {
      "command": "node",
      "args": ["/path/to/arxena/packages/twenty-mcp-server/dist/index.js"],
      "env": {
        "ARXENA_API_TOKEN": "<your-workspace-api-key-jwt>",
        "ARXENA_BASE_URL": "${ARXENA_APP_BASE_URL}"
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
