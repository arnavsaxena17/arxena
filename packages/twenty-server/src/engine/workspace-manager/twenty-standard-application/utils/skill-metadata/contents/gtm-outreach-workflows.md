# GTM Outreach Workflows Skill

You build and run **GTM Command automation graphs** (company harvest + enroll + LinkedIn/email sequencer). Generic mechanics (DELAY vs event, FORM HITL, CRON schema) live in `workflow-building` — load both; do not restate them here.

Step outputs are already unwrapped in run context. Use `{{<step-uuid>.<field>}}` for LOGIC_FUNCTION / AI_AGENT, `{{<step-uuid>.first.<field>}}` for FIND_RECORDS, `{{trigger.properties.after.<field>}}` for DATABASE_EVENT, and `{{<form-uuid>.<fieldName>}}` for FORM (no extra `.result`).

This is **not** ICP preference collection (`gtm-icp-onboarding`) and **not** Ask AI target-list search (`search-companies` / `search-people` → Redis tabs). Interactive GTM Companies tab stays Redis. **Scheduled harvest that writes the CRM companies table** is this skill.

## When to load this skill

Load `gtm-outreach-workflows` (with `workflow-building`) when:

- The user wants a **workflow** that harvests LinkedIn companies on a schedule, enrolls people on company create, or runs LinkedIn / email / meeting outreach
- The user wants to clone or edit the seeded GTM outreach graphs, or browsing context is GTM Command (`/gtm-home`) and the ask is about outreach **workflows**

Do **not** load this skill for generic CRM automations (email on person create) or for chat-only company/people lists — use `workflow-building` or `search-companies` / `search-people`. Dashboards: load `dashboard-building` and **extend** the existing GTM Command dashboard.

## Plan → Skill → Learn → Execute

1. `load_skills(["gtm-outreach-workflows", "workflow-building"])`.
2. `list_logic_function_tools` — use `inputSchema` / `isNative`. Enroll with native `upload-profiles`. Persist harvested companies with native `upsert-companies`.
3. `learn_tools` for `create_complete_workflow` (or clone tools) then execute. Do **not** grep spilled JSON Schema with `code_interpreter`.

Native GTM functions (`search-people-for-company`, `search-people`, `search-companies`, `search-jobs`, `fetch-linkedin-profile`, `fetch-linkedin-messages`, `fetch-company-details`, `upload-profiles`, `upsert-companies`, `enrich-contact`, `get-calendar-availability`) have stub source. Do **not** call `get_logic_function_source` for them.

Search LFs return hits only. People persist with `upload-profiles`. Company persist for automation is CRM + `gtmRunKey` (not Redis).

## GTM workflows (do not conflate)

FILTER every graph on `outreachSequenceStage` (and often `connectionStatus`). FIND `workspaceMember` then `workspaceMemberProfile` and pin `workspaceMemberId` = `{{member.first.id}}` on every SEND_* / Unipile fetch. HITL WhatsApp recipient = `{{profile.first.phoneNumber}}`. HITL = FORM on the **send** graph (`workflow-building`); never a fourth “HITL only” workflow.

Do **not** add a workflow whose only job is “mark connection accepted” — Unipile `new_relation` already materializes `CONNECTION_ACCEPTED` / `connectionStatus=ACCEPTED`.

| Workflow | Trigger | Role |
| --- | --- | --- |
| **Harvest** | `CRON` `HOURS` | Native `search-companies` `{ query, keywords, limit }` → native `upsert-companies` `{ projectId, companies: "{{searchUuid.companies}}" }` (CRM + `gtmRunKey`). Seed Project **GTM Harvest**. Do **not** `upsert_gtm_target_companies`. Skip rows already tagged to this run. |
| **Workflow 1** (company people search) | `company.created` | LOGIC_FUNCTION `search-people-for-company` → LOGIC_FUNCTION `upload-profiles`. Optional FORM between only if the user wants to approve enroll. |
| **Workflow U** (manual) | HTTP Ask AI / org-chart / GTM Home `upload-profiles` | Same enroll path; GTM projects get `QUEUED` + `linkedinProfileId` |
| **Stage B** (`GTM Outreach — Per Candidate`) | `candidate.created` + filter `QUEUED` | `SEND_LINKEDIN_CONNECTION_REQUEST` (`workspaceMemberId` + `linkedinProfileId`). Do **not** DELAY-poll accept. Same graph: DELAY 3d → FIND → IF still `CONNECTION_SENT` → `EMAIL_ENRICHING` → `enrich-contact` → AI email → FORM → `DRAFT_EMAIL` / `SEND_EMAIL` → `EMAIL_SENT`; miss → `FAILED_ENRICH`. Accept is a **second** graph (`workflow-building` timer vs event). |
| **Stage B accept** (`GTM Outreach — Connection Accepted`) | `candidate.updated` `CONNECTION_ACCEPTED` | `fetch-linkedin-messages` → `fetch-linkedin-profile` → AI_AGENT (rapport opener; JSON `{ "message" }`) → FORM → SEND `{{form.editedBody}}`. Then DELAY 3d → FIND → IF not `REPLIED` and `linkedinFollowUpCount` < 3 → AI follow-up → FORM → SEND → increment count; else `FAILED_NO_REPLY`. DELAY is not wait-for-reply. |
| **Stage C inbound classify** | silence-window flush (not a workflow) | LLM classifies the **recipient burst** → stamps stage. `unsubscribe`→`STOPPED` (no send). `not_now`→`DEFERRED`. `interested`→`NEGOTIATING`. `times_proposed`/`question`→`REPLIED`. `book`→`MEETING_BOOKED`. Keyword fallback if the model fails. Do **not** trigger on `chatMessage.created` / `updated`. |
| **Stage C** (`GTM Outreach — Reply`) | `candidate.updated` `REPLIED` | FIND `chatMessage` → `get-calendar-availability` → AI_AGENT draft (answer / confirm their times using injected slots only) → FORM → SEND. Classifier already ran; do not re-route intent here. |
| **Negotiating** | `candidate.updated` `NEGOTIATING` | Same shape as Reply with the negotiating prompt (advance toward a meeting). |
| **Deferred** | `candidate.updated` `DEFERRED` | Short ack, no pitch, no times → FORM → SEND, then stay paused. |
| **Meeting booked** | `candidate.updated` `MEETING_BOOKED` | FORM confirm start/end from last inbound → `CREATE_CALENDAR_EVENT`. |

AI drafts (before FORM): opener = short hook + one question, meeting as a light close; follow-ups escalate value (3rd is a breakup); email fallback matches ICP, no invented LinkedIn facts; replies never invent calendar times. Inbound classification (not the draft agent) stamps `STOPPED` / `DEFERRED` / `NEGOTIATING` / `REPLIED` / `MEETING_BOOKED`. AI_AGENT JSON output is `{{aiStep.message}}`. Missed enrich → `FAILED_ENRICH`.

## Harvest — CRON companies into CRM

`create_complete_workflow` trigger `CRON` `{ "type": "HOURS", "schedule": { "hour": 6, "minute": 0 }, "outputSchema": {} }`. Steps: `search-companies` then `upsert-companies` with `projectId` (GTM Harvest Project id) and `companies: "{{<search-uuid>.companies}}"`. Edges trigger → search → upsert. Activate. This is **not** the Companies tab Redis path.

## Workflow 1 — company created → ICP people → enroll

Do **not** FIND_RECORDS Project or pass `icpSpec`. `search-people-for-company` loads the Project and parses std function/grade itself. Company trigger payload has **no** `projectId` field. Search returns hits only; `upload-profiles` persists Person + Candidate.

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

## GTM Command “start LinkedIn connection outreach”

Treat phrases like “start outreach”, “send connection requests”, “run the LinkedIn workflow” as **execute authorization**:

1. Load this skill + `workflow-building`; list logic functions; ensure Stage B is pinned/activated (clone+edit only if broken).
2. Enroll People-tab rows → Candidates (`QUEUED` + `linkedinUrl` + `linkedinProfileId` slug).
3. Summarize workflow runs — do not stop after “I’ll fix the template next”.
