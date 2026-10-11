# Arxena MCP Server

[Model Context Protocol](https://modelcontextprotocol.io) tool library for the Arxena recruitment platform.

## How it is used

| Where | How | Use case |
|------|-----|----------|
| `twenty-server` | spawns `dist/index.js` over stdio per tool call (`ArxenaMcpBridgeService`) | Arxena GTM tools behind `https://mcp.arxena.com/mcp` and Ask AI |
| Local debugging | `yarn start` / `dist/index.js` | Inspect handlers with `MCP_FLAT_TOOLS=true` |

The public HTTP endpoint is the NestJS `/mcp` in `twenty-server` (`packages/twenty-server/src/engine/api/mcp`).
This package no longer ships its own HTTP server or OAuth; the old standalone `arxena-mcp-http`
process (port 3005) was removed.

Production routing: `mcp.arxena.com` is served directly from EC2 by nginx (`scripts/nginx/mcp-arxena.conf.snippet`,
proxying to `twenty-server` on port 3000) and the app routes `/mcp`, `/oauth/*` and `/.well-known/*`
are in `scripts/nginx/twenty-mcp-oauth-locations.conf.snippet`. The server env needs `API_ONLY_HOSTS=mcp.arxena.com`
so OAuth `/authorize` is sent to the default frontend. Allowlist Anthropic egress `160.79.104.0/21` if using the Claude directory.

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

## Tools (internal)

This process is not a user-facing MCP server. `twenty-server` spawns it per call and uses four tools:

| Tool | Role |
| --- | --- |
| `learn_tools` | Return input schemas for named Arxena tools (used to build the server's tool descriptors) |
| `execute_tool` | Run an Arxena tool handler by name |
| `search` / `fetch` | Company-knowledge lookups, called top-level by the server's `search` / `fetch` MCP tools |

Instructions, skills (`load_skills` / `list_skills`) and tool catalog browsing are served only by the
NestJS `/mcp` endpoint (`McpInstructionBuilderService`, `SkillService`, `ToolRegistryService`); there is no
second instruction builder here. Tool descriptions for the generic tools live in
`twenty-shared/src/outreach/mcp-tool-descriptions.ts`.

Set `MCP_FLAT_TOOLS=true` only for local debugging (lists every handler). Tool `title` and `readOnlyHint`/`destructiveHint` annotations are applied via `utils/tool-metadata.ts`.
