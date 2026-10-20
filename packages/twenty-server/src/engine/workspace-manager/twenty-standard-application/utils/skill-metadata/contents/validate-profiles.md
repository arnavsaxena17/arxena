---
description: |-
  Validate people already on the list: fetch full profiles, score against project ICP and profile quality, mark not worthy, filter
priority: 35
routes:
  - when: |-
      Validate / clean up the people list for authentic, real, or worthy profiles ("are these authentic", "which are fake", "mark not worthy", "clean up this list")
    hint: |-
      . Never judge from name, title and company alone. Fetch with `sources: ["bright_data"]` only (no Harvest), then fitment at stage "profile" against project ICP plus quality gates.
---
# Validate profiles

Judge people **already on the People tab** as worthy or not. Do not re-source. Do not add a designed authenticity column on snapshot fields.

## Flow

1. **Scope.** `subject: "person"`, `tab: "people"`, `projectId` from browsing context.
2. **Brief from setup.** Read workspace / project ICP (`icpSpec`, target titles, geography, seniority) from browsing context. Those are fit criteria. Profile quality gates below are always must-haves for this request.
3. **Tools once:** `learn_tools({ toolNames: ["get_outreach_working_set", "fetch_profiles", "preview_ai_column", "run_ai_column", "get_ai_column_run_status", "generate_table_view", "apply_table_view", "ask_questions"] })`.
4. **Fetch with Bright Data only.** `fetch_profiles({ projectId, rowLimit: 500, sources: ["bright_data"] })`. Do **not** fall back to Harvest. Rows with no `fitmentOutcome` yet are included. Call again while `remaining` > 0. Ask once for spend if needed; do not skip the fetch to save a turn.
5. **Score what Bright Data returned.** Fitment at `stage: "profile"` (not `description`). Rows Bright Data did not return have no profile: leave them unknown / fail must-haves — do not call Harvest or invent fields.

```
preview_ai_column({
  projectId,
  subject: "person",
  fitment: {
    stage: "profile",
    criteria: [
      { key: "icpFit", description: "<ICP / target titles / geo from setup, in the user's words>", mustHave: true },
      { key: "enoughConnections", description: "Has a credible LinkedIn network (roughly 50+ connections, or clear 500+); empty or near-empty network fails", mustHave: true },
      { key: "hasActivityOrSubstance", description: "Looks active or substantive: recent experience, about text, or other signs of a real working profile — not a dormant shell", mustHave: true },
      { key: "profileFilled", description: "Profile is filled in: photo, experience detail, and enough about/headline to be a real person — not a placeholder", mustHave: true }
    ]
  }
})
```

   Add or drop ICP criteria to match the project; keep the three quality gates as must-haves. Then `run_ai_column` (same approval rules as `ai-filter-enrich`). Use `rerunAll: true` when rescoring after a fetch.
6. **Mark not worthy.** `fitmentOutcome` fail = not worthy. Report pass / fail counts via `get_outreach_working_set` `summarize: ["fitmentOutcome"]`. Peek at most 10 rows.
7. **Clean up when asked.** "Clean up", "remove fakes", "keep only authentic / worthy" → `generate_table_view` then `apply_table_view` to keep `fitmentOutcome` = pass.

## Do not

- Preview or run a boolean "isAuthentic" column on name / title / company only
- Skip `fetch_profiles` because the table already shows titles
- Pass Harvest in `sources`, or omit `sources` (that enables Harvest)
- Re-search or page `find_many_*` for the list
- Lower the fitment threshold to keep more rows
