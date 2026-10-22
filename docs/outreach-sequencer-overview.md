# Outreach sequencer & workflow actions

Short reference for the Candidate Sequencer, workflow step types, enrollment, and local mock runs.

Source of truth for the graph: `packages/twenty-server/src/engine/workspace-manager/standard-objects-prefill-data/data/outreach-workflow-graphs.ts`.

---

## Workflow action items

Steps you can drop on a workflow canvas. Grouped by role.

### Flow control

| Action | What it does |
| --- | --- |
| **If/else** | Branch on a boolean / comparison; sequencer stage routing uses multi-branch if/else. |
| **Filter** | Continue only when a condition holds; otherwise the run stops cascading that path. |
| **Delay** | Pause for a fixed / random / until-date duration, then resume. |
| **Iterator** | Loop over a list of items. |
| **Form** | Human-in-the-loop pause (approve / edit / reject). Parks on Outreach Today until decided. |

### Records

| Action | What it does |
| --- | --- |
| **Create / Update / Delete Record** | CRUD on CRM objects. |
| **Create or Update Record** | Upsert. |
| **Search Records** | Find records by filter. |
| **Pick Record** | Choose one record from a prior find/list. |

### Messaging & LinkedIn

| Action | What it does |
| --- | --- |
| **Send LinkedIn Connection Request** | Invite with optional note. |
| **Send LinkedIn Message** | DM an existing connection. |
| **Send LinkedIn InMail** | InMail when not connected. |
| **Send LinkedIn Voice Note** | Voice note on LinkedIn. |
| **View / Follow LinkedIn Profile** | Warm-up profile actions. |
| **Fetch LinkedIn Posts & Activity** | Pull recent posts for comment/opener context. |
| **Comment on / Like LinkedIn Post** | Engagement warm-up. |
| **Accept received invitation** | Accept an inbound LinkedIn invite. |
| **Send Email / Draft Email** | Outbound email (or draft only). |
| **Send WhatsApp Message** | WhatsApp via Unipile. |
| **Create Calendar Event** | Book a meeting on the sender calendar. |

### Search / enrich

| Action | What it does |
| --- | --- |
| **Search Bright Data People / Companies** | People or company search via Bright Data. |
| **Search Local Businesses / Get Local Business Details** | Maps / local place scrape helpers. |
| **Resolve Company From Raw Name** | Normalize a company name to a CRM company. |

### AI & code

| Action | What it does |
| --- | --- |
| **AI Agent** | LLM draft (opener, reply, qualify, extract signals, …). |
| **AI Filtering** | Keep/drop list items with a structured LLM filter. |
| **Code - Logic Function** | Run a registered server logic function (search people, upload profiles, enrich, fetch messages, …). |
| **HTTP Request** | Call an external HTTP endpoint. |

---

## How the outreach sequencer works

**Workflow name:** `Outreach — Candidate Sequencer`

One graph merges the old Stage B (first touch) and Stage C (accept / reply) canvases.

### Trigger

- Event: `candidate.upserted`
- Watches: `outreachSequenceStage`, `candidateFlags`
- Only entry stages wake a run (e.g. `QUEUED`, `CONNECTION_ACCEPTED`, `REPLIED`, optionally `MEETING_BOOKED`). Stamps like `CONNECTION_SENT` / `DEFERRED` / `EMAIL_SENT` do **not** re-trigger.

### Run shape

1. **Load Candidate** (and optionally select pinned sender by warm overlap).
2. **Load workspace member** (sender seat).
3. **Route by `outreachSequenceStage`** (if/else), then one of:

| Branch | Rough path |
| --- | --- |
| **QUEUED** | Qualify → optional company dedupe → optional comment-before-connect → connection note → LinkedIn connect → wait for accept → InMail / email fallback if ignored. |
| **CONNECTION_ACCEPTED** | Fetch messages/profile → draft opener → HITL form → send → follow-ups FU1–FU3 if silent. |
| **REPLIED** | Extract/validate inbound signals → draft sales reply → channel router (LinkedIn / WhatsApp / email) → HITL → send → wait / post-reply FUs / meeting / referral. |
| **MEETING_BOOKED** | Optional meeting follow-up / no-show ping when enabled. |

Sibling runs for the same candidate are cancelled when a new sequencer run starts on accept/reply so old wait loops do not keep firing.

### Journey stages (happy path)

`QUEUED` → (`COMMENTED`) → `CONNECTION_SENT` → (`INMAIL_SENT`) → `EMAIL_SENT` → `CONNECTION_ACCEPTED` → `FOLLOW_UP_*` → `REPLIED` → `WAITING_REPLY` → `MEETING_BOOKED`

Terminals / side paths: `FAILED_NO_REPLY`, `FAILED_ENRICH`, `DEFERRED`, `STOPPED`.

FORM / HITL is a next-step overlay, not a stage. Approvals show on **Outreach Today**.

### Related discovery workflows (not the sequencer)

Seeded alongside the sequencer for list building:

| Workflow | Role |
| --- | --- |
| Find companies | Search → AI fit filter → upsert companies |
| Find people by company | Search people at a company → filter → upload |
| Find people by search | NL / URL search → filter → upload |
| Add people | Manual fetch & save profiles |
| Fetch & Save Local Businesses | City Maps scrape |
| Classify & Upsert Local Places | Bulk classify places into CRM |

---

## Adding candidates to the sequencer

Enrollment creates a **Candidate** row on a project at stage `QUEUED`. Discovery rows in Redis alone are not enough — there must be a CRM Candidate for `candidate.upserted` to fire.

### From Outreach Home (UI)

1. Open `/outreach-home?projectId=…`.
2. Select people (from Find / discovery).
3. **Enroll** → `POST /candidate-sourcing/upload-profiles` (creates Candidates, stage `QUEUED`). Extra personas per company may be stamped `DEFERRED`.
4. Select enrolled people → **Start outreach** → `POST /outreach-command/candidates/start-outreach` with `candidateIds` (+ optional `projectId`).

`start-outreach` sets `candidateFlags.startOutreach = true` (and clears `stopOutreach`). That upsert wakes the sequencer on an entry stage.

Promote a deferred person with stage → `QUEUED` before starting.

### Via API / agent

- Enroll: upload profiles (or Ask AI tools that call the same path).
- Start: `POST /outreach-command/candidates/start-outreach` with `candidateIds` or `personIds`, or project-wide queued start via `startAllQueuedInProject` (agent path).

People saved to CRM **without** enrollment have no Candidate — start-outreach will report them as unenrolled.

---

## Running the sequencer with mocks

Local / seed workspaces can avoid real Unipile / email / calendar by enabling the mock flag.

### 1. Enable mocks

Workspace feature flag: **`IS_OUTREACH_MOCK_UNIPILE_ENABLED`** (on by default for dev-seeded workspaces).

When on:

- LinkedIn send / connect / InMail / view / comment / like / WhatsApp skip Unipile and return mock ids.
- Email / calendar / enrich / profile fetch use fixtures or no-ops.
- Demo seats with account id prefix `mock-unipile-` use fixture profiles.

Optional: turn on **test mode** on the Candidate Sequencer (Edit Workflow) so delays collapse (e.g. accept wait ~1 minute) for faster path tests.

### 2. Seed a path-matrix project

```bash
cd packages/twenty-server
API_TOKEN=<workspace-api-token> \
SERVER_URL=http://127.0.0.1:3000 \
SERVER_HOST=arxena-4.localhost \
npx ts-node scripts/seed-outreach-bc-path-matrix.ts
```

Creates a project + QUEUED candidates covering Stage B/C branch ends and HITL combinations. Prints `projectId` and candidate ids.

### 3. Drive with `/outreach-mock`

Auth: `Authorization: Bearer <API_TOKEN>`.

| Call | Purpose |
| --- | --- |
| `POST /outreach-mock/projects/:projectId/upload-profiles` `{ "count": 5 }` | Queue synthetic LinkedIn profiles onto a project |
| `POST /outreach-mock/candidates/:id/accept` | Simulate connection accept → advances toward opener |
| `POST /outreach-mock/candidates/:id/reply` `{ "text": "…" }` | Inject inbound prospect reply |
| `POST /outreach-mock/candidates/:id/generated-reply` `{ "text": "…", "channel"?: "LINKEDIN"\|"WHATSAPP"\|"EMAIL" }` | Persist a mock LLM outbound for the next AI turn |
| `POST /outreach-mock/candidates/:id/hitl` `{ "decision": "approve"\|"reject"\|"edit", "editedBody"?: "…", "startsAt"?: "…", "endsAt"?: "…" }` | Decide the parked FORM (`yes` / `no` / `change` aliases work) |
| `POST /outreach-mock/candidates/:id/reset?to=CONNECTION_SENT\|QUEUED` | Rewind candidate for another pass |

HITL examples:

- Approve opener as-is → `decision: "approve"`
- Edit + meeting times → `decision: "edit"` + `editedBody` + `startsAt` / `endsAt`
- Reject (stop run, no send) → `decision: "reject"`

### 4. Automated drive script

After seed:

```bash
API_TOKEN=<token> PROJECT_ID=<from-seed> \
npx ts-node scripts/drive-outreach-bc-path-matrix.ts
```

Walks seeded candidates through accept / reply / HITL to expected terminal stages and asserts them.

### Manual smoke (minimal)

1. Flag on + Candidate Sequencer activated on the project.
2. Enroll or `upload-profiles` mock people → Start outreach.
3. Approve any FORM on Outreach Today (or `hitl`).
4. `accept` → approve opener → optionally `reply` → approve sales reply.

---

## Related docs

- [`outreach-multi-member-demo.md`](./outreach-multi-member-demo.md) — multi-seat ownership / warm overlap
- [`outreach-reply-agent-split-plan.md`](./outreach-reply-agent-split-plan.md) — reply-agent split + mock AI drafts
