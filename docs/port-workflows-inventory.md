# Port inventory: `workflows` → `upstream/core` / `port/arxena-modules`

Living checklist for selective module ports. Skip Twenty rename leftovers (`domain-manager`, `geo`, `two-factor-method`, `analytics`, `serverless`, `postgres-credentials`).

## Bucket A — Pure Arxena packages

| Package | Wave | Status |
|---|---|---|
| `packages/twenty-orgchart` | 1 | done |
| `packages/twenty-orgchart-embed` | 5 | done |
| `packages/twenty-mcp-server` | 5 | done |
| `packages/twenty-tinybird` | 5 | done |

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

Wave 3: `assistant`, `arx-ai-filtering`

Wave 4: `unipile`, chrome-extension*, linkedin-unipile, whatsapp-unipile

Wave 5: `video-interview`, billing UI extras as needed

Ignore Twenty leftovers: `favorites`, `prefetch`, `serverless-functions`, `databases`, etc.

## Wiring sources (workflows)

- `packages/twenty-server/src/engine/core-modules/core-engine.module.ts`
- `packages/twenty-server/src/engine/core-modules/arx-chat/arx-chat-agent.module.ts`
- `packages/twenty-server/src/engine/core-modules/org-chart/org-chart.module.ts`
- `packages/twenty-server/src/engine/core-modules/message-queue/jobs.module.ts`
