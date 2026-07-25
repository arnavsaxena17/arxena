# Port inventory: `workflows` → `upstream/core` / `port/arxena-modules`

Living checklist for selective module ports. Skip Twenty rename leftovers (`domain-manager`, `geo`, `two-factor-method`, `analytics`, `serverless`, `postgres-credentials`).

**Catalog rule:** any workflows → `port/arxena-modules` / `upstream/core` work must **sweep for sibling instances of the same pattern**, then update this inventory **and** [`docs/port-front-migration-track.md`](./port-front-migration-track.md) in the same turn (see [`.cursor/rules/port-workflows-catalog.mdc`](../.cursor/rules/port-workflows-catalog.mdc)).

## Bucket A — Pure Arxena packages

| Package | Wave | Status |
|---|---|---|
| `packages/twenty-orgchart` | 1 | done |
| `packages/twenty-orgchart-embed` | 5 | done |
| `packages/twenty-mcp-server` | 5 | done (builds; HTTP on :3005; ecosystem/nginx/deploy wired). `extension-bridge-tools` kept but not registered in `publicTools` until needed. |
| `packages/twenty-tinybird` | 5 | done |

## Federation (Ask AI + Nest ToolProvider) — in progress

Not marked done until Ask AI can discover/execute Arxena GTM tools and workspace-added MCP servers via `learn_tools` / `execute_tool`:

- [x] `ToolCategory.ARXENA` + `EXTERNAL_MCP`
- [x] `ArxenaToolProvider` + catalog packs
- [x] `WorkspaceMcpServer` entity + `DownstreamMcpToolProvider`
- [x] Settings → AI → MCP servers UI
- [x] Soft-retire `/assistant` toward Ask AI
- [x] Selection evaluation harness + `tools_in_context` logging

## Bucket B — Nest `core-modules`

### Primary (waves 2)

- [x] `org-chart`
- [x] `org-chart-embed`
- [x] `org-chart-outreach`
- [x] `candidate-search`
- [x] `candidate-sourcing`
- [x] `candidate-avatar`
- [x] `contact-enrichment`
- [x] `workspace-modifications`
- [x] `people-api`
- [x] `search-models`

### Hub / chat (wave 3)

- [x] `arx-chat`
- [x] `warm-paths`
- [x] `assistant`
- [x] `autonomous-recruiter`
- [x] `website-leads`
- [x] `llm-chat-model`
- [x] `llm-tracing`

### Integrations (wave 4)

- [x] `apify`
- [x] `bright-data`
- [x] `theorg`
- [x] `theofficialboard`
- [x] `linkedin-search`
- [x] `linkedin-company-search`
- [x] `linkedin-query-generation`
- [x] `unipile-attachments`
- [x] `whatsapp-media`
- [x] `gmail-sender`
- [x] `google-contacts`
- [x] `google-drive`
- [x] `google-sheets`
- [x] `calendar-events`
- [x] `extension-bridge`
- [x] `privacy-consent`
- [x] `video-interview`

### Skip / defer

- `baileys`, `whiskeysocket-baileys`, `cron-processes` (commented out on workflows)
- `drip-campaign`, `job-process-automation` (orphaned)
- `interviews` (stub)

## Bucket C — Front + shared

### Shared (wave 1)

- [x] `src/graphql/` (queries/mutations)
- [x] Types: `CandidateSearchTypes`, `ArxChatTypes`, `candidate`, `job-data`
- [x] Constants: org-chart guards, billing credits, privacy-consent, chrome webstore, SettingsFeatures extras, workspaceMemberProfileFields
- [x] Utils: `orgchart/*`, Unipile/LinkedIn helpers, privacy-consent, calendly, clientGeo

### Front modules

Wave 2: `orgchart`, `candidate-table`, `candidate-search`, `arx-jd-upload`
- Org chart app route: `OrgChartRoute` restores workflows `:companyKey` + location-state wiring (was bare `<ArxOrgChart />`)
- Project DataTable blank: restored `flex:1`/`min-height:0` on upstream `PageBody`/`PagePanel` (Handsontable height chain) — see migration track §0/§9.2
- Candidate name click: `SidePanelPages.CandidateChat` mounts `CandidateChatDrawer` (stubbed `useRightDrawer` previously set `isRightPanelOpen` with no UI)

Wave 3: `assistant`, `arx-ai-filtering`

Wave 4: `unipile`, chrome-extension*, linkedin-unipile, whatsapp-unipile

Settings Accounts (messaging connections): WhatsApp Unipile, WhatsApp Business / Facebook Official, Baileys, LinkedIn Business, Google Contacts — nav + routes + pages on `port/arxena-modules`. Google OAuth scopes aligned with workflows (`contacts`, `drive`, `gmail.modify`).

Wave 5: `video-interview`

### Billing / Razorpay / credits / IP (wave 5+)

- [x] Dual-wallet credits: Arxena `workspaceCredits` (maps + reveals) via Razorpay packs; Stripe resource credits stay for AI
- [x] Razorpay module + webhooks + GraphQL credit/pack APIs
- [x] Instance commands for workspaceCredits, creditTransactions, Razorpay columns, org_chart_client_ip_rule
- [x] Admin credits/IP GraphQL (already on HEAD in admin-panel-arx)
- [x] Settings dual Billing UX (maps/reveals + AI)
- [x] Website org-chart API guard + middleware


Ignore Twenty leftovers: `favorites`, `prefetch`, `serverless-functions`, `databases`, etc.

## Wiring sources (workflows)

- `packages/twenty-server/src/engine/core-modules/core-engine.module.ts`
- `packages/twenty-server/src/engine/core-modules/arx-chat/arx-chat-agent.module.ts`
- `packages/twenty-server/src/engine/core-modules/org-chart/org-chart.module.ts`
- `packages/twenty-server/src/engine/core-modules/message-queue/jobs.module.ts`

## Build gate results (port/arxena-modules)

- `npx nx build twenty-shared` — pass
- `npx nx build twenty-orgchart` — pass
- `npx nest build` (twenty-server / SWC) — pass (7630 files)
- `npx nx build twenty-front` — not green yet; ported modules still need API adaptation against current Twenty front (Recoil/Jotai, UI, imports). Nest/core wiring is in place for Phase-1 routes.

Next follow-ups: fix front compile errors module-by-module, nav drawer items, Unipile providers (migrate remaining `process.env.UNIPILE_*` call sites to EnvironmentService / TwentyConfigService), and yarn install for mcp/embed package deps.

**Front runtime:** ARX modules must use `REACT_APP_SERVER_BASE_URL` from `~/config` (not `process.env.REACT_APP_SERVER_BASE_URL` — that becomes `/undefined/…` under Vite). Candidate-sourcing HTTP paths are dual-mounted as `get-all-projects` (+ legacy `get-all-jobs` aliases); see migration track §3. See also §2.8. Workspace GraphQL remaps for Attachment (`authorId`/`type` → `createdBy`/`fileCategory`), CandidateEnrichment (`fields` → `filterFields`), record id scalars (`ID!` → `UUID!`), and `FindOneProject` response key (`job` → `project`) are in migration track §2.10. After `nx build twenty-shared`, restart nest so GraphQLExecutionService picks up new query strings.

**Front import / Apollo migration track:** see [`docs/port-front-migration-track.md`](./port-front-migration-track.md) — path remaps, Apollo `/graphql` vs `/metadata`, Job→Project, and **§9 catalog of upstream/core files altered** on this branch.


Arxena ConfigVariables are registered under `ConfigVariablesGroup.ARXENA` (plus LLM / EMAIL / RATE_LIMITING for related keys). `EnvironmentService` is typed against `keyof ConfigVariables` (no process.env fallback).

## Website forms → APIs → emails

Auth header for lead/consent POSTs: `x-org-chart-pdl-proxy-key` = `ORG_CHART_PDL_PROXY_SECRET` (same value on website + server).

| Form / UI | Website API | Server API | Side effects |
|---|---|---|---|
| Free trial modal (hero, header, org-chart CTA) | `POST /api/free-trial-lead` | `POST /website/free-trial-lead` | Email to `FREE_TRIAL_LEAD_NOTIFICATION_EMAIL` (default `arnav@arxena.com`); CRM Company/Person/Opportunity when `FREE_TRIAL_LEAD_WORKSPACE_ID` is set |
| Calendly booked inside free-trial modal | `POST /api/calendly-booking-completed` | `POST /website/calendly-booking-completed` | Updates Opportunity `meetingScheduledAt` — **no email** |
| Cookie consent banner | `POST /api/privacy-consent` | `POST /website/privacy-consent` | Persists consent event — **no email** |
| Contact page Calendly | embed only | — | Does **not** call calendly-booking API |
| Follow-up to lead (thank-you / schedule reminder) | — | CRM workflow `Free Trial Lead — Meeting Follow-up` | SEND_EMAIL via connected Gmail; seed with `scripts/setup-free-trial-workflow.ts` |

Config keys: `ORG_CHART_PDL_PROXY_SECRET`, `FREE_TRIAL_LEAD_WORKSPACE_ID`, `FREE_TRIAL_LEAD_NOTIFICATION_EMAIL`, `FREE_TRIAL_WORKFLOW_CONNECTED_ACCOUNT_ID`, `EMAIL_DRIVER` / `EMAIL_FROM_*`.
