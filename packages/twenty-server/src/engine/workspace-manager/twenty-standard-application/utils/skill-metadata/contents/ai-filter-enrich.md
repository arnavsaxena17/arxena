---
description: |-
  Add an AI-computed column (filter or enrichment) to the project people / companies: preview on ~10 rows, then run for all
priority: 40
routes:
  - when: |-
      Filter / classify / enrich the people or companies in the list ("who is a CEO", "revenue of each", "employees in each")
    hint: |-
      . Never re-search or page `find_many_*` for the list; the skill reads the project tab.
  - when: |-
      Preview / draft the first LinkedIn message (opener) the people in the list would get once their connection request is accepted ("sample first message for each", "what would we send them after they accept")
    sections: [sample-message]
    hint: |-
      . Do not look for a workflow template or enrolled candidates; list rows need no enrollment.
parts:
  - filter-and-sort
  - sample-message
defaultSections:
  - filter-and-sort
---
# AI Filter & Enrich Skill

Add an AI-computed column to filter, classify or enrich the people or companies the user is already looking at ("who is a CEO", "revenue of each", "mark which are in fintech").

Authentic / real / worthy / clean up fakes is `validate-profiles`. Sourcing against criteria is a fitment column: pass `fitment` to `preview_ai_column` instead of `description` (`scoring`); `fitmentOutcome`, `fitmentScore` and `fitmentReason` are computed in code.

## Flow (always in this order)

1. **Scope = the tab the user is on.** The browsing context has `activeTab` (people when missing). Pass `tab: "people"` or `tab: "companies"` on every call.
   - **People tab:** "these / the list / each" means the people. Questions about their **companies** ("revenues of each of these companies", "which are in fintech") are still people-tab columns about the person's employer; the server handles that. Do not switch tabs and do not ask where the companies come from.
   - **Companies tab:** "these / each" means the project's companies (CRM companies tagged to the project plus the Find list, merged).
2. **Reuse before you create.** `get_outreach_tab({ projectId, tab, limit: 1 })` returns `aiColumns` (key, label, type, rows filled). If a column already answers the request, do not preview or run a new one (it costs money): go to filter and sort. Source columns count too (Headquarters Country, Employees On Linkedin, Size Band, Industry, About, Specialties are on every Bright Data row): filter on them instead of asking a model. To count or choose a cut-off, never page rows: `get_outreach_tab({ ..., limit: 1, summarize: ["<column key>"], onlyViewMatches: true })` returns value counts or min, quartiles and max over all rows. Page rows (`limit: 10`) only to see a few.
   - `groupBy` (one or two keys, e.g. `["finalState", "rung"]`) and `filter` (the `apply_table_view` filter shape, e.g. turnover `empty` and location `contains` Gujarat) replace paging rows to count: they return counts per group and `matchCount` over every matching row; add `fields` to see only a few keys on the sample rows.
3. **Row scope when the tab already has other rows.** After a write that returns `writtenRowIds`, or when a preview's `selection` shows `chatUpsertedCount < tabTotal`, ask once with `ask_questions` before the first preview or run:
   - **This chat's upserts only** (recommended on a non-empty project): `rowScope: "chat_upserts"` (or pass `rowIds` / `writtenRowIds`).
   - **Existing unfilled rows too:** `rowScope: "unfilled"` (or omit it).
   - **All rows including re-score:** `rowScope: "all"` and `rerunAll: true`.
   On an empty tab skip the ask. Never invent `apply_table_view` filters to mean "empty column" or "this chat's rows".
4. **Preview on ~10 rows in the user's own words:** `preview_ai_column({ projectId, tab, description: "<what the user asked>", rowScope? })`. The server designs the column (name, types, prompt, model); pass `filter` only when the user asks for a specific design. Show the column name(s) with types, the 10 results as a small table, `usage.engine`, and the estimated full-run cost. If `typeWarnings` is not empty, preview again with a more specific `description` ("revenue as a number in USD", "size as one of 1-50, 51-200, 201-1000, 1000+").
5. **Approve only when needed.** The preview returns `needsApproval` and `autoRunLimitUsd`. If `needsApproval` is false, run. If true, ask once ("Run for all {total} rows (~$X)?": Run for all / Adjust the column / Cancel) and pass the approved amount as `approvedCostUsd`; `run_ai_column` refuses without it. A cap already approved for a list build (`scoring`) is passed as `approvedCostUsd` with no new ask.
6. **Run, scope matters.**
   - **"First N", a test, regenerate N:** `run_ai_column({ projectId, tab, previewId, rowLimit: N, rowScope? })`. Always pass `rowLimit` unless the user said all rows: `rerunAll: false` alone is not a limit and fills every empty row in scope.
   - **All rows in scope:** the same call with no `rowLimit` (add `onlyViewMatches: true` for the applied view only). It waits for the run (`waitSeconds`, default 150); if `status` is still `"running"`, call `get_ai_column_run_status({ runId })` once (it waits two minutes), never more than once a minute. `cancel_ai_column_run({ runId })` stops and keeps filled rows. One run per project at a time.
   - **Failed rows** (rate limit etc.): call again with the same `previewId`, `rowLimit` and `rowScope`; answered rows are skipped. `rerunAll: true` only when the user wants every in-scope row recomputed. A `previewId` lasts one hour.
7. **Report** the column name(s) and types, rows answered and failed, `usage` (`engine`, tokens, `estimatedCostUsd`; jev reports none, say so), a few sample rows, and for a yes/no filter how many matched.
8. **Filter and sort only when the request asks for it** (`filter-and-sort` section), after the column is filled.

Tools: `learn_tools({ toolNames: ["get_outreach_tab", "preview_ai_column", "preview_sample_message_column", "run_ai_column", "get_ai_column_run_status", "cancel_ai_column_run", "remove_ai_column", "generate_table_view", "apply_table_view"] })` once, before the first call.

## One column per fact

The table never holds two columns for the same fact (two store counts, two revenues, two "in India" flags). Filters and sorts use the one existing column.

- If a column exists but its values are weak, incomplete or from a worse engine, preview again with a description that says to fill or update it (the server reuses its key and type) and run with `rerunAll: true` or `onlyViewMatches`. Do not add a sibling.
- The preview returns `reusedColumns` and `duplicateWarnings`. If `duplicateWarnings` is not empty, do not run: preview again so the field reuses the existing key, unless it is a genuinely different fact (say why in one line).
- A new threshold or category list is not a new fact: change the filter on the existing column.

## Remove / undo

`remove_ai_column({ projectId, tab, columnKeys: ["isCeo"] })` strips the values and `otherFields.aiColumns` meta from every tab row; take keys from `aiColumns`. It does not restore values the column overwrote. To undo this chat's column work, the user uses the Ask AI panel **Undo** control; it does not undo upserts, enrollments, sends or profile fetches.

## Do not

- Create CRM Company / Person records, enroll anyone, or write the column with `update_*` tools: `run_ai_column` writes it into `otherFields` for both the Find list and the CRM rows
- Invent revenue or headcount when the web search returns nothing (a number stays empty, a label says "unknown")
- Call `remove_ai_column` unless the user asked to delete, undo or drop the column
