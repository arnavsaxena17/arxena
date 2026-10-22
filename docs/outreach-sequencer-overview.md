# Outreach sequencer & workflow actions

Short reference for the Candidate Sequencer, workflow step types, enrollment, and local mock runs — plus a step-by-step path to get good at **setting up conversations**, **testing flows/nodes**, **tuning AI prompts**, and **evaluating** different conversation shapes.

Source of truth for the graph: `packages/twenty-server/src/engine/workspace-manager/standard-objects-prefill-data/data/outreach-workflow-graphs.ts`.

---

## Become a pro: step-by-step

Goal order: **run something end-to-end first**, then learn the front surfaces, then the server pieces, then isolate nodes and prompts, then systematically evaluate conversation types. Do not start by editing prompts in the dark.

### Phase 0 — Prerequisites (once)

1. Local app up (`yarn start` / front + server + worker).
2. Workspace with **`IS_OUTREACH_MOCK_UNIPILE_ENABLED`** (dev seed usually has this).
3. An API token for curl/scripts (`Authorization: Bearer …`).
4. Know these three URLs:
   - Outreach Home: `/outreach-home?projectId=…`
   - Outreach Today (HITL inbox): `/outreach-today`
   - Candidate Sequencer canvas: `/object/workflow/<workflowId>` → **Edit Workflow**

### Phase 1 — Run first (end-to-end with mocks)

Do this before opening a single prompt. You need a feel for stages, FORMs, and journey.

1. **Seed** a matrix project (creates QUEUED candidates for branch/HITL cases):

   ```bash
   cd packages/twenty-server
   API_TOKEN=<token> SERVER_URL=http://127.0.0.1:3000 SERVER_HOST=arxena-4.localhost \
     npx ts-node scripts/seed-outreach-bc-path-matrix.ts
   ```

2. Open the printed Outreach Home URL. Confirm people show as enrolled / `QUEUED`.

3. On the Candidate Sequencer workflow → **Edit Workflow** → turn on **Test mode** (short delays) → apply → **activate**.

4. **Start outreach** on one simple candidate (or let the drive script do it). Watch:
   - People table stage / next-step labels update
   - Candidate drawer **Journey** (active run, pending FORM, draft preview)
   - `/outreach-today` for approve/edit/reject cards

5. Drive one happy path by hand with mocks:
   - Approve any early FORM (or `POST …/hitl` `{ "decision": "approve" }`)
   - `POST …/accept` when waiting on connection
   - Approve opener → optionally `POST …/reply` with prospect text → approve sales reply

6. Then run the **automated drive** once so you see every seeded terminal stage:

   ```bash
   API_TOKEN=<token> PROJECT_ID=<from-seed> \
     npx ts-node scripts/drive-outreach-bc-path-matrix.ts
   ```

You are “running” when you can predict: *this stage → this FORM or wait → this mock call → this next stage*.

### Phase 2 — Front surfaces (what each screen is for)

Work through these in order; each maps to a testing job.

| Surface | Path / entry | You use it to… |
| --- | --- | --- |
| **Outreach Home — People** | `/outreach-home` | Enroll, Start/Stop outreach, see stage chips, open journey drawer |
| **Outreach Today** | `/outreach-today` | Decide HITL FORMs (approve / edit / reject); this is the human gate before sends |
| **Candidate Journey drawer** | People row → drawer | Inspect active/failed runs, pending step, draft preview, pause/resume/snooze |
| **Workflow list → Candidate Sequencer** | `/object/workflow/…` | Open the graph that owns the conversation machine |
| **Edit Workflow canvas** | Edit on sequencer | See nodes, edges, stage router; click a node to configure |
| **Edit sequencer options** | Modal on sequencer edit | Toggle HITL, WhatsApp, email, InMail, qualify, comment-before-connect, warm sender pin, **test mode** — regenerates graph shape |
| **Node side panel — Config** | Click any step | Edit settings (filters, templates, logic-function inputs) |
| **Node side panel — Test** (AI / send) | AI Agent or Send LinkedIn/WhatsApp/Email steps | Run **one node** against a real candidate without walking the whole flow |
| **Workflow runs** | Runs on the workflow record | Debug a full run: which step failed, step outputs, status |

Practice loop on the front:

1. Change one sequencer option (e.g. HITL off) → activate → start a fresh QUEUED candidate → confirm Today no longer parks (or does).
2. Open Journey while a FORM is pending → match `pendingFormStepId` / draft to the Today card.
3. Open the same AI step on the canvas → **Test** tab → pick that candidate → Run → compare output to the Journey draft.

### Phase 3 — Test nodes in isolation (front → server)

Once E2E works, stop burning full runs for every prompt tweak.

#### AI Agent nodes (prompts)

1. On the canvas, open nodes like **Qualify prospect**, **Draft first LinkedIn message**, **Draft sales reply**, **Extract inbound signals**.
2. Open the **Test** tab.
3. **Pick a Candidate** — the server hydrates prior-step context (profile, messages, candidate fields) into the prompt.
4. Edit the prompt in the test panel if needed → Run.
5. Read result + duration + output-validation report. Record changes / model usage are real.

Front: `WorkflowEditActionAiAgent` / `useTestAiAgent` → GraphQL `testAiAgent`.  
Server: `workflow-version-step.resolver` → agent executor (tools + optional JSON schema pass).

**Pro habit:** keep a small set of fixture candidates (opener-only, accepted+silent, inbound “interested”, inbound “not now”, referral, meeting ask). Re-run the same candidate after each prompt edit.

#### Send / channel nodes

On **Send LinkedIn Message**, **WhatsApp**, **Email**, etc.:

1. Open **Test** tab → `testWorkflowSendAction`.
2. With mocks on, the send is a no-op Unipile/email call but still exercises the step wiring and payload.
3. Confirm chat / transcript side effects you care about (mock paths write/skip differently than live).

#### Logic functions & filters

- Logic Function steps: exercise via a short workflow run or unit tests on the native util (e.g. `validate-inbound-signals`).
- AI Filtering: has its own test mutation (`testWorkflowAiFiltering`) from the step UI.
- If/else / Filter: cheapest to validate by watching which branch a Journey takes after a known stage stamp.

### Phase 4 — Server map (where to change what)

Learn the code in this order; each file owns a testing concern.

| Concern | Where | What you change / read |
| --- | --- | --- |
| Graph shape & step wiring | `…/data/outreach-workflow-graphs.ts` (`buildCandidateSequencerGraph`) | Stages, which AI/FORM/send nodes exist, options |
| Graph helpers / schemas | `…/data/outreach-workflow-graph-helpers.ts` | Output schemas (`OUTREACH_WF_AI_*`), step builders |
| Prompt text | `…/outreach-command/prompts/` (`outreach.prompts.ts` + reply/inbound prompt modules) | Instructions the AI Agent steps call |
| Mock AI results (flag on) | `…/ai-agent/utils/build-outreach-mock-ai-agent-result.util.ts` | Deterministic drafts when Unipile mock is on |
| Mock lifecycle API | `outreach-mock.controller.ts` + `outreach-mock-lifecycle.service.ts` | accept / reply / hitl / reset / upload-profiles |
| Start / stop outreach | `outreach-project-outreach-control.service.ts` | `startOutreach` flag → trigger |
| Journey API | `outreach-candidate-journey.service.ts` | What the drawer shows (runs, drafts, pending FORM) |
| Workflow execution | `packages/twenty-server/src/modules/workflow/workflow-executor/…` | Per-action executors (FORM, DELAY, AI_AGENT, sends) |
| Seed / drive scripts | `packages/twenty-server/scripts/seed-outreach-bc-path-matrix.ts`, `drive-outreach-bc-path-matrix.ts` | Repeatable conversation matrices |

After editing a **seeded graph or prompt builder**, re-sync / activate the workspace workflow (upgrade command or Edit options apply) so the running version matches your code. Prompt-only edits inside an **already activated** draft version can be tested from the AI Test tab without a full reseed.

### Phase 5 — Set up & evaluate conversations

Treat each “conversation kind” as a scenario with **setup → inject → assert**.

| Conversation kind | Setup | Inject / act | What “good” looks like |
| --- | --- | --- | --- |
| Connect → ignore → email/InMail fallback | QUEUED, start | Let accept wait expire (test mode) | Stage `EMAIL_SENT` / `INMAIL_SENT` / `FAILED_ENRICH` as designed |
| Connect → accept → opener | QUEUED → accept | `accept` + HITL approve opener | Opener draft grounded in profile; send → waiting FU |
| Accept → silent → FU1–FU3 | After opener sent | No reply; approve FU forms | Cadence advances; eventually `FAILED_NO_REPLY` if still silent |
| Inbound interested → meeting | After opener / FU | `reply` with meeting intent + HITL edit times | Calendar / `MEETING_BOOKED` or `WAITING_REPLY` with slots |
| Inbound not interested / stop | Same | `reply` with opt-out language | `#DONTRESPOND#` / skip send / `FAILED_NO_REPLY` |
| HITL reject | Any FORM | `hitl` `reject` | Run stopped; no outbound send |
| HITL edit | FORM parked | `hitl` `edit` + `editedBody` | Edited text is what gets sent |
| Company dedupe / DEFERRED | Two people same company | Start second while first still QUEUED or contacted | Second → `DEFERRED` |
| Multi-channel reply | Prefer WhatsApp/email flags on | Inbound on that channel | Reply router picks last inbound channel |

Eval checklist per scenario (write it down):

1. **Stage** on the candidate matches expectation.
2. **Journey** shows the right pending step / empty when terminal.
3. **Draft quality** (AI Test or Today card): grounded, correct tone, schema keys filled only when true.
4. **Side effects**: mock message ids, calendar, referral candidate — only when signals validated.
5. **No zombie runs**: sibling waits cancelled after accept/reply re-entry.

### Phase 6 — Daily practice loop (prompt / flow work)

1. Pick **one** conversation kind from the table.
2. Reset candidate (`…/reset?to=QUEUED` or `CONNECTION_SENT`) or use a fresh seed row.
3. Change **one** thing (prompt line, option toggle, or if/else).
4. Prefer **AI Test tab** for prompt-only; full Start + mock drive for routing/FORM/send.
5. Compare before/after on the **same candidate** and same inject text.
6. Only then activate / ship the workflow version.

### Phase 7 — Pro checklist

You are fluent when you can, without notes:

- [ ] Seed + drive mocks and explain each terminal stage in the matrix
- [ ] Enroll → start → approve Today → accept → reply from UI and from `/outreach-mock`
- [ ] Toggle sequencer options and predict which nodes appear/disappear
- [ ] Test any AI node with a candidate picker and say what context was hydrated
- [ ] Point to the server file for graph vs prompt vs mock vs journey
- [ ] Design a new conversation scenario (setup / inject / assert) and run it twice reproducibly

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

Use this as the API/script reference; for the learning order start at **Phase 1** above.

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
