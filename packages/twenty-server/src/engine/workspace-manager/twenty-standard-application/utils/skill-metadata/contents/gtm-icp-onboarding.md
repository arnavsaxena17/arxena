# GTM ICP Onboarding Skill

You run **Workflow A (bootstrap)** for GTM Command inside Ask AI: learn the user's go-to-market preferences conversationally, persist them on the GTM Project, then hand off to company/people discovery.

This is preference collection + ICP approval — not outreach execution (that is Workflow B) and not LinkedIn search (load `linkedin-search` only when searching).

## When to load this skill

Load `gtm-icp-onboarding` when:

- The user lands on GTM Command / onboarding and needs ICP / outreach preferences set
- The kickoff message asks you to run GTM ICP onboarding
- The user wants to redefine ICP, personas, send mode, or caps for a GTM run
- Phase is `bootstrapping` or `icp_review` and preferences are not yet approved

Do **not** load this skill for:

- Editing outreach Workflow B/C graphs → use `workflow-building` + run context
- LinkedIn / Harvest people search → use `linkedin-search`
- Dashboard widgets → use `dashboard-building`

## Plan → Skill → Learn → Execute

1. `load_skills(["gtm-icp-onboarding"])`.
2. `learn_tools` once with tools you will use, for example:

```
learn_tools([
  "ask_questions",
  "find_many_projects",
  "find_one_project",
  "update_one_project",
  "create_one_project"
])
```

3. Follow the steps below. Prefer `ask_questions` for consequential choices; accept free-form answers when the user types instead of picking.

## Execution spine (do not invent a different model)

| Concern | Object | Notes |
| --- | --- | --- |
| Run scope, ICP, send mode, caps | **Project** (`gtmRunKey`, `icpSpec`, `icpSegment`, …) | Write preferences here |
| Per-campaign outreach progress | **Candidate** | Later — enroll after people found |
| Cross-project stops / degree | **Person** | Not set during ICP onboarding |
| Account rollups | **Company** | After targets are chosen |

Idempotency for outreach is Candidate-stage based; this skill only configures the Project.

## Steps

### STEP 0 — Orient

From the kickoff / browsing context, capture:

- Workspace / signup company domain and industry (if present)
- `projectId` (canonical run scope — `/gtm-home?projectId=`)
- Existing Project `gtmRunKey` (usually equals Project.id; may be a legacy slug)

If `projectId` is known, `find_many_projects` / `find_one_project` and read current `icpSpec`, `icpSegment`, `outreachSendMode`, caps. Do not overwrite approved values without asking.

Briefly greet the user: you will set their ICP and outreach preferences for this GTM run, then they can build company lists and find people on GTM Command.

### STEP 1 — Preference interview (`ask_questions`)

Ask in small batches (1–4 questions per `ask_questions` call). Cover:

1. **Who they sell to** — industries / company size / geos (multi-select OK)
2. **Buyer personas** — titles or roles (e.g. Head of Talent, VP Sales)
3. **Taxonomy targets** — `std_function` / `std_grade` style targets when relevant (talent acquisition, people ops, etc.)
4. **Send mode** — `APPROVAL` (review drafts) vs `AUTO` (recommended only if they explicitly want hands-off)
5. **Persona density** — max personas per company (default 2)
6. **Channels / InMail** — LinkedIn connect + email; InMail fallback yes/no
7. **Send window** — timezone + rough hours (default weekday business hours)

Infer sensible defaults from their company domain when possible; only ask what you cannot infer. Mark one recommended option with `isRecommended` when helpful.

If they already pasted a full ICP brief in chat, skip redundant questions and confirm a short summary instead.

### STEP 2 — Propose ICP summary

Present a concise ICP proposal:

- Name / segment label
- Industries, employee range, geos
- Buyer titles
- `stdFunctions` / `stdGrades` (arrays of strings)
- Pain signals (short bullets)
- Outreach settings: send mode, max personas, InMail, timezone/window

Ask for Approve / Edit / Reject via `ask_questions` (or free-form edit).

### STEP 3 — Persist on Project

On approval:

1. Resolve the GTM Project by `projectId` (or `gtmRunKey`). If none exists, `create_one_project` with name like `GTM Run — {domain}` and set `gtmRunKey` to the new Project id.
2. `update_one_project` with:

| Field | Value |
| --- | --- |
| `icpSegment` | Short segment label |
| `icpSpec` | JSON **string** of the approved spec (see schema below) |
| `outreachSendMode` | `APPROVAL` or `AUTO` |
| `maxPersonasPerCompany` | number (default 2) |
| `inMailFallbackEnabled` | boolean |
| `sendTimezone` | IANA tz if known |
| `sendWindowStart` / `sendWindowEnd` | `HH:mm` if known |
| Caps | only if the user set them (`maxConnectsPerDay`, `maxCommentsPerDay`, `maxEmailsPerDay`) |

`icpSpec` JSON shape (stringify into the TEXT field):

```json
{
  "name": "HR Tech buyers — Talent leaders",
  "industries": ["HR Tech", "SaaS"],
  "employeeRange": "50-200",
  "geos": ["US", "UK"],
  "buyerTitles": ["Head of Talent", "VP People"],
  "painSignals": ["slow time-to-hire", "recruiter capacity"],
  "stdFunctions": ["talent acquisition", "people"],
  "stdGrades": ["director", "vp"]
}
```

### STEP 4 — Hand off

Tell the user:

1. ICP is saved on their GTM Project.
2. Next on GTM Command: build target companies → find people (ephemeral People tab) → user selects → enroll into outreach (Workflow B).
3. They can reopen Ask AI anytime to refine ICP or edit the outreach workflow (Workflow tab uses Project `outreachWorkflowId`).

Do **not** start cold outreach sends from this skill. Do **not** create Candidates until the user has selected people and confirmed Add to CRM / Enroll (or explicitly asks you to).

Target companies for this run belong on the **ephemeral GTM Companies tab** (Redis per `projectId`):

1. `load_skills(["search-companies"])` (and provider skills as needed).
2. Search (Exa / Apollo / LinkedIn…).
3. `learn_tools({ toolNames: ["upsert_gtm_target_companies"] })`.
4. `execute_tool({ toolName: "upsert_gtm_target_companies", arguments: { projectId, mode: "merge", companies: [...] } })` — `arguments` must be a JSON object.
5. Summarize what was written. Do **not** create CRM Company until people are enrolled.

Target people for this run belong on the **ephemeral GTM People tab** (Redis per `projectId`):

1. `load_skills(["search-people", "linkedin-search"])` as needed.
2. Search (Unipile / Harvest / Apollo…).
3. `learn_tools({ toolNames: ["upsert_gtm_target_people"] })`.
4. `execute_tool({ toolName: "upsert_gtm_target_people", arguments: { projectId, mode: "merge", people: [...] } })` — `arguments` must be a JSON object.
5. Summarize. Do **not** `create_candidate` until the user confirms.

Optional next tools (only if they ask immediately):

- Company / people discovery via Arxena GTM tools (`get_tool_catalog` / pack tools) or `linkedin-search`
- `workflow-building` if they want to inspect Workflow B

## Guardrails

- Prefer Candidate+Project execution; Person holds stop/compliance memory — do not put sequence stage on Person.
- Never invent LinkedIn facet IDs as CRM UUIDs when creating records later.
- Person `name` in CRM is structured (`firstName` / `lastName`), not a single string.
- Stop-on-reply / DNC live on Person; do not disable that when setting send mode to AUTO.
- If channels are disconnected, note it and continue ICP setup; connection is handled by GTM Command's needs-connection phase.
