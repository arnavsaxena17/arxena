# Workspace MCP endpoint

The public [Model Context Protocol](https://modelcontextprotocol.io) endpoint of Arxena is the NestJS `/mcp`
route in this folder (`https://mcp.arxena.com/mcp`). Instructions, skills and tool catalog browsing are built
here (`McpInstructionBuilderService`, `SkillService`, `ToolRegistryService`).

The Arxena GTM tool handlers behind it are an ordinary folder of `twenty-server`:
`src/engine/core-modules/arxena-tools/library`. `ArxenaMcpBridgeService` calls `callArxenaTool(config, name, args)`
from there. There is no separate package, process or build for them. Descriptions for the generic tools live in
`twenty-shared/src/outreach/mcp-tool-descriptions.ts`.

## Production routing

`mcp.arxena.com` is served directly from EC2 by nginx (`scripts/nginx/mcp-arxena.conf.snippet`, proxying to
`twenty-server` on port 3000), and the app routes `/mcp`, `/oauth/*` and `/.well-known/*` are in
`scripts/nginx/twenty-mcp-oauth-locations.conf.snippet`. The server env needs `API_ONLY_HOSTS=mcp.arxena.com` so
OAuth `/authorize` is sent to the default frontend. Allowlist Anthropic egress `160.79.104.0/21` if using the
Claude directory.

Public setup guide: https://arxena.com/solutions/mcp-server

## Client config

Generate the JWT in **Settings → Developers → API Keys** (copy-paste configs on the API key detail page).

### Cursor

```json
{
  "mcpServers": {
    "arxena": {
      "url": "https://mcp.arxena.com/mcp",
      "headers": { "X-API-KEY": "<workspace-api-key-jwt>" }
    }
  }
}
```

### Claude Desktop (`claude_desktop_config.json`)

Claude Desktop only supports stdio in the JSON config — use `mcp-remote` to reach the hosted server:

```json
{
  "mcpServers": {
    "arxena": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://mcp.arxena.com/mcp",
        "--header",
        "X-API-KEY: ${ARXENA_API_KEY}"
      ],
      "env": {
        "ARXENA_API_KEY": "<workspace-api-key-jwt>"
      }
    }
  }
}
```

Quit Claude Desktop fully (Cmd+Q) after editing the config.

**Alternative:** Settings → Connectors → add `https://mcp.arxena.com/mcp` for OAuth (directory flow).

## Directory publication

- **Privacy policy:** https://arxena.com/legal/privacy/mcp
- **OAuth:** platform OAuth on `twenty-server` (dynamic client registration at `/oauth/register`, consent on the frontend `/authorize`)
- **Claude callback:** `https://claude.ai/api/mcp/auth_callback`
- **OpenAI:** top-level `search` + `fetch` (company knowledge)

## Tool library entry points

`callArxenaTool` routes four names, which is all the server uses:

| Tool | Role |
| --- | --- |
| `learn_tools` | Return input schemas for named Arxena tools (used to build the server's tool descriptors) |
| `execute_tool` | Run an Arxena tool handler by name |
| `search` / `fetch` | Company-knowledge lookups, called top-level by the server's `search` / `fetch` MCP tools |

The server passes `disabledToolNames` (its `IS_SEARCH_*_ENABLED` flags) and a `restTransport` in the config.
A handler that used to call this server's own REST API is answered in process when the transport has a route for
it (`ArxenaInProcessRestTransportService`), and over HTTP otherwise. Set `ARXENA_IN_PROCESS_TOOLS=false` to send
everything over HTTP.
