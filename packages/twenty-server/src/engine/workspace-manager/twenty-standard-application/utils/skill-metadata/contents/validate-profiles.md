---
description: |-
  Validate people already on the list: reuse existing profiles (skip re-fetch when already Bright Data), gap-fetch the rest, score ICP and quality, mark not worthy, filter
priority: 35
routes:
  - when: |-
      Validate / clean up the people list for authentic, real, or worthy profiles ("are these authentic", "which are fake", "mark not worthy", "clean up this list")
    hint: |-
      . Never score from name, title and company alone.
---
# Validate profiles

Score people **already on the People tab** as worthy or not. Do not re-source. Fitment rules and profile reading are in `sourcing` `scoring`; this skill is that flow limited to existing rows and the worthiness gates.

## Flow

1. **Scope.** `tab: "people"`, `projectId` and the project ICP (`icpSpec`, target titles, geography, seniority) from browsing context. The ICP is the fit criteria; the worthiness gates below are always must-haves here.
2. **Tools once:** `learn_tools({ toolNames: ["get_outreach_tab", "fetch_profiles", "preview_ai_column", "run_ai_column", "get_ai_column_run_status", "generate_table_view", "apply_table_view", "ask_questions"] })`.
3. **Reuse profiles on the rows.** Check the People set for a `profile` column. Rows that have one (from `find_role_at_companies` or a prior fetch), especially `profile.source === "bright_data"`, are ready to score. Never pay again for them.
4. **Fetch only the gaps, Bright Data only.** `fetch_profiles({ projectId, rowLimit: 500, sources: ["bright_data"] })` for rows still missing `profile`; call again while `remaining` > 0 and ask once for spend if needed. It looks people up by LinkedIn URL first, then by name and company (then Google); a match needs the name and company to agree. `resolvedLinkedinUrls` says how many were found each way. Never pass `refresh: true`, never add Harvest, never omit `sources` (that enables Harvest).
5. **Score full profiles** with `stage: "profile"` and `rerunAll: true` after a fetch or when profiles were already on the rows. Rows still without a profile are unknown, not fail.

{{include: worthiness-gates}}

```
preview_ai_column({
  projectId,
  tab: "people",
  fitment: {
    stage: "profile",
    criteria: [
      { key: "icpFit", description: "<ICP, target titles, geo, in the user's words>", mustHave: true },
      { key: "enoughConnections", description: "<from the gates>", mustHave: true },
      { key: "hasActivityOrSubstance", description: "<from the gates>", mustHave: true },
      { key: "profileFilled", description: "<from the gates>", mustHave: true }
    ]
  }
})
```

Then `run_ai_column` (approval rules as in `ai-filter-enrich`).
6. **Mark and clean up.** `fitmentOutcome` fail = not worthy. Report pass and fail counts with `get_outreach_tab` `summarize: ["fitmentOutcome"]` (peek at most 10 rows). On "clean up", "remove fakes" or "keep only worthy": `generate_table_view` then `apply_table_view` keeping `fitmentOutcome` = pass.

Before each stage say in one line what happens and how many rows ("418 people: 73 have a profile, fetching 345"), and after each `fetch_profiles` call with `remaining` > 0 say how many are left. When the user names a few rows ("the first 10"), do only those. End with the pass and fail counts and why the failures failed.

## Do not

- Run an "isAuthentic" column on name, title and company, or skip the fetch because the table shows titles. Titles are not a `profile`
- Mark rows "not worthy" when a fetch failed (the result warns about failed lookups): a missing profile is unknown. Stop, say the provider is unreachable, and offer to retry later
- Re-search or page `find_many_*` for the list, or lower the fitment threshold to keep more rows
