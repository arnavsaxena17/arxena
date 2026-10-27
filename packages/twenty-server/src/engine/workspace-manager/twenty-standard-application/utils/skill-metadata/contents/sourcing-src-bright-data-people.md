## Source: Bright Data, people

{{sources: limits bright-data}}

<!-- search-bright-data-people-source-section:start -->
### Source — Bright Data (`search_bright_data_business`)

Plain-language people sets. Pass the user's sentence as `query`. Do not turn it into a taxonomy filter, and do not use this for a pasted LinkedIn URL. Requires `BRIGHT_DATA_API_KEY`; tell the user if it is missing.

`entity`: `"people"`. `mode`: always ludicrous (smart and instant are not used; any `mode` passed is ignored).

**Ludicrous is budgeted. Show the cost before fetching.** A role at companies already named is `people-by-company`, not this estimate. It bills **$0.002 per returned record**. The server turns the request into several structured, non-overlapping queries (title synonyms, cities, size and funding buckets), then fetches slice by slice and drops slices whose results stop being relevant.

**How the query is built (server side, you only pass the sentence).** The planner turns the request into a structured ludicrous `query` and always fetches `view: "full"`. Conditions are `and` / `or` / `not` over `text` (text fields), `equals` / `in` / `range` (typed fields). Titles use `text` on `current_title` with `mode: "all"` (every word required, any order), people locations use `country_code` / `city` (typed), employers use `current_company_name` / `current_company_industry` (text). A people search cannot filter on company attributes such as funding or headquarters; for those, search companies first, then people. Example:

```json
{ "and": [
  { "or": [
    { "text": { "current_title": { "value": "chief executive officer", "mode": "all" } } },
    { "text": { "current_title": { "value": "managing director", "mode": "all" } } }
  ] },
  { "in": { "country_code": ["IN"] } },
  { "text": { "current_company_industry": { "value": "restaurants", "mode": "all" } } }
] }
```

1. **Estimate.** Call with the raw `query`, no `planId`, and **no `projectId`**. It spends a few cents sampling each slice and writes nothing. The result has `planId`, `shards` (per slice: `matched`, `fetchableRecords`, `samplePrecision`), `estimatedUniqueRecords`, `estimatedAccurateRecords`, `estimatedCostUsd`, `estimateCostUsd` and `budgetOptions` (records and dollars at several sizes).
2. **Ask for a budget.** Show a short table of the slices with their counts, say how many unique records are reachable and the expected accuracy, and offer the `budgetOptions` ("250 records ≈ $0.50, 1,000 ≈ $2.00, all ≈ $X"). State the estimate itself already cost `estimateCostUsd`. If `message` warns that sampled accuracy is low, say so and offer to reword the request before spending more. Stop until the user picks a budget. If every slice matched 0, say so and offer a rewording instead.
3. **Fetch.** After the user confirms, call again with the same `query`, the `planId`, `maxBudgetUsd` (their chosen budget, at most 10), `targetCount` (the number they asked for) and the `projectId`. The tool writes the People tab itself, so do not upsert those rows again. The estimate's sample rows are reused, so nothing is bought twice.
4. **Report.** The result carries `count`, `spentUsd`, `shardReports`, a `summary` (totals, top industries and countries) and a `listId` (= `planId`). The records are in that list (see **Result lists**) for 30 days, so nothing paid for is lost if the chat or the project is missing, and you never read them. Tell the user the count, the cost, the `summary` and where the rows are. If the call had no `projectId`, nothing was written to a tab: ask which project to use (see the write contract), then call `outreach_list` with `action: "attach"` (show them on the People tab, 500 at most) or `"save_to_crm"` (create CRM records; needs the user's go-ahead). For the whole list give the user an `export` link; use `peek` (max 10 rows) only for a quality check. Say which slices stopped early because relevance dropped and what was spent against the budget.

If the plan has expired the tool says so; run the estimate again. Never exceed a budget the user did not confirm.

{{include: boolean-title-strings}}

```
// 1. estimate
search_bright_data_business({
  "entity": "people",
  "query": "MD or CEO of QSR restaurants in India"
})

// 3. after the user confirms $2
search_bright_data_business({
  "entity": "people",
  "query": "MD or CEO of QSR restaurants in India",
  "planId": "<planId from step 1>",
  "maxBudgetUsd": 2,
  "targetCount": 1000,
  "projectId": "<from browsing context>"
})
```

Without a `projectId` (not on Find), keep the estimate and approval, then return the rows in chat instead of writing them.

<!-- search-bright-data-people-source-section:end -->
