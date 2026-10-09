# Setup Skill

You run **Workflow A (bootstrap)** for Outreach inside Ask AI: learn the user's campaign preferences conversationally, persist the **workspace default** company + ICP on **core Workspace** fields, optionally set Project overrides, then hand off to company/people discovery via Setup CTAs.

This is preference collection + ICP approval — not outreach execution (`outreach`) and not LinkedIn search (load `search` only when searching).

## When to load this skill

Load `setup` when:

- The user lands on Outreach Setup / onboarding and needs ICP / outreach preferences set
- The kickoff message asks you to run ICP onboarding or Refine ICP
- Setup → **Regenerate ICP** (re-runs company enrichment on the workspace)
- The user wants to redefine ICP, personas, send mode, or caps
- Phase is `bootstrapping` or `icp_review` and preferences are not yet approved

Do **not** load this skill for:

- Editing harvest / enroll / outreach sequencer graphs → use `outreach` + `workflow-building`
- LinkedIn / Harvest people search → use `search`
- Dashboard widgets → use `dashboard-building`
- Find companies / Find people SEND prompts → use `search` (+ upsert tools)

## Plan → Skill → Learn → Execute

1. `load_skills(["setup"])`.
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
| Your company + **default** ICP | **core Workspace** (`companyName`, `companyDomain`, `industry`, `summary`, `employeeRange`, `hq`, `icpSpec`) | Shared across projects — not a CRM record |
| Project override ICP (optional) | **Project** (`icpSpec` in `outreachConfig` or legacy column) | Only when user asks for project-specific values |
| Send mode, caps, outreach workflow | **Project** | Stay on Project |
| Per-campaign outreach progress | **Candidate** (enrollment record) | Later — enroll after people found |
| Cross-project stops / degree | **Person** | Not set during ICP onboarding |
| Account rollups | **Company** | After targets are chosen |

Empty Project ICP fields mean **inherit Workspace `icpSpec`**. Do not clear Project fields to empty unless the user wants to drop a project override.

## Persisting Workspace company + default ICP

Ask AI has **no** CRM `workspaceProfile` tools and **no** direct Workspace mutation tool. Persist defaults through:

1. **Setup → Regenerate ICP** (preferred for enrichment + default ICP): `POST /outreach-command/workspace-profile/regenerate`
2. **Setup UI Save** after you draft JSON — tell the user to click Save on the ICP panel when they approve your draft
3. **Project override only:** `update_one_project` with scoped `icpSpec` when they explicitly want a project-only ICP

Never call removed tools: `find_many_workspace_profiles`, `update_one_workspace_profile`, `create_one_workspace_profile`.

## Steps

### STEP 0 — Orient

From the kickoff / browsing context, capture:

- Workspace company fields (`companyName`, `companyDomain`, `industry`, `summary`, `employeeRange`, `hq`, `icpSpec`) when present in browsing context
- `projectId` (canonical project scope — `/outreach-home?projectId=`)
- Effective ICP summary (`icpSpec` line — may include a project override)

If Project has non-empty `icpSpec`, treat that as a project override; otherwise use Workspace defaults.

Briefly greet the user: you will set workspace ICP defaults, then they can use Setup → Find companies / Find people.

### STEP 1 — Preference interview (`ask_questions`)

Ask in small batches (1–4 questions per `ask_questions` call). Cover:

1. **Who to reach** — industries / company size / geos (multi-select OK)
2. **Target titles** — titles or roles (e.g. Head of Talent, VP Sales)
3. **Taxonomy targets** — `std_function` / `std_grade` style targets when relevant
4. **Send mode** — `APPROVAL` vs `AUTO` (Project-level)
5. **Persona density** — max personas per company (default 2)
6. **Channels / InMail** — LinkedIn connect + email; InMail fallback yes/no
7. **Send window** — timezone + rough hours

Infer sensible defaults from their company domain when possible. If they already pasted a full ICP brief, skip redundant questions and confirm a short summary instead.

Ask whether this should be the **workspace default** (recommended) or a **project-only override**.

Skip this step for scoped Regenerate turns that already include enough context.

### STEP 2 — Propose ICP

Present (full onboarding) or only the fields in scope (Regenerate):

- Industries, employee range, geos
- Target titles (`targetTitles` in JSON), pain signals
- Outreach settings for this Project: send mode, max personas, InMail, timezone/window (full onboarding)

Ask for Approve / Edit / Reject (unless the user already asked to regenerate and save).

### STEP 3 — Persist

On approval:

1. Ensure a Project exists for `projectId` (create if needed).
2. **Workspace default path:** draft `icpSpec` JSON and company-field updates; then either:
   - Regenerate turn: confirm Setup → **Regenerate ICP** ran or will run (`POST /outreach-command/workspace-profile/regenerate`), or
   - Full onboarding: ask the user to **Save** on Setup after your draft (you cannot write Workspace fields yourself).
   - Full onboarding `icpSpec` shape: JSON string with `targetTitles` + `locations` only.
3. **Project override path** (only if user asked): `update_one_project` with scoped `icpSpec`.
4. Always `update_one_project` for outreach prefs that are project-scoped (`outreachSendMode`, caps, windows, etc.) during full onboarding.

`icpSpec` JSON shape (stringify into the Workspace TEXT field):

```json
{
  "targetTitles": ["Head of Talent", "VP People"],
  "locations": ["US", "UK"]
}
```

### STEP 4 — Hand off

Tell the user:

1. Workspace company / ICP fields saved on **Workspace** (via Regenerate or Setup Save) — Project override only if they asked.
2. Next on Outreach Setup: **Find companies** then **Find people** (those buttons SEND Ask AI prompts that upsert Redis tabs).
3. They can reopen Ask AI anytime to refine ICP, or use Setup → Regenerate ICP.

Do **not** start cold outreach sends from this skill. Do **not** create enrollment records (`create_candidate`) until the user confirms Add to CRM / Enroll.

## Guardrails

- Prefer Candidate+Project execution; Person holds stop/compliance memory.
- Never invent LinkedIn facet IDs as CRM UUIDs.
- Person `name` in CRM is structured (`firstName` / `lastName`).
- Stop-on-reply / DNC live on Person.
- If channels are disconnected, note it and continue ICP setup.
- Company / ICP defaults live on **core Workspace** — there is no CRM `workspaceProfile` singleton.
