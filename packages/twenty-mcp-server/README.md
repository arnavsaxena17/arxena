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

## Client config (Cursor)

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

Generate the JWT in **Settings → Developers → API Keys**.

## Directory publication

- **Privacy policy:** https://arxena.com/legal/privacy/mcp
- **Docs:** https://mcp.arxena.com/docs/mcp
- **OAuth:** `MCP_OAUTH_ENABLED=true` with consent at `/oauth/consent`
- **Claude callback:** `https://claude.ai/api/mcp/auth_callback`
- **OpenAI:** implement `search` + `fetch` tools (included in `publicTools`)

## Tools

~99 public tools (org charts, candidates, LinkedIn search, messaging) plus `search`/`fetch` for company knowledge. Tool `title` and `readOnlyHint`/`destructiveHint` annotations are applied automatically via `utils/tool-metadata.ts`.
