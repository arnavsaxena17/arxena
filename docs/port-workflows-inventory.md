# Port inventory: `workflows` → `upstream/core` / `port/arxena-modules`

Living checklist for selective module ports. Skip Twenty rename leftovers (`domain-manager`, `geo`, `two-factor-method`, `analytics`, `serverless`, `postgres-credentials`).

## Bucket A — Pure Arxena packages

| Package | Wave | Status |
|---|---|---|
| `packages/twenty-orgchart` | 1 | pending |
| `packages/twenty-orgchart-embed` | 5 | pending |
| `packages/twenty-mcp-server` | 5 | pending |
| `packages/twenty-tinybird` | 5 | pending |

## Bucket B — Nest `core-modules`

### Primary (waves 2)

- [ ] `org-chart`
- [ ] `org-chart-embed`
- [ ] `org-chart-outreach`
- [ ] `candidate-search`
- [ ] `candidate-sourcing`
- [ ] `candidate-avatar`
- [ ] `contact-enrichment`
- [ ] `workspace-modifications`
- [ ] `people-api`
- [ ] `search-models`

### Hub / chat (wave 3)

- [ ] `arx-chat`
- [ ] `warm-paths`
- [ ] `assistant`
- [ ] `autonomous-recruiter`
- [ ] `website-leads`
- [ ] `llm-chat-model`
- [ ] `llm-tracing`

### Integrations (wave 4)

- [ ] `apify`
- [ ] `bright-data`
- [ ] `theorg`
- [ ] `theofficialboard`
- [ ] `linkedin-search`
- [ ] `linkedin-company-search`
- [ ] `linkedin-query-generation`
- [ ] `unipile-attachments`
- [ ] `whatsapp-media`
- [ ] `gmail-sender`
- [ ] `google-contacts`
- [ ] `google-drive`
- [ ] `google-sheets`
- [ ] `calendar-events`
- [ ] `extension-bridge`
- [ ] `privacy-consent`
- [ ] `video-interview`

### Skip / defer

- `baileys`, `whiskeysocket-baileys`, `cron-processes` (commented out on workflows)
- `drip-campaign`, `job-process-automation` (orphaned)
- `interviews` (stub)

## Bucket C — Front + shared

### Shared (wave 1)

- [ ] `src/graphql/` (queries/mutations)
- [ ] Types: `CandidateSearchTypes`, `ArxChatTypes`, `candidate`, `job-data`
- [ ] Constants: org-chart guards, billing credits, privacy-consent, chrome webstore, SettingsFeatures extras, workspaceMemberProfileFields
- [ ] Utils: `orgchart/*`, Unipile/LinkedIn helpers, privacy-consent, calendly, clientGeo

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
