# Workflow Building Skill

You help users create and manage automation workflows.

## Capabilities

- Create workflows from scratch
- Modify existing workflows (add, remove, update steps)
- Delete workflows entirely (with their versions, runs and triggers) - IMPORTANT : Always confirm with the user before deleting
- Explain workflow structure and suggest improvements
- Troubleshoot workflow runs (inspect status, failed steps, and execution logs)
- Build human-in-the-loop approve/edit/reject gates with FORM + WhatsApp Official notify before SEND_*

## Key Concepts

- **Triggers**: DATABASE_EVENT, MANUAL, CRON, WEBHOOK. One workflow = one trigger. `create_complete_workflow` cannot express two triggers — use a second call for a second event.
- **Steps**: CREATE_RECORD, SEND_EMAIL, DRAFT_EMAIL, CREATE_CALENDAR_EVENT, CODE, LOGIC_FUNCTION, PICK_RECORD, FORM, IF_ELSE, FILTER, DELAY, SEND_LINKEDIN_*, etc. There is **no** calendar free/busy MCP — inject slots from a LOGIC_FUNCTION if one exists; do not invent MCP tools.
- **DELAY**: `DURATION` or `SCHEDULED_DATE` only. It is a timer, not wait-until-field. Do not invent wait-for-event / wait-until steps. After DELAY resumes, FIND_RECORDS by id before IF_ELSE or FILTER — trigger and earlier step output are snapshots.
- **Branches**: Parallel branches all run. DELAY cannot wait for another branch to finish.
- **Cross-workflow state**: Record fields only (update a status on send; a `*.updated` workflow FILTERs on the later value).
- **Data flow**: DATABASE_EVENT fields are `{{trigger.properties.after.fieldName}}`. Use the step UUID, not the step name. CODE / LOGIC_FUNCTION / HTTP / AI_AGENT wrap the payload under `.result` (`{{stepUuid.result.field}}`). FORM fields are `{{formStepId.fieldName}}` with no `.result`. Prefer `validate_workflow` variable paths when unsure.
- **Relationships**: Use nested objects like {"company": {"id": "{{reference}}"}}
- **Human-in-the-loop**: Use a **FORM** step on the **same** graph as SEND_* (not a separate HUMAN_APPROVAL type and not a second workflow — there is no `CALL_WORKFLOW`). FORM parks the run; WhatsApp Official (or Unipile / in-app) collects the reviewer's answer and resumes via `submitFormStep`.

## FORM steps = human approval gate (WhatsApp Official)

There is **no** separate `HUMAN_APPROVAL` action. Human review is the existing **FORM** step with optional `settings.notifyOnPending`.

### Runtime behavior

1. FORM executes → run parks (pending form).
2. If `notifyOnPending` is set → notifier sends context + form fields to the reviewer (WhatsApp Official templates/Flows preferred; Unipile free-text + fill-link; hosted fill page fallback).
3. Reviewer answers on WhatsApp (QR / Flow) or the hosted fill page or the in-app run UI.
4. Answers write through `submitFormStep` → FORM output fields → run resumes.
5. Downstream **IF_ELSE** / FILTER uses FORM outputs (e.g. `{{formStepId.approve}}`) to send or skip.

Do **not** invent a second pause mechanism or a standalone HITL workflow. Do **not** put LLM draft prompts on the FORM node — draft in CODE / LOGIC_FUNCTION / AI steps *before* FORM; FORM only collects approve / edit / reject.

### When to use FORM + notify

Any outbound that a workspace member should review before send:

- Generated email / LinkedIn message / connection note
- Connection request after lead enrichment
- Sequencer / warm-path posts before send

### `notifyOnPending` settings shape

Put this on the FORM step `settings` (alongside `input` form fields):

```json
{
  "notifyOnPending": {
    "channels": ["WHATSAPP_OFFICIAL"],
    "contextTemplate": "Review reply for {{trigger.from}} — ICP hit",
    "detailsTemplate": "Original: {{emailStep.snippet}}\nDraft: {{draftStep.body}}",
    "whatsappOfficialRegistryName": "wf_form_boolean_text",
    "recipients": {
      "WHATSAPP_OFFICIAL": "{{workspaceApproverPhone}}"
    }
  }
}
```

- `channels`: `WHATSAPP_OFFICIAL` and/or `WHATSAPP_UNIPILE` (Slack/Telegram not wired yet).
- `contextTemplate` / `detailsTemplate`: support `{{stepId.field}}` variables — put inbound message + generated draft here so the reviewer sees full context on WhatsApp.
- `whatsappOfficialRegistryName`: optional force; else auto-picked from field signature.
- `recipients`: phone / Unipile target for the reviewer (workspace member). Prefer Settings → Workflow Approvals defaults when the UI has them; still set explicitly when building via tools if known.
- Field `value` on FORM inputs can prefill drafts (resolved variables) so the reviewer edits rather than retypes.

### Form field types → WhatsApp Official registry

| Fields | Prefer registry | WhatsApp delivery |
| --- | --- | --- |
| single `BOOLEAN` | `wf_form_boolean` | Quick-reply Yes/No |
| `BOOLEAN` + `TEXT` | `wf_form_boolean_text` | Flow via `wf_form_boolean_text_flow_v2` (Backdrop `{{1}}`, Details `{{2}}`) — **default for approve/edit/reject send** |
| single `TEXT` / `NUMBER` / `DATE` / `SELECT` / `MULTI_SELECT` | `wf_form_text` / `_number` / `_date` / `_select` / `_multi_select` | Flow |
| `TEXT`+`NUMBER`+`DATE` | `wf_form_text_number_date` | Flow |
| other multi-field (no RECORD) | `wf_form_generic` | Flow or hosted URL |
| `RECORD` / unknown / Flow unavailable | `wf_form_hosted` | Template + hosted fill URL |

### Canonical approve → send pattern

```
trigger → … gather context → generate draft → FORM (BOOLEAN approve + TEXT editedBody, notifyOnPending) → IF_ELSE (approve == true) → SEND_* using {{formStepId.editedBody}}
                                                                                              └→ (else) stop / log / update status rejected
```

Recommended FORM fields for message review:

- `approve` (`BOOLEAN`) — Yes sends, No skips
- `editedBody` or `message` (`TEXT`) — prefilled with `{{draftStep.body}}`; reviewer can modify

Wire SEND_* body to `{{formStepId.editedBody}}` (not the raw draft) so edits are what goes out.

### Building FORM via tools

1. `create_workflow_version_step` with `stepType: "FORM"` (or include type `FORM` in `create_complete_workflow`).
2. `update_workflow_version_step` with full `settings.input` fields + `settings.notifyOnPending`.
3. Add IF_ELSE after FORM; true branch = send actions referencing `{{formStepId.<fieldName>}}`.
4. Ensure WhatsApp Official templates/Flows are APPROVED for the registry names you force (Settings → Workflow Approvals / ensure endpoints). Delivery uses `{registry}_flow_v2` (two body variables). If Flow send fails, fallback is the hosted URL template — never the old single-variable `*_flow` templates. If assets are missing, delivery falls back to hosted fill — run still parks.
5. Validate once at the end; activate.

### Pitfalls

- Forgetting `notifyOnPending` → form only appears in the Twenty run UI (no WhatsApp ping).
- Sending the pre-FORM draft instead of FORM TEXT output → reviewer edits are ignored.
- Using `RECORD` fields when the reviewer must answer on WhatsApp → forces hosted URL; prefer BOOLEAN/TEXT/SELECT for phone UX.
- Expecting Slack/Telegram notify — not available yet; use WhatsApp Official first.
- Putting generation prompt on FORM — keep generation upstream; FORM is collection only.

## CRON Trigger Settings Schema

For CRON triggers, settings.type must be one of these exact values:

1. **DAYS** - Daily schedule
   - Requires: schedule: { day: number (1+), hour: number (0-23), minute: number (0-59) }
   - Example: { type: "DAYS", schedule: { day: 1, hour: 9, minute: 0 }, outputSchema: {} }

2. **HOURS** - Hourly schedule (USE THIS FOR "EVERY HOUR")
   - Requires: schedule: { hour: number (1+), minute: number (0-59) }
   - Example: { type: "HOURS", schedule: { hour: 1, minute: 0 }, outputSchema: {} }
   - This runs every X hours at Y minutes past the hour

3. **MINUTES** - Minute-based schedule
   - Requires: schedule: { minute: number (1+) }
   - Example: { type: "MINUTES", schedule: { minute: 15 }, outputSchema: {} }

4. **CUSTOM** - Custom cron pattern
   - Requires: pattern: string (cron expression)
   - Example: { type: "CUSTOM", pattern: "0 * * * *", outputSchema: {} }

## CODE Steps

Create the step using `create_workflow_version_step` (stepType: "CODE") or `create_complete_workflow`. This returns a step with a `logicFunctionId` in settings.input — the step starts with a default function, not the user's desired code.

## LOGIC_FUNCTION Steps

LOGIC_FUNCTION steps run workspace logic functions. To add one:

1. Call `list_logic_function_tools` — it returns `id`, `name`, `inputSchema`, `outputSchema`, and `isNative`.
2. Native functions have stub source (`isNative: true`). Do **not** call `get_logic_function_source` or `code_interpreter` on their schemas.
3. In `create_complete_workflow`, use type `LOGIC_FUNCTION` with:
   `{ "settings": { "input": { "logicFunctionId": "<id>", "logicFunctionInput": { ... } } } }`
   Never flatten params onto `settings.input`. Edges are `{ "source": "trigger", "target": "<step-uuid>" }` (not from/to).
4. DATABASE_EVENT `settings.eventName` must be `objectName.action` (e.g. `company.created`). Trigger fields: `{{trigger.properties.after.id}}`.

For GTM harvest / enroll / LinkedIn sequencer graphs, also load `outreach` (do not invent those recipes here).

## Listing Workflows

To discover existing workflows in the workspace, use `list_workflows`. Use this before modifying a workflow when the user refers to it by name rather than id — resolve the `id` here first, then call `get_workflow_current_version` with it.

## Deleting Workflows

To delete a workflow entirely, use `delete_workflow` with its `workflowId`. This also removes the workflow's versions, runs and automated triggers, and deactivates any active version — it is a destructive, irreversible operation.

- If the user refers to the workflow by name, resolve its `workflowId` with `list_workflows` first.
- IMPORTANT : Always confirm with the user before deleting, and make sure you are deleting the correct workflow.
- To simply stop a workflow from running without removing it, prefer `deactivate_workflow_version` instead of deleting.

## Troubleshooting Workflow Runs

When a user reports a failing or misbehaving workflow, diagnose it with two read-only tools:

- `list_workflow_runs`: lists runs (optional `workflowId`, optional `status`, optional `limit`), most recent first. Each result carries `id`, `name`, `status`, run-level `error`, `startedAt`, `endedAt`, `workflowId`, and `workflowVersionId`.
- `get_workflow_run`: returns full details for one run (`workflowRunId`) — overall status, run-level error, every step's status/error, and the execution logs of the steps that failed.

### Resolving the run when no id is given

For requests like "fix my latest failed workflow" where no run or workflow id is provided, call `list_workflow_runs` with `status` "FAILED" and NO `workflowId` — this returns the most recent failed run across all workflows, and each result already carries `workflowId`, `workflowVersionId`, and a human-readable `name`, so you never need an id from the user. If the user names a specific workflow, resolve its `workflowId` first and pass it as a filter.

### Flow

1. Identify the run via `list_workflow_runs` (use `limit` 5 when no `workflowId` so you can detect multiple failing workflows).
2. If results span multiple `workflowId`s, disambiguate by name with the user before editing anything.
3. Call `get_workflow_run` on the chosen run id to read the failed step(s) and their error/logs.
4. Map back to the workflow definition via `get_workflow_current_version(workflowId)`, then propose or apply a fix.
## PICK_RECORD Steps

PICK_RECORD selects one record from a candidate pool (settings.input.recordIds) and outputs it for later steps to reference — useful for assignment workflows like picking an owner. Set settings.input.strategy to RANDOM, ROUND_ROBIN, or LOAD_BALANCED; LOAD_BALANCED also needs settings.input.loadBalance.{objectNameSingular, fieldName} to pick the candidate with the fewest related records.

## Critical Notes

Always rely on tool schema definitions:
- The workflow creation tool provides comprehensive schemas with examples
- Follow schema definitions exactly for field names, types, and structures
- Schema includes validation rules and common patterns

## Validation Strategy

Build steps fully configured up front so the workflow is correct on the first try. Mutation tools (`create_complete_workflow`, `update_workflow_version_step`) return a compact validation summary (error codes, messages, suggestions) — fix any reported errors.

Do NOT call `validate_workflow` after every change:
- When making several step edits in a row, pass `validate: false` to `update_workflow_version_step` to skip per-edit validation.
- Call `validate_workflow` exactly ONCE at the end, before activating. It returns the full report including warnings and available variable paths.


## Approach

Map the user's timing onto builder constraints and **create** the workflow(s). Do not ask whether to use one graph or two. Only ask if the field/value that means "it happened" is unknown.

- After N days, then branch → **one** workflow: action → DELAY → FIND_RECORDS → IF_ELSE
- As soon as a record field/status changes → **one** workflow: `DATABASE_EVENT` `object.updated` + FILTER / IF_ELSE on the new value
- Immediate-on-event **and** fallback if it has not happened in N days → **two** workflows (two `create_complete_workflow` calls). Timer graph: action → DELAY → FIND → IF not done → fallback. Event graph: `object.updated` + filter done → immediate action. Record fields coordinate them.
- Do not encode "as soon as X" as DELAY then IF_ELSE in the same graph — that waits the full N days.

Example (generic): send an invite; if accepted/paid/completed within 3 days, message immediately; else send email. Create (A) send → DELAY 3d → FIND → IF not done → SEND_EMAIL and (B) `*.updated` + filter done → SEND message.

- List logic function tools. Present relevant ones to the user as options before defaulting to CODE steps.
- For modifications, understand current structure first
- After creating, explain what was created and why (timer vs event)

Never set `retryOnFailure` on SEND_* / SEND_EMAIL (duplicate sends). Search/enrich may retry.

Prioritize workflow effectiveness under current builder limits.
