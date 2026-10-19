## Source: Bright Data, companies

### Limits and exhaustion

One query returns at most 1,100 rows (`limit` up to 100, `offset` up to 1,000), split into slices by the planner; a slice with no `fetchableRecords` left is exhausted. $0.002 per returned record, $10 cap per primary query. Repeating a query returns only duplicates: change the industry words, the city or the size band.

<!-- search-bright-data-companies-source-section:start -->
### Source — Bright Data (`search_bright_data_business`)

Plain-language company sets. Pass the user's sentence as `query`. Do not turn it into a taxonomy filter, and do not use this for a pasted LinkedIn URL. Requires `BRIGHT_DATA_API_KEY`; tell the user if it is missing.

`entity`: `"company"`. `mode`: always ludicrous (smart and instant are not used; any `mode` passed is ignored).

**Ludicrous is budgeted. Always show the cost before fetching.** It bills **$0.002 per returned record**, capped at **$10 per query**. The server turns the request into several structured, non-overlapping queries (title synonyms, cities, size and funding buckets), then fetches slice by slice and drops slices whose results stop being relevant.

**What a query may say.** The sentence can only use ideas the company data holds: what the company is (industry, about, specialties, name), where (country, city), organization type, founded year, employee size, funding, followers. Write "cosmetics and beauty retail companies in India", never "... with stores and outlets", "chain", "franchise", store counts, revenue or ad activity: those words are not in the data, so they break matching. Judge those facts afterwards with enrichment columns (see **Judged lists**, then `ai-filter-enrich`).

**How the query is built (server side, you only pass the sentence).** The planner turns the request into a structured ludicrous `query` and always fetches `view: "full"`. Conditions are `and` / `or` / `not` over `text` (text fields), `equals` / `in` / `range` (typed fields). Text fields take only `text`, typed fields never take `text`, and single-value `in` on array fields stays `in`. Topic words use `mode: "all"` (every word required). Example for companies:

```json
{ "and": [
  { "or": [
    { "text": { "about": { "value": "quick service restaurant", "mode": "all" } } },
    { "text": { "specialties": { "value": "quick service restaurant", "mode": "all" } } }
  ] },
  { "in": { "offices_country_codes": ["IN"] } }
] }
```

1. **Estimate.** Call with the raw `query`, no `planId`, and **no `projectId`**. It spends a few cents sampling each slice and writes nothing. The result has `planId`, `shards` (per slice: `matched`, `fetchableRecords`, `samplePrecision`), `estimatedUniqueRecords`, `estimatedAccurateRecords`, `estimatedCostUsd`, `estimateCostUsd` and `budgetOptions` (records and dollars at several sizes).
2. **Ask for a budget.** Show a short table of the slices with their counts, say how many unique records are reachable and the expected accuracy, and offer the `budgetOptions` ("250 records ≈ $0.50, 1,000 ≈ $2.00, all ≈ $X"). State the estimate itself already cost `estimateCostUsd`. If `message` warns that sampled accuracy is low, say so and offer to reword the request before spending more. Stop until the user picks a budget. If every slice matched 0, say so and offer a rewording instead.
3. **Fetch.** After the user confirms, call again with the same `query`, the `planId`, `maxBudgetUsd` (their chosen budget, at most 10), `targetCount` (the number they asked for) and the `projectId`. The tool writes the Companies tab itself, so do not upsert those rows again. The estimate's sample rows are reused, so nothing is bought twice.
4. **Report.** The result carries `count`, `spentUsd`, `shardReports`, a `summary` (totals, top industries and countries) and a `listId` (= `planId`). The records are in that list (see **Result lists**) for 30 days, so nothing paid for is lost if the chat or the project is missing, and you never read them. Tell the user the count, the cost, the `summary` and where the rows are. If the call had no `projectId`, nothing was written to a tab: ask which project to use (see the write contract), then call `outreach_list` with `action: "attach"` (show them on the Companies tab, 500 at most) or `"save_to_crm"` (create CRM records; needs the user's go-ahead). For the whole list give the user an `export` link; use `peek` (max 10 rows) only for a quality check. Say which slices stopped early because relevance dropped and what was spent against the budget.

If the plan has expired the tool says so; run the estimate again. Never exceed a budget the user did not confirm.

{{include: boolean-title-strings}}

```
// 1. estimate
search_bright_data_business({
  "entity": "company",
  "query": "Apparel brands in India with more than 50 stores"
})

// 3. after the user confirms $2
search_bright_data_business({
  "entity": "company",
  "query": "Apparel brands in India with more than 50 stores",
  "planId": "<planId from step 1>",
  "maxBudgetUsd": 2,
  "targetCount": 1000,
  "projectId": "<from browsing context>"
})
```

Without a `projectId` (not on Find), keep the estimate and approval, then return the rows in chat instead of writing them.

<!-- search-bright-data-companies-source-section:end -->
