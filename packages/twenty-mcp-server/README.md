# Arxena MCP Server

Remote [Model Context Protocol](https://modelcontextprotocol.io) server for the Arxena recruitment platform.

## Modes

| Mode | Entry | Use case |
|------|-------|----------|
| stdio | `yarn start` / `dist/index.js` | Claude Desktop local, in-app assistant subprocess |
| HTTP | `yarn start:http` / `dist/http-index.js` | Cursor, Claude custom connector, ChatGPT developer mode |

## HTTP deployment

1. Build: `yarn build`
2. Configure env (see `.env.example`)
3. Start: `pm2 start ../../ecosystem.config.js --only arxena-mcp-http` (from repo root on production)
4. Proxy `mcp.arxena.com` using `scripts/nginx/mcp-arxena.conf.snippet`
5. Allowlist Anthropic egress `160.79.104.0/21` if using Claude directory

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

### Local stdio (optional)

```json
{
  "mcpServers": {
    "arxena": {
      "command": "node",
      "args": ["/path/to/twenty-mcp-server/dist/index.js"],
      "env": {
        "ARXENA_API_TOKEN": "<workspace-api-key-jwt>",
        "ARXENA_BASE_URL": "https://app.arxena.com"
      }
    }
  }
}
```

## Directory publication

- **Privacy policy:** https://arxena.com/legal/privacy/mcp
- **Docs:** https://mcp.arxena.com/docs/mcp
- **OAuth:** `MCP_OAUTH_ENABLED=true` with consent at `/oauth/consent`
- **Claude callback:** `https://claude.ai/api/mcp/auth_callback`
- **OpenAI:** implement `search` + `fetch` tools (included in `publicTools`)

## Tools

~99 public tools (org charts, candidates, LinkedIn search, messaging) plus `search`/`fetch` for company knowledge. Tool `title` and `readOnlyHint`/`destructiveHint` annotations are applied automatically via `utils/tool-metadata.ts`.
