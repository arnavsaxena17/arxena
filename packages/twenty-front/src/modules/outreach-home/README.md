# Outreach shell

Live working-set UI for the post-signup outreach loop. CRM-committed metrics live on the seeded native dashboard.

## Execution spine (ephemeral targets → Candidate + Project)

| Layer | Role |
| --- | --- |
| **Ephemeral companies** | Redis cache keyed by `projectId` (`GET/PUT /outreach-command/cache/companies`) — Ask AI / discovery working set. Writes emit `outreach-cache-updated` on `/general-socket` (`outreach-project-{projectId}` room) so the Companies tab refreshes without polling. |
| **Ephemeral people** | Redis cache keyed by `projectId` (`GET/PUT /outreach-command/cache/people`) via `upsert_outreach_target_people` — Ask AI search hits until user confirms CRM. Same socket event refreshes the People tab. |
| **Candidate** | Per-project outreach spine (`projectsId` = Project.id); Workflow B/C trigger unit |
| **Company (CRM)** | Shared account — created **only when** people are enrolled / added to CRM |
| **Person** | Cross-project memory (DNC, degree, etc.) |
| **Project** | Campaign scope: ICP, `outreachWorkflowId`, send mode, caps |

Same Company can appear in many GTM projects’ ephemeral lists. CRM gets one shared Company row (upsert by domain/name) when outreach starts.

Workflow topology:

1. **A — Bootstrap** (Ask AI skill `gtm-icp-onboarding`) — ICP / outreach preferences → Project
2. **B — Per-Candidate outreach** — `candidate.created` when `QUEUED`
3. **C — Reply → meeting** — `candidate.updated` when `REPLIED`

## Routes

| Surface | Path | Role |
| --- | --- | --- |
| Working set | `/outreach-home?projectId=` | Companies (ephemeral) / People / Workflow + Ask AI |
| CRM dashboard | `/object/dashboard/:id` (**Outreach**) | Funnel / coverage / stage / channel / speed / outcomes / **workflow control**. Prefilled on workspace create; existing workspaces: `upgrade:2-25:prefill-gtm-command-dashboard` and `upgrade:2-25:sync-outreach-workflow-control-dashboard`. |

Ask AI stays closed on `/outreach-home` until the user opens it from the nav chat icon or **+ New chat**. Chrome is two rows: **PageHeader** (`Outreach` + project picker / pause-resume / Menu) and **main tabs** (Companies / People / Setup). Switch projects via the header Project picker; create projects via Menu → Add New Project. Stage B workflow still auto-binds **`Outreach — Per Enrolled Candidate`** via `useOutreachWorkflowEmbed` when the Project has no `outreachWorkflowId`.

Optional: `?workflowId=` / `?workflowRunId=`

## Local setup

```bash
# 1) GTM fields on existing workspace
npx nx run twenty-server:command -- workspace:sync-arxena-standard -w <workspaceId>

# 2) Backfill / sync Ask AI skills (existing workspaces)
npx nx run twenty-server:command -- upgrade:2-25:backfill-gtm-icp-onboarding-skill -w <workspaceId>
npx nx run twenty-server:command -- upgrade:2-25:sync-gtm-company-skill-content -w <workspaceId>
npx nx run twenty-server:command -- upgrade:2-25:sync-gtm-people-skill-content -w <workspaceId>
npx nx run twenty-server:command -- upgrade:2-25:sync-gtm-outreach-workflow-skill-content -w <workspaceId>

# 3) Optional: sample CRM rows so the Outreach dashboard charts have demo data
#    (layout + dashboard record are prefilled on workspace create / the upgrade command)
SERVER_URL=http://127.0.0.1:3000 SERVER_HOST=arxena.localhost API_TOKEN='…' \
  npx tsx packages/twenty-server/scripts/setup-outreach-command-dashboard.ts

# 4) Optional: seed full Workflow B + C graphs (UI also auto-creates blank Stage B)
SERVER_URL=http://127.0.0.1:3000 SERVER_HOST=arxena.localhost API_TOKEN='…' \
  OUTREACH_DELAY_MS=1000 \
  npx tsx packages/twenty-server/scripts/setup-gtm-outreach-workflow.ts

# 5) Compress Unipile/enrich/reply stage advances
OUTREACH_DELAY_MS=1000 OUTREACH_SIMULATE_MODE=full OUTREACH_PROJECT_ID=<uuid> API_TOKEN='…' \
  npx tsx packages/twenty-server/scripts/simulate-gtm-outreach-run.ts
```

## Shell actions

- **Companies tab** — ephemeral Redis list per `projectId` (not CRM membership)
- **People tab** — ephemeral Redis list per `projectId` (merged with enrolled CRM Candidates); stage filters; next-step from active workflow runs; row name opens Journey tab
- **KPI strip** (People) — enrolled / by stage / needs approval / due this week + link to Outreach dashboard
- **Add selected to CRM** (People) — upsert Company + Person + Candidate under Project
- **Enroll in outreach** — Candidate at `QUEUED` (Workflow B); also upserts Company when ephemeral company is known
- **Promote deferred** — Deferred → Queued when under persona cap
- **Needs connection** — live LinkedIn Unipile / Gmail / WhatsApp flags → Settings → Accounts

## Journey tab (CandidateChatDrawer)

Opened from Outreach People (name click sets Journey as default tab). Aggregates Stage B + Stage C runs for one enrolled candidate:

| Control | API |
| --- | --- |
| Read journey | `GET /outreach-command/projects/:projectId/candidates/:candidateId/journey` |
| Pause / resume | `POST .../pause` · `POST .../resume` |
| Snooze until date | `POST .../snooze` `{ resumeAt }` → sets `outreachAnalytics.resumeAt` + schedules deferred wake-up |
| Skip delay | `POST .../skip-step` |
| Approve / reject FORM | `POST .../approve-form` `{ approve, editedBody }` |
| Stop | existing `POST .../candidates/stop` |

Deferred auto wake-up: inbound classifier persists `outreachAnalytics.resumeAt` from `extractedTimeHint` (and `stageBeforeDefer`); hourly cron + delayed job stamp stage back to `stageBeforeDefer`.

## Human gates

| Control | Where |
| --- | --- |
| ICP approve | Ask AI `gtm-icp-onboarding` → Project `icpSpec` |
| Send APPROVAL vs AUTO | Project `outreachSendMode`; FORM in Workflow B / Journey tab |
| Per-candidate pause / snooze | Journey tab |
| Stop / DNC | Person flags; Candidate `STOPPED` |
| Caps / windows | Project + `OutreachThrottleService` |
| Warm path / InMail | Workflow B branches |
