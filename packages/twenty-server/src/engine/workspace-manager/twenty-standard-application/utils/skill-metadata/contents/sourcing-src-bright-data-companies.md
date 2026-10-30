## Source: Bright Data, companies

{{sources: limits bright-data}}

<!-- search-bright-data-companies-source-section:start -->
### Source — Bright Data (`search_bright_data_business`)

`entity`: `"company"`. Requires `BRIGHT_DATA_API_KEY`; tell the user if it is missing.

{{include: bright-data-modes}}

### Instant recipe — one company by website or LinkedIn URL

Use this when the user gives a domain, website or LinkedIn company URL ("who is stripe.com", "enrich notion.so", "look up linkedin.com/company/abfrl"). The tool keeps only rows whose website host, or LinkedIn URL, matches.

1. Pass the bare host or URL with **no spaces** (`stripe.com`, `https://www.linkedin.com/company/abfrl`). Do not wrap it in a sentence.
2. Call once (no estimate, no budget ask):

```
search_bright_data_business({
  "entity": "company",
  "mode": "instant",
  "query": "stripe.com",
  "limit": 20
})
```

3. `count` and `companies` / `previewRows` are already filtered. If `count` is 0, say so, try an instant probe on the company name, then Wikidata (`search_wikidata_companies`). Never retry on ludicrous with the domain or URL: it has no such field.
4. Report name, domain, industry, LinkedIn URL, size. On Outreach Find the tab is written; with no project the result shows `previewRows` only.

### Ludicrous query

Pass the user's sentence as `query`; do not turn it into a taxonomy filter.

**Pass the industry label with it.** Before the estimate, resolve the segment with `get_source_capabilities({ entity: "company", want: ["industry"], term: "<segment>" })` and pass `industries` with the exact label(s) it returns. The planner may not broaden "glass manufacturing" to "Manufacturing" or invent a label. A made-up label matches nothing; a real one is the strongest company filter the data has.

```
search_bright_data_business({
  "entity": "company",
  "query": "glass manufacturing companies in India",
  "industries": ["Glass, Ceramics and Concrete Manufacturing"]
})
```

**What a query may say.** Only ideas the company data holds: what the company is (industry, about, specialties, name), where (country, city), organization type, founded year, employee size, funding, followers. Write "cosmetics and beauty retail companies in India", never "... with stores and outlets", "chain", "franchise", store counts, revenue or ad activity: those words are not in the data, so they break matching. Score those facts afterwards with enrichment columns (see **Scored lists**, then `ai-filter-enrich`).

**How the query is built (server side, you only pass the sentence).** The planner turns the request into a structured ludicrous `query` and always fetches `view: "full"`. Conditions are `and` / `or` / `not` over `text` (text fields), `equals` / `in` / `range` (typed fields). Text fields take only `text`, typed fields never take `text`, and single-value `in` on array fields stays `in`. Topic words use `mode: "all"` (every word required). Example:

```json
{ "and": [
  { "or": [
    { "text": { "about": { "value": "quick service restaurant", "mode": "all" } } },
    { "text": { "specialties": { "value": "quick service restaurant", "mode": "all" } } }
  ] },
  { "in": { "offices_country_codes": ["IN"] } }
] }
```

{{include: bright-data-ludicrous-budget}}

```
// 1. estimate
search_bright_data_business({
  "entity": "company",
  "query": "Apparel brands in India"
})

// 3. after the user confirms $2
search_bright_data_business({
  "entity": "company",
  "query": "Apparel brands in India",
  "listId": "<listId from step 1>",
  "maxBudgetUsd": 2,
  "targetCount": 1000
})
```

With no project (an MCP client, not on Find), keep the estimate and approval, then return the rows in chat instead of writing them.

<!-- search-bright-data-companies-source-section:end -->
