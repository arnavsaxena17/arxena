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
- [x] Soft-retire `/assistant` toward Ask AI — page is now a stub that opens side-panel Ask AI; removed `AssistantChatColumn` / MCP client chat / thread sidebar+results
- [x] Moved Handsontable details table into GTM as `GtmDetailsTable` (was `AssistantDetailsTable`)
- [x] Removed Project `SearchPanel` / `SearchParametersForm` (+ parameter manager/renderers); Ask AI side panel remains
- [x] Removed unused candidate-search `AIChatAssistant` / `CandidateSearchModal` / `FloatingAIChat`
- [x] Selection evaluation harness + `tools_in_context` logging
- [x] Object-level database CRUD tool access (`none` for video interview*, `read` for orgChart) via `OBJECT_DATABASE_CRUD_TOOL_ACCESS`
- [x] GTM ICP onboarding skill (`gtm-icp-onboarding`) + `/gtm-home` Ask AI kickoff (PREFILL)
- [x] GTM Stage B default workflow (`GTM Outreach — Per Candidate`) auto-create + Project bind on Workflow tab / New GTM run
- [x] GTM Stage B workflow picker (ACTIVE-only list → rebind `outreachWorkflowId` + Ask AI context)
- [x] GTM Command chrome collapse (PageHeader run controls + tabs trailing workflow modes)
- [x] GTM Workflow tab canvas centers on open (container-bounds viewport; no side-panel double-subtract)
- [x] GTM ephemeral companies (Redis `/gtm-command/cache/companies` per projectId; CRM Company on enroll only)
- [x] Ask AI → GTM Companies tab: `upsert_gtm_target_companies` action tool + `/gtm-home` browsing context + skill/system-prompt routing + skill content sync cmd `1785600000013`
- [x] Ask AI → GTM People tab: `upsert_gtm_target_people` action tool + Redis People cache + UI poll/merge + prompt/skill routing (no CRM until enroll) + skill sync cmd `1785600000014`

## Bucket B — Nest `core-modules`

### Primary (waves 2)

- [x] `org-chart`
- [x] `org-chart-embed`
- [x] `org-chart-outreach`
- [x] `candidate-search`
- [x] `candidate-sourcing`
- [x] `candidate-avatar`
- [x] `contact-enrichment`
- [x] `gtm-command` (materialize + outreach throttle; seed Workflow B/C via `setup-gtm-outreach-workflow.ts`)
- [x] `workspace-modifications`
- [x] `people-api`
- [x] `search-models`

### Hub / chat (wave 3)

- [x] `arx-chat` — includes `CandidateChatControlListener`: candidate field flips (`startChat` / video / meeting scheduling → true) from Handsontable or CRM record edit queue the same interim-chat start as the Start Chat button; `stopChat` remains flag-only. 2026-08-03: interim start-chat path fixed (`candidate.jobs` → `projects` in EngagedCandidateProcessor / queue service)
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
- Record selection actions: workflows `action-menu` configs/hooks → `EngineComponentKey` + `ARXENA_STANDARD_COMMAND_MENU_ITEMS` + `command-menu-item/engine-command/record/arx/*`; HotTable bottom bar + All Actions → side panel (migration track §2.11). Needs workspace metadata sync for new CMIs.
- Import candidates: `useDownloadFakeRecords` no longer requires ContextStore (ProjectPage mounts SpreadsheetImport outside that provider) — migration track §0/§9.2
- Candidate Excel/CV import parity with workflows: project auto-assign, `upload-profiles` (`spreadsheet_import`), ARX `CandidateImportFields`, resume PDF/DOC via `UploadResumesStep` + SSE — migration track §0/§9.2
- Project Handsontable top bar: restored workflows toolbar (search, status toggle, filter chips, clear/sort/import/stats/bulk/AI/validate/batch actions) in `ProjectTopBar` — migration track §0; drip-campaign still deferred

Wave 3: `assistant`, `arx-ai-filtering`

Wave 4: `unipile`, chrome-extension* (AuthBridge + Sidecar + `CHROME_EXTENSION_ID` client-config wired), linkedin-unipile, whatsapp-unipile

Settings Accounts (messaging connections): WhatsApp Unipile, WhatsApp Business / Facebook Official, LinkedIn Business, Google Contacts — nav + routes + pages on `port/arxena-modules`. Baileys nav item hidden (page/route retained). Google OAuth scopes aligned with workflows (`contacts`, `drive`, `gmail.modify`).

Settings Profile: restored workflows account IDs card (member/user/workspace id, schema, names) on `SettingsProfile` using `SettingsTableCard`.

Settings General: restored workflows workspace integration keys form (`ApiKeysForm`) grouped by AI / Messaging / LinkedIn / Twilio / Workspace & extension; wired via `ApiKeysProvider` + `POST /workspace-modifications/workspace-keys`.

Deferred chrome-extension UX (not protocol): `ExtensionInstallOnboarding`, LinkedIn auto-connect information banner, job-boards Naukri action; OAuth chrome client now via ApplicationRegistration not hardcoded `CHROME_EXTENSION_ID` redirect.

Wave 5: `video-interview`

### Billing / Razorpay / credits / IP (wave 5+)

- [x] Dual-wallet credits: Arxena `workspaceCredits` (maps + reveals + **API**) via Razorpay packs **and** upstream AI (`RESOURCE_CREDIT` / `creditBalanceMicro`) also fulfilled from Razorpay. SKUs have `kind: subscription | one_time` plus `maps` / `reveals` / `apiCredits` / `aiCredits`. People API `people/search` + `people/search-by-title` debit `apiCredits` (tag `api_search`). Subscription cycles use workspace `creditFulfillmentMode` (`reset` default, `add`, `split`). One-time packs always ADD. Free signup grants maps + API + 1 AI credit.
- [x] Razorpay module + webhooks + GraphQL credit/pack APIs
- [x] Instance commands for workspaceCredits (incl. `apiCredits`), creditTransactions, Razorpay columns, org_chart_client_ip_rule, `creditFulfillmentMode` — **fix:** `1785600000009` + `1785600000010` must be in `INSTANCE_COMMANDS` (were missing; caused prod `column creditFulfillmentMode does not exist`)
- [x] Instance command `1785600000011` creates `metadata.unipile_accounts` (+ indexes) — port of workflows TypeORM `1740700000000` / `1740800000000`. Without it, Unipile pool `touchLastActive` fails with `relation "metadata.unipile_accounts" does not exist` after successful Sales Nav searches. Optionally backfill with `unipile-backfill-member-mappings`.
- [x] Admin credits/IP GraphQL (already on HEAD in admin-panel-arx)
- [x] Settings dual Billing UX (maps/reveals/API + AI)
- [x] Website org-chart API guard + middleware

**Future unified credit:** Keep typed debit categories (`creditType` tags + cost constants like `getApiSearchCreditCost` / `getRevealCost`). A single wallet can later debit proportional units from one balance while still recording category tags — call sites already go through `WorkspaceCreditsService` facades.

Ignore Twenty leftovers: `favorites`, `prefetch`, `serverless-functions`, `databases`, etc.

## Wiring sources (workflows)

- `packages/twenty-server/src/engine/core-modules/core-engine.module.ts`
- `packages/twenty-server/src/engine/core-modules/arx-chat/arx-chat-agent.module.ts`
- `packages/twenty-server/src/engine/core-modules/org-chart/org-chart.module.ts`
- `packages/twenty-server/src/engine/core-modules/message-queue/jobs.module.ts`

## Build gate results (port/arxena-modules)

### Ops / EC2 build scripts (ported from workflows)

Root deploy helpers restored onto this branch and adapted for current packages:

| Script | Role | Holds on new instances? |
|---|---|---|
| `build_app_in_new_instance.sh` + `script_to_build_app_in_new_instance.sh` | Spin arm64 builder, build packages, stage into prod | Yes — after adaptations below |
| `build_chatwoot_in_new_instance.sh` + `script_to_build_chatwoot_in_new_instance.sh` | Build Chatwoot Docker image on EC2 | Yes — independent of Twenty package graph |
| `scripts/deploy-chatwoot-*.sh` + `tools/chatwoot-local/*` + `docs/chatwoot-production-deploy.md` | Compose / systemd Chatwoot deploy | Yes — paths still match prod layout |
| `run_e2e_tests_on_ec2.sh` + `script_to_run_e2e_on_instance.sh` | Ephemeral Playwright runner | Yes — default branch updated |
| `git_pull_all.sh`, `commit_to_github*.sh`, `pm2_start_*.sh` | Prod pull/restart helpers | Yes — already present / identical |

Adaptations vs workflows originals:

- Default `BUILD_BRANCH` / `TEST_BRANCH` → `port/arxena-modules` (`build.config`)
- Build + deploy `twenty-client-sdk` (server `nx build` copies it into `dist/assets`)
- Prefer `npx nx build twenty-server` over bare `nest build`
- Drop stale `twenty-worker` from package.json sync list

Caveats before first prod run: branch must exist on `origin`; AMI / SG / subnet defaults still arxmukti; builder needs Node 22 + nest + yarn + docker (Chatwoot). App/Chatwoot/e2e all default to baked AMI `ami-0cb194b5ec6f48d24` (from `scripts/aws/bake-arm64-builder-ami.sh` / `.arm64-builder-ami-id`); bake input base is stock Ubuntu `ami-02c4144237becae44`.

- `npx nx build twenty-shared` — pass
- `npx nx build twenty-orgchart` — pass
- `npx nest build` (twenty-server / SWC) — pass (7630 files)
- `npx nx build twenty-front` — not green yet; ported modules still need API adaptation against current Twenty front (Recoil/Jotai, UI, imports). Nest/core wiring is in place for Phase-1 routes.

Next follow-ups: fix front compile errors module-by-module, nav drawer items, Unipile providers (migrate remaining `process.env.UNIPILE_*` call sites to EnvironmentService / TwentyConfigService), and yarn install for mcp/embed package deps.

**Front runtime:** ARX modules must use `REACT_APP_SERVER_BASE_URL` from `~/config` (not `process.env.REACT_APP_SERVER_BASE_URL` — that becomes `/undefined/…` under Vite). Candidate-sourcing HTTP paths are dual-mounted as `get-all-projects` (+ legacy `get-all-jobs` aliases); see migration track §3. See also §2.8. Workspace GraphQL remaps for Attachment (`authorId`/`type` → `createdBy`/`fileCategory`; FILES-field upload + `target*Id` morph FKs + `getAttachmentDownloadUrl` — skill `attachment-files-field-migration`), CandidateEnrichment (`fields` → `filterFields`), record id scalars (`ID!` → `UUID!`), `FindOneProject` response key (`job` → `project`), and metadata SDL (`isCustom`/`dataSourceId`/`relationDefinition` dropped) are in migration track §2.10. After `nx build twenty-shared`, restart nest so GraphQLExecutionService / workspace-modifications pick up new query strings.

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
