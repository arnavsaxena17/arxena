# GTM Command shell

Live working-set UI for the post-signup GTM loop. CRM-committed metrics live on the seeded native dashboard.

## Execution spine (ephemeral targets → Candidate + Project)

| Layer | Role |
| --- | --- |
| **Ephemeral companies** | Redis cache keyed by `projectId` (`GET/PUT /gtm-command/cache/companies`) — Ask AI / discovery working set |
| **Ephemeral people** | Redis cache keyed by `projectId` (`GET/PUT /gtm-command/cache/people`) via `upsert_gtm_target_people` — Ask AI search hits until user confirms CRM |
| **Candidate** | Per-run outreach spine (`projectsId` = Project.id); Workflow B/C trigger unit |
| **Company (CRM)** | Shared account — created **only when** people are enrolled / added to CRM |
| **Person** | Cross-project memory (DNC, degree, etc.) |
| **Project** | Run scope: ICP, `outreachWorkflowId`, send mode, caps |

Same Company can appear in many GTM runs’ ephemeral lists. CRM gets one shared Company row (upsert by domain/name) when outreach starts.

Workflow topology:

1. **A — Bootstrap** (Ask AI skill `gtm-icp-onboarding`) — ICP / outreach preferences → Project
2. **B — Per-Candidate outreach** — `candidate.created` when `QUEUED`
3. **C — Reply → meeting** — `candidate.updated` when `REPLIED`

## Routes

| Surface | Path | Role |
| --- | --- | --- |
| Working set | `/gtm-home?projectId=` | Companies (ephemeral) / People / Workflow + Ask AI |
| CRM dashboard | `/object/dashboard/:id` (**GTM Command**) | Funnel / coverage / stage / channel / speed / outcomes |

On entry, Ask AI prefills an ICP onboarding kickoff (user hits Enter to send). Chrome is two rows: **PageHeader** (`GTM Command` + run picker / New run / CRM / Menu) and **main tabs** (Companies / People / Workflow; workflow mode + outreach picker trail on the same row). Switch runs via the header Project picker (**New run** creates a Project). Workflow tab prefers / auto-creates **`GTM Outreach — Per Candidate`** and binds `Project.outreachWorkflowId` when the Project has none. The Stage B dropdown lists ACTIVE workflows only; selecting one rebinds the Project pin and prefills Ask AI with that `outreachWorkflowId` context.

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

# 3) Seed dashboard + sample CRM rows (optional charts)
SERVER_URL=http://127.0.0.1:3000 SERVER_HOST=arxena.localhost API_TOKEN='…' \
  npx tsx packages/twenty-server/scripts/setup-gtm-command-dashboard.ts

# 4) Optional: seed full Workflow B + C graphs (UI also auto-creates blank Stage B)
SERVER_URL=http://127.0.0.1:3000 SERVER_HOST=arxena.localhost API_TOKEN='…' \
  GTM_DELAY_MS=1000 \
  npx tsx packages/twenty-server/scripts/setup-gtm-outreach-workflow.ts

# 5) Compress Unipile/enrich/reply stage advances
GTM_DELAY_MS=1000 GTM_SIMULATE_MODE=full GTM_PROJECT_ID=<uuid> API_TOKEN='…' \
  npx tsx packages/twenty-server/scripts/simulate-gtm-outreach-run.ts
```

## Shell actions

- **Companies tab** — ephemeral Redis list per `projectId` (not CRM membership)
- **People tab** — ephemeral Redis list per `projectId` (merged with enrolled CRM Candidates)
- **Add selected to CRM** (People) — upsert Company + Person + Candidate under Project
- **Enroll in outreach** — Candidate at `QUEUED` (Workflow B); also upserts Company when ephemeral company is known
- **Promote deferred** — Deferred → Queued when under persona cap
- **Needs connection** — live LinkedIn Unipile / Gmail / WhatsApp flags → Settings → Accounts

## Human gates

| Control | Where |
| --- | --- |
| ICP approve | Ask AI `gtm-icp-onboarding` → Project `icpSpec` |
| Send APPROVAL vs AUTO | Project `outreachSendMode`; FORM in Workflow B |
| Stop / DNC | Person flags; Candidate `STOPPED` |
| Caps / windows | Project + `GtmOutreachThrottleService` |
| Warm path / InMail | Workflow B branches |
