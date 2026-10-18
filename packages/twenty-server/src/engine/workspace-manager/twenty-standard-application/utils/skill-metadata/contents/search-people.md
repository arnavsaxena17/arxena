## People

A population is this section: a title, a skill, an industry, a city, or "all software engineers who know React in SaaS companies in Mumbai". Do not call `find_role_at_companies` and do not look up each person at each company. A role at companies already named loads `people-by-company`.

### Provider map (choose by intent)

| Source | Tool(s) | Best for | Requires |
| --- | --- | --- | --- |
<!-- search-apollo-people-provider-row:start -->
| **Apollo** | `search_apollo_people` | Firmographic people search: title, company, headcount, location, keywords; emails/phones | Apollo connected (server config) |
<!-- search-apollo-people-provider-row:end -->
| **LinkedIn / Unipile** | `search_linkedin_people` | Live LinkedIn people (classic / Sales Nav / Recruiter) | Connected LinkedIn Unipile account |
| **Harvest** | People API (`dataSource: "harvest"`) | People search without LinkedIn; taxonomy-backed role/function/grade | Harvest configured |
<!-- search-exa-people-provider-row:start -->
| **Exa** | `exa_web_search` | Web/AI search for hard-to-find people; `category: "people"` | `EXA_API_KEY` set |
<!-- search-exa-people-provider-row:end -->
<!-- search-bright-data-people-provider-row:start -->
| **Bright Data** | `search_bright_data_business` (`entity: "people"`) | Plain-language people sets ("MD or CEO of QSR restaurants in India"), budgeted ludicrous mode by default ($0.002/record), not a pasted LinkedIn URL or a taxonomy filter | `BRIGHT_DATA_API_KEY` set |
<!-- search-bright-data-people-provider-row:end -->
<!-- search-people-index-provider-row:start -->
| **Internal index** | `search_people_index` | Dedupe against people already in the workspace | Elasticsearch index |
<!-- search-people-index-provider-row:end -->

### learn_tools (people)

On Outreach include `upsert_outreach_target_people`. Do not `create_candidate` on Find or on Save to CRM.

```
# Outreach (default)
learn_tools([
<!-- search-apollo-people-learn-tools-line:start -->
  "search_apollo_people",
<!-- search-apollo-people-learn-tools-line:end -->
  "search_linkedin_people",
<!-- search-people-index-learn-tools-line:start -->
  "search_people_index",
<!-- search-people-index-learn-tools-line:end -->
<!-- search-exa-people-learn-tools-line:start -->
  "exa_web_search",
<!-- search-exa-people-learn-tools-line:end -->
<!-- search-bright-data-people-learn-tools-line:start -->
  "search_bright_data_business",
<!-- search-bright-data-people-learn-tools-line:end -->
  "upsert_outreach_target_people"
])

# Save to CRM only, after the user asks
learn_tools([
  "save_outreach_targets_to_crm"
])
```

<!-- search-find-candidate-internal-learn-tools-line:start -->
`find_candidate_in_arxena_internal` looks up one existing person. It does not create a record.
<!-- search-find-candidate-internal-learn-tools-line:end -->

Dedup across sources **by normalized name + email/linkedin** before writing.

<!-- search-apollo-people-source-section:start -->
### Source — Apollo (`search_apollo_people`)

Best for firmographic people search with contact data. Available in the `prospecting` pack.

- Use when the user names Apollo, or Bright Data is unavailable or returned nothing.
- Common filters: `person_titles`, `person_locations`, `q_keywords`, `organization_locations`, `organization_num_employees`.
- Returns name, title, company, location, and often email/phone — map to CRM candidate fields.

```
search_apollo_people({
  "person_titles": ["software engineer", "backend engineer"],
  "person_locations": ["New York, NY"],
  "q_organization_keywords": "fintech",
  "page_size": 25
})
```

<!-- search-apollo-people-source-section:end -->
### Source — LinkedIn / Unipile (`search_linkedin_people`)

Live LinkedIn people. Facet examples are at the end of this section. Resolve facet ids with `search_linkedin_parameters` and never invent one. Keep a close title match ("Trident Group" → "Trident Group India"). Drop a clear mismatch ("Raymond Ltd" → "Raymond James") or an empty result, and omit that filter.

- `searchType`: `classic`, `sales_navigator`, or `recruiter` — only values listed in the LinkedIn status appended when this skill loads. If Sales Navigator or Recruiter is not listed, say so and use `classic` or Harvest (`dataSource: "harvest"`). If LinkedIn is not connected, do not call `search_linkedin_*`.
- Named Sales Nav lead lists: `search_linkedin_parameters({ parameterType: "LEAD_LISTS" })` → `search_linkedin_people` with `lead_lists.include`.
- `search_linkedin_from_url` for pasted LinkedIn / Sales Nav / Recruiter people URLs.
- Recently added 1st-degree connections: `list_linkedin_relations` with `limit` = n.

### Source — Harvest (People API)

Taxonomy-backed people search without a LinkedIn session. Population examples (no named employer) are at the end of this section.

- `search_people_api` with `naturalLanguage` (preferred) or `search_people_by_job_title` alias.
- Always pass `dataSource: "harvest"`. Never invent `harvest_*` tool names.

<!-- search-exa-people-source-section:start -->
### Source — Exa (`exa_web_search`)

Web/AI search for niche or public-profile people (speakers, authors, founders).

- `category`: `"people"`. Returns title/url/snippet only — extract name + profile hints from snippet.
- Requires `EXA_API_KEY` (tell the user if missing).

```
exa_web_search({
  "query": "backend engineers at fintech startups in Mumbai who speak at conferences",
  "category": "people",
  "numResults": 15
})
```

<!-- search-exa-people-source-section:end -->
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
### Outreach ephemeral save (default on /outreach-home)

Follow **Ephemeral write contract** (preamble). Steps:

1. Search → map hits → `execute_tool` upsert (mandatory before ending turn).
2. Field map (LinkedIn `result.items[]` → upsert row):

| Source | Upsert field |
| --- | --- |
| `name` or `first_name` + `last_name` | `name` |
| `headline` or `current_positions[0].title` | `title` |
| `current_positions[0].companyName` | `companyName` |
| `public_profile_url` | `linkedinUrl` |
| (default) | `stage: "queued"` |

3. Search tools in **Result lists** return a `listId`: show the rows with `outreach_list` `attach`. For a tool that still returns rows, build `people[]` and make one `execute_tool` upsert. Never upsert from the sandbox.
4. Summarize written count. Do **not** create enrollment records until the user confirms.

### Save to CRM (only when the user asks)

1. Dedupe on **email** first, then **LinkedIn URL**, then normalized name + company.
2. `save_outreach_targets_to_crm` with `target: "people"`. Omit ids to save the whole tab. This creates Person records and does not start outreach.
3. **LinkedIn results** are in a list (see **Result lists**): `outreach_list` `save_to_crm` is the same write. Do not parse the rows yourself.
4. Start outreach only after those records exist, and only when the user asks: load `outreach`.

### People constraints

- On Outreach People tab, a Find must write the tab before ending: `search_bright_data_business` with `projectId`, or `outreach_list` `attach`, or `upsert_outreach_target_people`. Do not end on a chat-only list. Do not `create_candidate` on Find or on Save to CRM.
- Present results with name, title, company, location, and source; note when Recruiter results hide public identifiers.

### People facet examples

Do not mix classic flat arrays into Sales Navigator or Recruiter bodies. Job title on Sales Navigator is `role: { include: ["id"] }`, never `job_title`. Recruiter role is `role: [{ keywords }]` or `[{ id }]`.

**Classic people**

```json
{
  "searchType": "classic",
  "searchParameters": {
    "api": "classic",
    "category": "people",
    "keywords": "product manager",
    "location": ["102277331"],
    "industry": ["6"],
    "network_distance": [1, 2, 3]
  },
  "limit": 10
}
```

**Sales Navigator people** (population, no named employer)

```json
{
  "searchType": "sales_navigator",
  "searchParameters": {
    "api": "sales_navigator",
    "category": "people",
    "keywords": "textile OR fabric",
    "role": { "include": ["14"] },
    "industry": { "include": ["60"] },
    "location": { "include": ["102713980"] },
    "profile_language": ["en"]
  },
  "limit": 10
}
```

**Recruiter people**

```json
{
  "searchType": "recruiter",
  "searchParameters": {
    "api": "recruiter",
    "category": "people",
    "network_distance": [1, 2, 3],
    "industry": { "include": ["4"] },
    "role": [{ "keywords": "developer OR engineer", "priority": "MUST_HAVE", "scope": "CURRENT_OR_PAST" }],
    "skills": [{ "id": "50517", "priority": "MUST_HAVE" }]
  },
  "limit": 10
}
```

**Pasted people-list URL** (`/sales/lists/people/{id}`): `search_linkedin_from_url({ url, limit: 25 })`, then `search_linkedin_continue` until the pages are done. Attach once.

**Named Sales Navigator lead list** (a list name, no URL): `search_linkedin_parameters({ parameterType: "LEAD_LISTS", limit: 100 })`, pick the `id` whose title matches, then `search_linkedin_people` with `lead_lists: { include: ["<id>"] }`.

**Recently added connections:** `list_linkedin_relations` with the user's n as `limit`. Do not walk the whole network.

**Natural-language people brief:** `generate_linkedin_query_set` once for that `rawRequirement`, then `validate_linkedin_query_set`, then pass the params to `search_linkedin_people`.

**Harvest population** (no named employer). Call `list_people_data_sources` if you are unsure Harvest is configured. Never invent `harvest_*` tool names.

```json
{
  "dataSource": "harvest",
  "stdFunction": "engineering",
  "stdGrade": "leadership",
  "country": "United States",
  "limit": 20
}
```

---
