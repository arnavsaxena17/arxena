# Outreach Skill

You build and run **campaign automation graphs** (company harvest + enroll + LinkedIn/email sequencer). Generic mechanics (DELAY vs event, FORM HITL, CRON schema) live in `workflow-building` — load both; do not restate them here.

Step outputs are already unwrapped in run context. Use `{{<step-uuid>.<field>}}` for LOGIC_FUNCTION / AI_AGENT, `{{<step-uuid>.first.<field>}}` for FIND_RECORDS, `{{trigger.properties.after.<field>}}` for DATABASE_EVENT, and `{{<form-uuid>.<fieldName>}}` for FORM (no extra `.result`).

This is **not** ICP preference collection (`setup`) and **not** Ask AI target-list search (`search` → Find / Redis tabs). Interactive Companies tab stays Find. **Scheduled harvest that writes the CRM companies table** is this skill.

## Ignite (prefer reuse — do not invent webhooks)

Seeded graphs ship as **DRAFT**. Triggers are CRON / `company.created` / `candidate.created` / `candidate.updated` — **not** WEBHOOK. Do **not** call `http_request` against `/webhooks/workflows/...` for these seeds.

| Seeded name | Trigger | Role |
| --- | --- | --- |
| `Harvest — LinkedIn Companies` | CRON | Harvest |
| `Company Created → ICP People Search` | `company.created` | Enroll-on-company |
| `Outreach — Per Enrolled Person` | `candidate.created` (+ `QUEUED`) | Sequencer B |
| `Outreach — Enrolled Person Updated` | `candidate.updated` | Stage updates |

**Ignite path:**

1. `list_workflows` by the names above (or use browsing-context `outreachWorkflowId` for Stage B).
2. Prefer reuse: activate DRAFT with `activate_workflow_version`. Clone via `create_draft_from_workflow_version` before editing — do not rebuild Stage B from scratch.
3. Enroll: native `upload-profiles` / Candidates with `outreachSequenceStage=QUEUED` → fires Per Candidate.
4. Harvest and company-created run once ACTIVE — no manual fire.
5. Finish with `list_workflow_runs`.

## When to load this skill

Load `outreach` (with `workflow-building`) when:

- The user wants a **workflow** that harvests LinkedIn companies on a schedule, enrolls people on company create, or runs LinkedIn / email / meeting outreach
- The user wants to clone or edit the seeded outreach graphs, or browsing context is the campaign home and the ask is about outreach **workflows**

Do **not** load this skill for generic CRM automations or for chat-only company/people lists — use `workflow-building` or `search`. Dashboards: load `dashboard-building` and **extend** the existing campaign dashboard.

## Plan → Skill → Learn → Execute

1. `load_skills(["outreach", "workflow-building"])`.
2. `list_logic_function_tools` — use `inputSchema` / `isNative`. Enroll with native `upload-profiles`. Persist harvested companies with native `upsert-companies`.
3. `learn_tools` for `create_complete_workflow` (or clone tools) then execute. Do **not** grep spilled JSON Schema with `code_interpreter`.

Native workflow actions (kebab-case LFs — **not** the `search` skill): `search-people-for-company`, `search-people`, `search-companies`, `search-jobs`, `fetch-linkedin-profile`, `fetch-linkedin-messages`, `fetch-company-details`, `upload-profiles`, `upsert-companies`, `enrich-contact`, `get-calendar-availability`. They have stub source — do **not** call `get_logic_function_source` for them.

Search LFs return hits only. People persist with `upload-profiles`. Company persist for automation is CRM + `projectIds` (not Find/Redis).

## GTM workflows (do not conflate)

FILTER `QUEUED` on Per Candidate (`candidate.created`). Stage changes on update use **one** `candidate.updated` workflow with `settings.fields: ['outreachSequenceStage']` and IF_ELSE branches — do not register five parallel updated listeners. FIND `workspaceMember` then `workspaceMemberProfile` and pin `workspaceMemberId` = `{{member.first.id}}` on every SEND_* / Unipile fetch. HITL WhatsApp recipient = `{{profile.first.phoneNumber}}`. HITL = FORM on the **send** graph (`workflow-building`); never a fourth “HITL only” workflow.

Do **not** add a workflow whose only job is “mark connection accepted” — Unipile `new_relation` already materializes `CONNECTION_ACCEPTED`.

| Workflow | Trigger | Role |
| --- | --- | --- |
| **Harvest** | `CRON` `HOURS` | Native `search-companies` `{ query, keywords, limit }` → native `upsert-companies` `{ projectId, companies: "{{searchUuid.companies}}" }` (CRM + `projectIds`). Seed Project **Harvest**. Do **not** `upsert_outreach_target_companies`. Skip rows already tagged to this project. |
| **Workflow 1** (company people search) | `company.created` | LOGIC_FUNCTION `search-people-for-company` → LOGIC_FUNCTION `upload-profiles`. Optional FORM between only if the user wants to approve enroll. |
| **Workflow U** (manual) | HTTP Ask AI / org-chart / GTM Home `upload-profiles` | Same enroll path; GTM projects get `QUEUED` + `linkedinProfileId` |
| **Stage B** (`Outreach — Per Enrolled Person`) | `candidate.created` + filter `QUEUED` | `SEND_LINKEDIN_CONNECTION_REQUEST` (`workspaceMemberId` + `linkedinProfileId`). Do **not** DELAY-poll accept. Same graph: DELAY 3d → FIND → IF still `CONNECTION_SENT` → `EMAIL_ENRICHING` → `enrich-contact` → AI email → FORM → `DRAFT_EMAIL` / `SEND_EMAIL` → `EMAIL_SENT`; miss → `FAILED_ENRICH`. Accept is a **second** graph (`workflow-building` timer vs event). |
| **Enrolled Person Updated** (`Outreach — Enrolled Person Updated`; legacy `GTM Outreach — Candidate Updated`) | `candidate.updated` watching `outreachSequenceStage` | IF_ELSE on `{{trigger.properties.after.outreachSequenceStage}}`. **CONNECTION_ACCEPTED**: `fetch-linkedin-messages` → `fetch-linkedin-profile` → AI opener → FORM → SEND, then DELAY follow-ups. **REPLIED**: FIND `chatMessage` → calendar slots → AI → FORM → SEND. **NEGOTIATING** / **DEFERRED**: same shape, different prompts. **MEETING_BOOKED**: FORM times → `CREATE_CALENDAR_EVENT`. Else: end with no work. Do not use FILTER-first twins of this trigger. |
| **Stage C inbound classify** | silence-window flush (not a workflow) | LLM classifies the **recipient burst** → stamps stage. `unsubscribe`→`STOPPED` (no send). `not_now`→`DEFERRED`. `interested`→`NEGOTIATING`. `times_proposed`/`question`→`REPLIED`. `book`→`MEETING_BOOKED`. Keyword fallback if the model fails. Do **not** trigger on `chatMessage.created` / `updated`. |

AI drafts (before FORM): opener = short hook + one question, meeting as a light close; follow-ups escalate value (3rd is a breakup); email fallback matches ICP, no invented LinkedIn facts; replies never invent calendar times. Inbound classification (not the draft agent) stamps `STOPPED` / `DEFERRED` / `NEGOTIATING` / `REPLIED` / `MEETING_BOOKED`. AI_AGENT JSON output is `{{aiStep.message}}`. Missed enrich → `FAILED_ENRICH`.

## Harvest — CRON companies into CRM

`create_complete_workflow` trigger `CRON` `{ "type": "HOURS", "schedule": { "hour": 6, "minute": 0 }, "outputSchema": {} }`. Steps: `search-companies` then `upsert-companies` with `projectId` (GTM Harvest Project id) and `companies: "{{<search-uuid>.companies}}"`. Edges trigger → search → upsert. Activate. This is **not** the Companies tab Redis path.

## Workflow 1 — company created → ICP people → enroll

Do **not** FIND_RECORDS Project or pass `icpSpec`. `search-people-for-company` loads the Project and parses std function/grade itself. Optional `jobTitle` takes precedence over Project `icpSpec` buyerTitles[0] and is classified the same way as `search-people`. Company trigger payload has **no** `projectId` field. Search returns hits only; `upload-profiles` persists Person + Candidate.

Use `create_complete_workflow` with:

```json
{
  "name": "Company Created → ICP People Search",
  "trigger": {
    "type": "DATABASE_EVENT",
    "settings": { "eventName": "company.created", "outputSchema": {} }
  },
  "steps": [
    {
      "id": "<uuid-search>",
      "name": "Search people for company",
      "type": "LOGIC_FUNCTION",
      "valid": true,
      "settings": {
        "input": {
          "logicFunctionId": "<search-people-for-company id from list_logic_function_tools>",
          "logicFunctionInput": {
            "companyId": "{{trigger.properties.after.id}}"
          }
        },
        "errorHandlingOptions": {
          "retryOnFailure": { "value": false },
          "continueOnFailure": { "value": false }
        }
      }
    },
    {
      "id": "<uuid-upload>",
      "name": "Upload profiles",
      "type": "LOGIC_FUNCTION",
      "valid": true,
      "settings": {
        "input": {
          "logicFunctionId": "<upload-profiles id from list_logic_function_tools>",
          "logicFunctionInput": {
            "projectId": "{{<uuid-search>.projectId}}",
            "people": "{{<uuid-search>.people}}"
          }
        },
        "errorHandlingOptions": {
          "retryOnFailure": { "value": false },
          "continueOnFailure": { "value": false }
        }
      }
    }
  ],
  "edges": [
    { "source": "trigger", "target": "<uuid-search>" },
    { "source": "<uuid-search>", "target": "<uuid-upload>" }
  ]
}
```

## Clone / copy → edit → activate

When the user is **tweaking** an existing graph (especially Stage B / `outreachWorkflowId`): clone the draft, edit only what changed, pin `workspaceMemberId`, FORM+IF_ELSE before SEND_* (`workflow-building`), `linkedinProfileId` is the Unipile slug (never a URL; Person uses `linkedinLink`), validate once, activate.

When the user asks for the **full sequencer**, create **missing** graphs from the table above. Do not fold harvest / email fallback / follow-ups / calendar into Stage B.

**Execute** enroll with native `upload-profiles` (`projectId` + `people[]`) → `QUEUED` + LinkedIn ids → `candidate.created` → Stage B. Then `list_workflow_runs`. Do not burn the turn on metadata rabbit holes.

## Outreach “start LinkedIn connection outreach”

Treat phrases like “start outreach”, “send connection requests”, “run the LinkedIn workflow” as **execute authorization**:

1. Load this skill + `workflow-building`; list logic functions; ensure Stage B is pinned/activated (clone+edit only if broken).
2. Enroll People-tab rows → Candidates (`QUEUED` + `linkedinUrl` + `linkedinProfileId` slug).
3. Summarize workflow runs — do not stop after “I’ll fix the template next”.

## Send window (project-level)

Connection requests (`SEND_LINKEDIN_CONNECTION_REQUEST`) honor Project fields:

| Field | Default | Role |
| --- | --- | --- |
| `sendTimezone` | `Asia/Kolkata` | IANA timezone for the window |
| `sendWindowStart` | `08:00` | Local start (HH:mm) |
| `sendWindowEnd` | `10:00` | Local end (HH:mm) |

Allowed days are **Tue–Thu** only. Outside the window the Unipile step defers with `pendingReason: outreach_send_window` (same delayed-job resume path as account rate limits). Volume caps stay on the LinkedIn Unipile account limiter (not Project fields).

**Multi-market ops:** use one GTM Project per geography so the window matches ICP locations:

| GTM project | `sendTimezone` | Window | ICP `locations` focus |
| --- | --- | --- | --- |
| India | `Asia/Kolkata` | 08:00–10:00 | India cities |
| GCC | `Asia/Dubai` | 08:00–10:00 | UAE / Saudi / etc. |
| UK | `Europe/London` | 08:00–10:00 | United Kingdom |
| US East | `America/New_York` | 08:00–10:00 | United States (East) |

Configure under Outreach → Setup → **Send schedule**. Do not mix India + US people in one Project if you care about local morning delivery.
