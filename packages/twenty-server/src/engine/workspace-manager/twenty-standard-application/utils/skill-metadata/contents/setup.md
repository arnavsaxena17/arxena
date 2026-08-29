# Setup Skill

You run **Workflow A (bootstrap)** for Outreach inside Ask AI: learn the user's campaign preferences conversationally, persist the **workspace default** ICP + search blurbs on **Workspace Profile**, optionally set Project overrides, then hand off to company/people discovery via Setup CTAs.

This is preference collection + ICP approval — not outreach execution (`outreach`) and not LinkedIn search (load `search` only when searching).

## When to load this skill

Load `setup` when:

- The user lands on Outreach Setup / onboarding and needs ICP / outreach preferences set
- The kickoff message asks you to run ICP onboarding or Refine ICP
- Setup → **Regenerate** for ICP, company search blurb, or people search blurb (each is a separate turn)
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
  "find_many_workspace_profiles",
  "find_one_workspace_profile",
  "create_one_workspace_profile",
  "update_one_workspace_profile",
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
| Your company + **default** ICP + blurbs | **`workspaceProfile`** (singleton) | Shared across projects |
| Project override ICP / blurbs (optional) | **Project** (`icpSpec`, `icpSegment`, `icpBlurb`, `companySearchBlurb`, `peopleSearchBlurb`) | Only when user asks for project-specific values |
| Send mode, caps, outreach workflow | **Project** | Stay on Project |
| Per-campaign outreach progress | **Candidate** (enrollment record) | Later — enroll after people found |
| Cross-project stops / degree | **Person** | Not set during ICP onboarding |
| Account rollups | **Company** | After targets are chosen |

Empty Project ICP/blurb fields mean **inherit workspace profile**. Do not clear Project fields to empty unless the user wants to drop a project override.

## Setup Regenerate modes (one field group per turn)

Outreach Setup has **three separate Regenerate buttons**. Each SEND prompt is intentionally scoped — do **not** refresh sibling fields unless the user explicitly asks.

| Mode | Update only | Do not touch |
| --- | --- | --- |
| **Regenerate ICP** (Setup button) | Re-runs company enrichment and writes your-company fields + `icpSpec` / `icpBlurb` / `icpSegment` on `workspaceProfile` | Existing `companySearchBlurb` / `peopleSearchBlurb` |
| Regenerate company search blurb | `companySearchBlurb` via Ask AI | `icpSpec`, `icpBlurb`, `peopleSearchBlurb` (unless ICP empty — then draft minimal ICP first) |
| Regenerate people search blurb | `peopleSearchBlurb` via Ask AI | `icpSpec`, `icpBlurb`, `companySearchBlurb` (unless ICP empty — then draft minimal ICP first) |

For regenerate-only turns: skip the full preference interview when enough your-company + current ICP context is in the prompt; propose the draft, then persist on approval (or immediately if the user said to regenerate/save without asking).

## Steps

### STEP 0 — Orient

From the kickoff / browsing context, capture:

- Workspace / signup company domain and industry (if present)
- `projectId` (canonical project scope — `/outreach-home?projectId=`)
- Existing Project id (canonical `projectId`)

Load the singleton `workspaceProfile` (`find_many_workspace_profiles`, take first). If Project has non-empty `icpSpec`, treat that as a project override; otherwise use profile defaults.

Briefly greet the user: you will set workspace ICP defaults (and search blurbs), then they can use Setup → Find companies / Find people.

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

### STEP 2 — Propose ICP + blurbs

Present (full onboarding) or only the fields in scope (Regenerate modes):

- Name / segment label
- **icpBlurb** — 2–4 sentence NL definition of who the ICP is and what matters to them
- Industries, employee range, geos
- Target titles (`buyerTitles` in JSON), `stdFunctions` / `stdGrades`, pain signals
- Draft **companySearchBlurb** (NL brief for target accounts) — full onboarding only, or company-blurb regenerate
- Draft **peopleSearchBlurb** (NL brief for target roles at those accounts) — full onboarding only, or people-blurb regenerate
- Outreach settings for this Project: send mode, max personas, InMail, timezone/window (full onboarding)

Ask for Approve / Edit / Reject (unless the user already asked to regenerate and save).

### STEP 3 — Persist

On approval:

1. Ensure a Project exists for `projectId` (create if needed).
2. **Default path:** `create_one_workspace_profile` if missing, else `update_one_workspace_profile` with your-company fields (if refined) and only the fields in scope for this turn.
   - Full onboarding: `icpSegment`, `icpSpec` (JSON string), `icpBlurb`, `companySearchBlurb`, `peopleSearchBlurb`.
   - ICP regenerate: `icpSegment`, `icpSpec`, `icpBlurb` only.
   - Company blurb regenerate: `companySearchBlurb` only.
   - People blurb regenerate: `peopleSearchBlurb` only.
3. **Project override path** (only if user asked): also `update_one_project` with the same scoped fields.
4. Always `update_one_project` for outreach prefs that are project-scoped (`outreachSendMode`, caps, windows, etc.) during full onboarding.

`icpSpec` JSON shape (stringify into the TEXT field) — structured filters only; the NL definition lives in **`icpBlurb`**, not inside this JSON:

```json
{
  "name": "Mid-market people leaders",
  "industries": ["HR Tech", "SaaS"],
  "employeeRange": "50-200",
  "geos": ["US", "UK"],
  "buyerTitles": ["Head of Talent", "VP People"],
  "painSignals": ["slow pipelines", "thin team capacity"],
  "stdFunctions": ["talent acquisition", "people"],
  "stdGrades": ["director", "vp"]
}
```

`icpBlurb` example: "We reach mid-market HR Tech / SaaS companies (50–200) in the US and UK whose people leaders struggle with slow pipelines and thin team capacity."

### STEP 4 — Hand off

Tell the user:

1. Workspace fields saved on **Workspace Profile** (and Project override only if they asked).
2. Next on Outreach Setup: **Find companies** then **Find people** (those buttons SEND Ask AI prompts that upsert Redis tabs).
3. They can reopen Ask AI anytime to refine ICP, or use the per-section Regenerate buttons (ICP / company blurb / people blurb are independent).

Do **not** start cold outreach sends from this skill. Do **not** create enrollment records (`create_candidate`) until the user confirms Add to CRM / Enroll.

## Guardrails

- Prefer Candidate+Project execution; Person holds stop/compliance memory.
- Never invent LinkedIn facet IDs as CRM UUIDs.
- Person `name` in CRM is structured (`firstName` / `lastName`).
- Stop-on-reply / DNC live on Person.
- If channels are disconnected, note it and continue ICP setup.
- Never bundle ICP + company blurb + people blurb updates on a Regenerate turn unless the user explicitly asked for all three.
