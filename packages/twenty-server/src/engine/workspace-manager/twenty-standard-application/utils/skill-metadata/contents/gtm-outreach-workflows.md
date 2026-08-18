# GTM Outreach Workflows Skill

You build and run **GTM Command automation graphs** (company enroll + LinkedIn outreach). Generic workflow mechanics live in `workflow-building` — load both when creating or editing these graphs.

This is **not** ICP preference collection (`gtm-icp-onboarding`) and **not** ephemeral People/Companies search (`search-people` / `search-companies`).

## When to load this skill

Load `gtm-outreach-workflows` (with `workflow-building`) when:

- The user wants a workflow that fires on **company created/added** and fetches people from Project ICP
- The user asks to start LinkedIn / connection / outreach / enroll for a GTM run
- The user wants to clone or edit **GTM Outreach — Per Candidate** (Stage B), Connection Accepted, or Reply graphs
- Browsing context is GTM Command (`/gtm-home`) and the ask is about outreach workflows

Do **not** load this skill for generic CRM automations (email on person create, cron reports, etc.) — use `workflow-building` only.

## Plan → Skill → Learn → Execute

1. `load_skills(["gtm-outreach-workflows", "workflow-building"])`.
2. `list_logic_function_tools` — use `inputSchema` / `isNative`. There is **no** `upload_profiles` logic function.
3. `learn_tools` for `create_complete_workflow` (or clone tools) then execute. Do **not** grep spilled JSON Schema with `code_interpreter`.

Native GTM functions (`search-people-for-company`, `search-people`, `search-companies`, `search-jobs`, `fetch-linkedin-profile`) have stub source. Do **not** call `get_logic_function_source` for them.

Generic search (hits only, no CRM enroll): `search-people` (People API), `search-companies` (Company API — Unipile Sales Nav auto, Recruiter/classic, Harvest, index), `search-jobs` (Jobs API). Workflow 1 enroll still uses **`search-people-for-company`**.

## GTM workflows (do not conflate)

| Workflow | Trigger | Role |
| --- | --- | --- |
| **Workflow 1** (company search enroll) | `company.created` | LOGIC_FUNCTION `search-people-for-company` → Person+Candidate at `QUEUED` |
| **Workflow U** (manual) | HTTP Ask AI / org-chart `upload_profiles` | Same enroll path; GTM projects get `QUEUED` + `linkedinProfileId` |
| **Stage B** (`GTM Outreach — Per Candidate`) | `candidate.created` + filter `QUEUED` | `SEND_LINKEDIN_CONNECTION_REQUEST` using `workspaceMemberId` + `linkedinProfileId`. Do **not** DELAY-poll accept. |
| **Stage B accept** (`GTM Outreach — Connection Accepted`) | `candidate.updated` `CONNECTION_ACCEPTED` / ACCEPTED | `fetch-linkedin-profile` → AI_AGENT draft → FORM `notifyOnPending` (`wf_form_boolean_text`, WhatsApp to workspace member phone) → SEND `{{form.editedBody}}`. Follow-up DELAY 2–5 days until inbound. |
| **Stage C** (`GTM Outreach — Reply`) | `candidate.updated` `REPLIED` | FIND `whatsappMessages` → AI_AGENT → FORM → send. No instant calendar create. Inbound sets `lastInboundAt` immediately; `REPLIED` only after a silence window. |

## Workflow 1 — company created → ICP people

Do **not** FIND_RECORDS Project or pass `icpSpec`. `search-people-for-company` loads the Project and parses std function/grade itself. Company trigger payload has **no** `projectId` field.

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
      "id": "<uuid>",
      "name": "Search people for company",
      "type": "LOGIC_FUNCTION",
      "valid": true,
      "settings": {
        "input": {
          "logicFunctionId": "<id from list_logic_function_tools>",
          "logicFunctionInput": {
            "companyId": "{{trigger.properties.after.id}}"
          }
        },
        "errorHandlingOptions": {
          "retryOnFailure": { "value": false },
          "continueOnFailure": { "value": false }
        }
      }
    }
  ],
  "edges": [{ "source": "trigger", "target": "<same step uuid>" }]
}
```

Trigger fields are `{{trigger.properties.after.<field>}}`. Edges use `source` / `target` (never `from` / `to`).

## Clone / copy → edit → activate (preferred over rebuild)

When the user wants a LinkedIn connection / outreach workflow and a template already exists (especially GTM Command Stage B **`GTM Outreach — Per Candidate`** or browsing context `outreachWorkflowId`):

1. **Resolve** — `list_workflows` (or use `outreachWorkflowId` from `<browsing_context>`). Prefer the Project-pinned id. Do **not** create a brand-new blank workflow if a Stage B template exists.
2. **Inspect** — `get_workflow_current_version({ workflowId })`.
3. **Clone draft to edit safely** — `create_draft_from_workflow_version({ workflowId, workflowVersionIdToCopy })`.
4. **Edit only what the request needs** — remap field paths, messages, filters, caps. For approval mode, insert FORM (`BOOLEAN`+`TEXT` + WhatsApp `notifyOnPending`) + IF_ELSE immediately before SEND_*.
5. **Candidate LinkedIn fields** — `linkedinUrl.primaryLinkUrl` is the profile URL. `linkedinProfileId` is the Unipile/public identifier only (never a URL). Person uses `linkedinLink`. SEND_* should pass `linkedinProfileId`.
6. **Validate once** — `validate_workflow` at the end (`validate: false` on intermediate step updates).
7. **Activate** — `activate_workflow_version` on the draft you edited.
8. **Execute for GTM people** — enroll with `projectsId` = Project id, `outreachSequenceStage` = `QUEUED`, `linkedinUrl.primaryLinkUrl`, and `linkedinProfileId` slug. Manual enroll stays HTTP/`upload_profiles`. Auto enroll is Workflow 1 above. That fires `candidate.created` → Stage B. Then `list_workflow_runs`.
9. **Do not** burn the turn on metadata rabbit holes or parse-glitch retries.

## GTM Command “start LinkedIn connection outreach”

Treat phrases like “start outreach”, “send connection requests”, “run the LinkedIn workflow” as **execute authorization**:

1. Load this skill + `workflow-building`; list logic functions; ensure Stage B is pinned/activated (clone+edit only if broken).
2. Enroll People-tab rows → Candidates (`QUEUED` + `linkedinUrl` + `linkedinProfileId` slug).
3. Summarize workflow runs — do not stop after “I’ll fix the template next”.
