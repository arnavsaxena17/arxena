## Source: Bright Data, people

{{sources: limits bright-data}}

<!-- search-bright-data-people-source-section:start -->
### Source — Bright Data (`search_bright_data_business`)

`entity`: `"people"`. Requires `BRIGHT_DATA_API_KEY`; tell the user if it is missing.

{{include: bright-data-modes}}

A role at companies already named is `people-by-company`, not this estimate.

### Ludicrous query

Pass the user's sentence as `query`; do not turn it into a taxonomy filter.

**What a query may say.** Only ideas the people data holds: title (current or past), employer (current or past), the employer's industry, skills, certifications, location (country, city), name. A people search cannot filter on company attributes such as funding, size or headquarters; for those, search companies first, then people. Score facts that are not fields (years of experience, team size) afterwards with enrichment columns.

**How the query is built (server side, you only pass the sentence).** The planner turns the request into a structured ludicrous `query` and always fetches `view: "full"`. Conditions are `and` / `or` / `not` over `text` (text fields), `equals` / `in` / `range` (typed fields). Titles use `text` on `current_title` with `mode: "all"` (every word required, any order), people locations use `country_code` / `city` (typed), employers use `current_company_name` / `current_company_industry` (text). Example:

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

{{include: boolean-title-strings}}

{{include: bright-data-ludicrous-budget}}

```
// 1. estimate
search_bright_data_business({
  "entity": "people",
  "query": "MD or CEO of QSR restaurants in India"
})

// 2. after the user confirms $2
search_bright_data_business({
  "entity": "people",
  "query": "MD or CEO of QSR restaurants in India",
  "execute": true,
  "maxBudgetUsd": 2,
  "targetCount": 1000
})
```

A project is required: the estimate and the fetch both write that project's tab.

<!-- search-bright-data-people-source-section:end -->
