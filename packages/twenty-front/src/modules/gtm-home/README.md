# GTM Command shell

Live working-set UI for the post-signup GTM loop. CRM-committed metrics live on the seeded native dashboard.

## Execution spine (ephemeral targets → Candidate + Project)

| Layer | Role |
| --- | --- |
| **Ephemeral companies** | Redis cache keyed by `projectId` (`GET/PUT /gtm-command/cache/companies`) — Ask AI / discovery working set |
| **Ephemeral people** | People DataTable / search cache (same idea as candidate-search) |
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
| Working set | `/gtm-home?projectId=` | Companies (ephemeral) / People / Workflow / Market map + Ask AI |
| CRM dashboard | `/object/dashboard/:id` (**GTM Command**) | Funnel / coverage / stage / channel / speed / outcomes |

On entry, Ask AI auto-sends a kickoff that loads **`gtm-icp-onboarding`**. Switch runs via the header Project picker (**New GTM run** creates a Project). Workflow tab binds **B** via `Project.outreachWorkflowId`.

Optional: `?workflowId=` / `?workflowRunId=`

## Local setup

```bash
# 1) GTM fields on existing workspace
npx nx run twenty-server:command -- workspace:sync-arxena-standard -w <workspaceId>

# 2) Backfill Ask AI skill (existing workspaces)
npx nx run twenty-server:command -- upgrade:2-25:backfill-gtm-icp-onboarding-skill -w <workspaceId>

# 3) Seed dashboard + sample CRM rows (optional charts)
SERVER_URL=http://127.0.0.1:3000 SERVER_HOST=arxena.localhost API_TOKEN='…' \
  npx tsx packages/twenty-server/scripts/setup-gtm-command-dashboard.ts

# 4) Seed Workflow B + C and bind Project.outreachWorkflowId
SERVER_URL=http://127.0.0.1:3000 SERVER_HOST=arxena.localhost API_TOKEN='…' \
  GTM_DELAY_MS=1000 \
  npx tsx packages/twenty-server/scripts/setup-gtm-outreach-workflow.ts

# 5) Compress Unipile/enrich/reply stage advances
GTM_DELAY_MS=1000 GTM_SIMULATE_MODE=full GTM_PROJECT_ID=<uuid> API_TOKEN='…' \
  npx tsx packages/twenty-server/scripts/simulate-gtm-outreach-run.ts
```

## Shell actions

- **Companies tab** — ephemeral Redis list per `projectId` (not CRM membership)
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
