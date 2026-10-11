# Plan: one public MCP endpoint (NestJS `/mcp`)

Goal: one MCP implementation, the NestJS `/mcp` in `twenty-server` (the original,
upstream design). Retire the standalone public HTTP server (`arxena-mcp-http`, port
3005). Keep `twenty-mcp-server` as an internal tool library (stdio) used by
`ArxenaMcpBridgeService`.

Evidence level: the tool diff is from reading code. The production findings below were
observed read-only on 2026-10-11 (SSH to app.arxena.com, CloudFront, Route 53, live
curl). Step 1 confirms the tool diff against running servers.

## Decision

- `https://mcp.arxena.com/mcp` is the single documented public endpoint. It is routed
  direct to EC2 (not via CloudFront), which avoids CloudFront's 60s origin read timeout
  and gives one cert, one egress allowlist and one set of docs. It is served by the
  NestJS process, not the standalone server.
- The workspace comes from the token, not the host: API-key and user JWTs carry
  `workspaceId`. OAuth needs a workspace picker on the consent step (Step 4).
- `<workspace>.arxena.com/mcp` keeps working (same app host: Route 53 `*.arxena.com` ->
  CloudFront `E1BPXH7XVPNMLJ` -> nginx :80 -> NestJS :3000) but is undocumented and acts
  as a fallback. It is also the interim path for OAuth users until the picker ships.

## Build status (updated during implementation)

Done in the repo (tests pass: `npx jest packages/twenty-server/src/engine/api/mcp` and
`.../application-oauth`):
- NestJS `search` and `fetch` top-level MCP tools (`api/mcp/tools/search-fetch.tool.ts`),
  wired in `McpProtocolService` via `ArxenaToolProvider.executeStaticTool` (bridge to the
  existing handlers). Spec updated, new unit spec added.
- `API_ONLY_HOSTS` config + `OAuthDiscoveryController.isApiHost`: hosts listed there
  (e.g. `mcp.arxena.com`) send `/authorize` to the default frontend, like `SERVER_URL`.
  This reuses the platform's own login + workspace flow, so the "picker" is the existing
  frontend login/workspace selection (needs a live browser test; see Step 4).
- Repo nginx snippets: `scripts/nginx/twenty-mcp-oauth-locations.conf.snippet` (new) and
  `mcp-arxena.conf.snippet` (upstream :3005 -> :3000). Not deployed.

Not done / needs a decision or a live environment: production nginx changes, live tool
diff and OAuth/client tests (need an API key and a browser login), catalog gap fixes.

Corrections to earlier findings:
- On `app.arxena.com`, `/.well-known/*` and `/oauth/*` are not routed to NestJS at all
  (nginx falls through to the SPA `index.html`, HTTP 200 `text/html`), in addition to the
  Host-header bug on `/mcp`. Platform OAuth discovery is currently not reachable there.
- The "catalog" side of the tool diff counted commented-out entries in
  `arxena-tool-catalog.const.ts` (e.g. `find_company_by_name`, `list_active_projects`,
  `get_project_by_id`). Those are intentionally hidden from `ARXENA_TOOL_CATALOG`; treat
  the diff as indicative until Step 1 runs live.

## Production findings (2026-10-11)

1. **OAuth discovery is broken on the NestJS endpoint.**
   `POST https://app.arxena.com/mcp` returns
   `WWW-Authenticate: Bearer resource_metadata="http://localhost:3000/.well-known/oauth-protected-resource/mcp"`.
   Cause: in `/etc/nginx/sites-enabled/twenty.conf`, the regex
   `location ~ ^/(client-config|...|mcp|...)(/.*)?$` matches before `location /mcp`
   (regex beats a plain prefix). The regex block only has `proxy_pass http://localhost:3000;`
   with no `proxy_set_header Host $host` or `X-Forwarded-Proto`, so NestJS sees
   `Host: localhost:3000` over HTTP. The dedicated `/mcp` block is dead config.
2. **CloudFront origin read timeout is 60s** (keepalive 5s). Long tool calls and idle SSE
   streams on the subdomain path are cut at 60s. `mcp.arxena.com` is an A record straight
   to EC2 (3.234.178.51) with its own Let's Encrypt cert and 3600s nginx timeouts.
3. **CORS preflight is too narrow** for browser MCP clients: the regex block's `OPTIONS`
   handler allows `authorization,content-type,x-locale,x-schema-version,x-origin-domain,origin`
   but not `x-api-key`, `mcp-session-id`, `mcp-protocol-version`, `last-event-id`.
4. **Config hygiene:** `sites-enabled` holds eight `twenty.conf.bak*` files and
   `nginx.conf` includes `sites-enabled/*`, so the backups are loaded as live config.
5. CloudFront default behaviour allows POST/GET/DELETE, so the MCP verbs pass through.
   The cache policy on the default behaviour should be verified as non-caching for `/mcp`
   (POST responses are not cached, but GET `/mcp` for SSE should be checked).

## Tool diff (code-level, to be confirmed in Step 1)

| | NestJS `/mcp` | Standalone `mcp.arxena.com` |
|---|---|---|
| Listed tools | `get_tool_catalog`, `learn_tools`, `execute_tool`, `load_skills`, `list_skills`, `list_object_metadata_names`, `search_help_center` | `get_tool_catalog`, `learn_tools`, `execute_tool`, `list_skills`, `load_skills`, `search`, `fetch` |
| Arxena GTM tools | `execute_tool` -> `ArxenaToolProvider` -> bridge (stdio subprocess of `twenty-mcp-server/dist/index.js`) | `execute_tool` in-process |
| Auth | Platform JWT guard | API key / Bearer validated via `GET /assistant/threads`; OAuth consent = paste an API key; in-memory client/code/refresh stores |

Gaps to close on NestJS:
1. `search` / `fetch` exist only on the standalone server (needed for OpenAI company
   knowledge).
2. `list_taxonomy_constants` is a public standalone tool (`people-api-tools.ts`) that is
   missing from `ARXENA_TOOL_CATALOG`, so it is unreachable via NestJS `execute_tool`.
3. ~16 extension-bridge tools (`resdex_*`, `hiring_naukri_*`, `rms_naukri_*`,
   `naukri_*`, `linkedin_send_message`, `linkedin_send_connection_request`,
   `linkedin_get_unread_messages`, `linkedin_fetch_cookies`, `whatsapp_send_message`,
   `whatsapp_send_attachment`) are in neither `publicTools` nor `internalTools`.
   Likely unreachable on both endpoints. Decide expose vs intentionally internal.
4. Catalog entries without an implementation: `send_shortlist_to_client`
   (`list_due_reminders` is commented out). They fail on either endpoint.
5. Result truncation (`truncateToolResult`, 100k chars) exists in standalone `auth.ts`.
   Confirm an equivalent cap on the NestJS `execute_tool` path.
6. Standalone is session-based (`mcp-session-id`); NestJS is stateless JSON-RPC. Test
   clients that expect a session id.

## Steps

### Step 0: fix nginx so NestJS `/mcp` is correct (0.5 day, do first, low risk)
On app.arxena.com, with a dated backup kept outside `sites-enabled`:
- Remove `mcp` from the big regex `location ~ ^/(...)` so `location /mcp` is used, or add
  `proxy_set_header Host $host; proxy_set_header X-Forwarded-Proto https; X-Forwarded-For`
  to the regex block. Preferred: a dedicated `location ^~ /mcp` (the `^~` modifier beats
  the regex) with `proxy_http_version 1.1`, `proxy_buffering off`, `proxy_read_timeout 3600s`,
  and the same for `/.well-known/`.
- Make the `/mcp` CORS preflight allow `x-api-key, mcp-session-id, mcp-protocol-version,
  last-event-id` and expose `WWW-Authenticate, mcp-session-id`.
- Move the `twenty.conf.bak*` files out of `sites-enabled`.
- `sudo nginx -t && sudo systemctl reload nginx`.
- Verify: `curl -i -X POST https://app.arxena.com/mcp ...` now returns
  `resource_metadata="https://app.arxena.com/.well-known/oauth-protected-resource/mcp"`.
- Also verify the CloudFront origin request policy forwards `Host` (the workspace
  subdomain must reach NestJS) and that `/mcp` is not cached.
- Mirror the nginx change into the repo (a checked-in snippet next to
  `scripts/nginx/mcp-arxena.conf.snippet`) so it is reproducible.

### Step 1: live tool diff (0.5 day)
- Create a workspace API key (Settings -> Developers -> API Keys).
- Run the standalone app locally (or hit production) and the NestJS server; call
  `initialize` + `tools/list`, then `get_tool_catalog`, on both. Diff names and schemas.
- Output: a parity table committed here, replacing "Tool diff" above.

### Step 2: close the tool gaps on NestJS (1-2 days)
- Add top-level `search` and `fetch` to `McpProtocolService.buildMcpToolSet`. Move the
  logic from `twenty-mcp-server/src/tools/search-fetch-tools.ts` into `twenty-shared`
  (or call it via the bridge). Output shape must match what OpenAI company knowledge
  expects (`id`, `title`, `url`, `text`, `metadata`). Add annotations and tests.
- Add `list_taxonomy_constants` to `ARXENA_TOOL_CATALOG` if public.
- Decide per extension-bridge tool: expose or keep internal; document next to
  `ARXENA_INTERNAL_TOOL_NAMES`.
- Remove or implement `send_shortlist_to_client` / `list_due_reminders`.
- Add a result-size cap on the `execute_tool` path if missing.
- Public-surface filter (replacement for `MCP_PUBLIC_TOOLS_ONLY`): rely on
  `ARXENA_INTERNAL_TOOL_NAMES` + role permissions, or add an allowlist for OAuth clients.

### Step 3: OAuth on the platform flow (1-2 days)
- With Step 0 done, confirm `/.well-known/oauth-protected-resource/mcp` and the
  authorization-server metadata on a workspace subdomain.
- Allow redirect URIs `https://claude.ai/api/mcp/auth_callback` and the OpenAI/ChatGPT
  callback in dynamic client registration.
- Keep API-key header auth (`X-API-KEY` / Bearer) working on NestJS; Cursor and
  `mcp-remote` configs depend on it.
- Test with the Claude custom connector and ChatGPT developer mode.

### Step 4: `mcp.arxena.com` served by NestJS, incl. workspace picker (3-4 days)
- Verify the NestJS workspace middleware resolves the workspace from the token's
  `workspaceId` claim when the host has no workspace subdomain (API-key and user JWTs
  carry it). Add a token-based fallback for the `mcp.` host if not.
- Change `scripts/nginx/mcp-arxena.conf.snippet` and the live vhost `proxy_pass` from
  `127.0.0.1:3005` to `127.0.0.1:3000`; keep the 443 listener, cert, `proxy_buffering off`
  and 3600s timeouts. Keep `X-Forwarded-Proto` and `Host`.
- Rate limit and set a request timeout on `/mcp` (replaces the standalone process's
  isolation and `max_memory_restart: 512M`).
- Update the server card base URL (`build-mcp-server-card.util.ts`) and
  `MCP_PUBLIC_URL`-style config so discovery documents advertise `https://mcp.arxena.com`.
- OAuth workspace picker: on the authorization step for the `mcp.` host, if the signed-in
  user belongs to more than one workspace, show a workspace chooser; issue the token for
  the chosen workspace. Single-workspace users skip it. Until this ships, document the
  workspace subdomain as the OAuth path and `mcp.arxena.com` as API-key only.

### Step 5: cutover with rollback (1 day + 1 week soak)
- Staging first (`staging.arxena.com` already points at CloudFront). Run the client
  matrix: Cursor, Claude Desktop via `mcp-remote`, Claude connector, ChatGPT, plus
  `mcp.controller.integration-spec.ts` and `mcp-tool-execution` suites.
- Production: flip the `mcp.arxena.com` upstream to :3000. Leave `arxena-mcp-http`
  running but unrouted for a week. Rollback = point the upstream back to :3005 and reload.
- Announce that clients using the old standalone OAuth must reconnect.

### Step 6: clean-up (0.5 day, after the soak)
- Remove `arxena-mcp-http` from `ecosystem.config.js` and
  `scripts/deploy-mcp-arxena-production.sh`; delete HTTP-only code in `twenty-mcp-server`
  (`http-server.ts`, `http-index.ts`, `oauth/`). Keep `index.ts` (stdio) and `tools/`.
- Update docs: `packages/twenty-mcp-server/README.md`,
  `packages/twenty-website/src/lib/mcp-server-solution-content.ts`, privacy page,
  `packages/twenty-docs` MCP pages, `.env.example`, config snippets (show the workspace
  URL, with `mcp.arxena.com` documented as the API-key/directory alias), directory listings.
- Keep the Anthropic egress allowlist note (`160.79.104.0/21`) and apply it to whatever
  now fronts `/mcp`, including the CloudFront-fronted subdomains.

### Step 7: one source of truth for tools, skills and prompts (2-3 days)
Today there are three sources: the standalone `buildMetaServerInstructions` plus markdown
skills from `twenty-shared/outreach`; the NestJS MCP path
(`McpInstructionBuilderService`, per-workspace `SkillService`); and the in-app assistant
(`chat-system-prompts.const.ts`, `system-prompt-builder.service.ts`, outreach prompts).
- Make `twenty-shared/outreach` the single source for the tool catalog, skill markdown and
  routing prompts.
- Have `McpInstructionBuilderService`, `SkillService` seeding and the in-app prompt
  builder read from it; delete the standalone instruction/skill code with the HTTP server.
- `SkillService` findings (traced 2026-10-11):
  - Skills are per-workspace DB entities (`flatSkillMaps`, `isCustom`, `isActive`).
    `findFlatSkillsByNames` matches by exact name and returns only active skills.
    There is no layering or override mechanism: a skill is either standard or custom.
  - Standard skills come from `STANDARD_SKILL` and are synced into each workspace. The
    seven Arxena playbooks (`setup`, `search`, `outreach`, `org-structure-insights`,
    `local-business-search`, `resolve-company-name`, `ai-filter-enrich`) already load
    their content from `twenty-shared/outreach` via `load-standard-skill-content.util.ts`
    ("so the MCP server serves the same text"). Other standard skills
    (`workflow-building`, `data-manipulation`, `dashboard-building`, ...) are markdown
    files under `twenty-standard-application/.../contents/`.
  - Both the standalone `meta-tools.ts` and `skill.service.ts` apply
    `filterSearchSkillContent` (provider enable/disable), and both the standalone server
    and `chat-system-prompts.const.ts` use `buildOutreachRoutingLines`.
  - So the Arxena playbook text is already single-sourced. What remains duplicated is the
    standalone `load_skills`/`list_skills` implementation (reads shared markdown directly,
    no workspace awareness, no custom skills), `buildMetaServerInstructions` versus
    `McpInstructionBuilderService`, and the tool-description strings in `meta-tools.ts`
    versus the NestJS tool factories.
  - Consequence: Step 7 is mostly deletion of the standalone copies, not a content merge.
    Not yet checked: whether a custom skill can reuse a standard skill's name (likely
    blocked by name uniqueness) and whether editing a standard skill in a workspace is
    overwritten on the next standard-application sync.

## Risks
- Workspace resolution on the `mcp.` host, and the OAuth workspace picker (Step 4), are
  the main unknowns and the largest piece of new work.
- 60s CloudFront timeout stays for subdomain traffic; long tools must use `mcp.arxena.com`
  or return quickly / stream progress. Raising the origin read timeout (up to the CloudFront
  quota) is an alternative.
- `search`/`fetch` output must match OpenAI's expectations.
- The bridge spawns a stdio subprocess per call; latency follow-up, not part of this work.
- Losing process isolation is mitigated by rate limits and timeouts, not eliminated.

## Not in scope
- Rewriting the bridge to call tool handlers in-process.
- Changing which tools are public beyond the gaps listed.
