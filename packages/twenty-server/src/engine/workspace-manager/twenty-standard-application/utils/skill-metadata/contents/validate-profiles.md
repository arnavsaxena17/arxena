---
description: |-
  Validate people already on the list: reuse existing profiles (skip re-fetch when already Bright Data), gap-fetch the rest, score ICP and quality, mark not worthy, filter
priority: 35
routes:
  - when: |-
      Validate / clean up the people list for authentic, real, or worthy profiles ("are these authentic", "which are fake", "mark not worthy", "clean up this list")
    hint: |-
      . Never score from name, title and company alone. Reuse an existing `profile` column (especially `source: "bright_data"` from find_role or a prior fetch). Only `fetch_profiles` with `sources: ["bright_data"]` for rows that still lack one — no Harvest, no second Bright Data pull on the same rows. Then fitment at stage "profile".
---
# Validate profiles

Score people **already on the People tab** as worthy or not. Do not re-source. Do not add a designed authenticity column on snapshot fields.

## Flow

1. **Scope.** `subject: "person"`, `tab: "people"`, `projectId` from browsing context.
2. **Brief from setup.** Read workspace / project ICP (`icpSpec`, target titles, geography, seniority) from browsing context. Those are fit criteria. Profile quality gates below are always must-haves for this request.
3. **Tools once:** `learn_tools({ toolNames: ["get_outreach_working_set", "fetch_profiles", "preview_ai_column", "run_ai_column", "get_ai_column_run_status", "generate_table_view", "apply_table_view", "ask_questions"] })`.
4. **Reuse profiles already on the row.** Peek / summarize the People set for a `profile` column. Rows that already have one (from `find_role_at_companies`, a prior fetch, etc.) — especially `profile.source === "bright_data"` — are ready to score. Do **not** pay Bright Data again for those; `fetch_profiles` also skips them unless `refresh: true` (never pass refresh here).
5. **Fetch only the gaps, Bright Data only.** For rows still missing `profile`, call `fetch_profiles({ projectId, rowLimit: 500, sources: ["bright_data"] })`. It looks people up by LinkedIn URL in Bright Data Business Search first (seconds) and scrapes only the misses (minutes). People with no LinkedIn URL are searched by name and company in Business Search, then in Google for the ones it misses, and a URL Google finds goes back through Business Search; a match needs the name and the company to agree. The result's `resolvedLinkedinUrls` says how many were found each way. Do **not** fall back to Harvest. Call again while `remaining` > 0. Ask once for spend if needed. If every row already has a profile, skip this step and go straight to score.
6. **Score full profiles.** Fitment at `stage: "profile"` (not `description`). Rows with no profile after the gap fetch: leave them unknown / fail must-haves — do not call Harvest or invent fields.

```
preview_ai_column({
  projectId,
  subject: "person",
  fitment: {
    stage: "profile",
    criteria: [
      { key: "icpFit", description: "<ICP / target titles / geo from setup, in the user's words>", mustHave: true },
      { key: "enoughConnections", description: "LinkedIn connection count: under 10 = useless (fail), 10–100 = very poor (fail), 100–500 = okay (pass), 500+ = good (pass). Unknown or missing count fails", mustHave: true },
      { key: "hasActivityOrSubstance", description: "Looks active or substantive: recent experience, about text, or other signs of a real working profile — not a dormant shell", mustHave: true },
      { key: "profileFilled", description: "Profile is filled in: photo, experience detail, and enough about/headline to be a real person — not a placeholder", mustHave: true }
    ]
  }
})
```

   Add or drop ICP criteria to match the project; keep the three quality gates as must-haves. Then `run_ai_column` (same approval rules as `ai-filter-enrich`). Use `rerunAll: true` when rescoring after a fetch or when profiles were already on the rows.
7. **Mark not worthy.** `fitmentOutcome` fail = not worthy. Report pass / fail counts via `get_outreach_working_set` `summarize: ["fitmentOutcome"]`. Peek at most 10 rows.
8. **Clean up when asked.** "Clean up", "remove fakes", "keep only authentic / worthy" → `generate_table_view` then `apply_table_view` to keep `fitmentOutcome` = pass.

## Keep the user informed

- Before each stage, say in one line what happens and how many rows it covers ("Checking 418 people: 73 already have a profile, fetching 345").
- `fetch_profiles` shows live progress in the chat. After each call with `remaining` > 0, say how many are done and how many are left, then call again. Do not go silent.
- Small first: when the user names a few rows ("the first 10"), do only those. Otherwise run all rows without asking for the next batch.
- End with the filtered list (step 8), the pass / fail counts, and why the failures failed (no LinkedIn URL, too few connections, no profile).

## Do not

- Preview or run a boolean "isAuthentic" column on name / title / company only
- Skip fetch because the table shows titles alone — titles are not a `profile`
- Re-fetch Bright Data when `profile.source` is already `"bright_data"` (or any usable `profile` is present)
- Score or mark "not worthy" rows that have no `profile` because a fetch failed (the result warns about failed lookups): stop, tell the user the provider is unreachable, and offer to retry later. A missing profile is unknown, never a fail
- Pass `refresh: true`, Harvest in `sources`, or omit `sources` (that enables Harvest)
- Re-search or page `find_many_*` for the list
- Lower the fitment threshold to keep more rows
