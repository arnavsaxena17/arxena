## Companies

### Provider map (choose by intent)

| Source | Tool(s) | Best for | Requires |
| --- | --- | --- | --- |
<!-- search-apollo-companies-provider-row:start -->
| **Apollo** | `search_apollo_companies` | Firmographic company search: industry, headcount, location, keywords; richest company metadata | Apollo connected (server config) |
<!-- search-apollo-companies-provider-row:end -->
| **LinkedIn / Unipile** | `search_linkedin_companies` | Live LinkedIn company results; `has_job_offers`, geo/industry facets | Connected LinkedIn Unipile account |
| **Harvest** | People API (`dataSource: "harvest"`) | Company discovery *via people* — find companies where people match a role | Harvest configured |
<!-- search-exa-companies-provider-row:start -->
| **Exa** | `app_exa_web_search` (preloaded) or `exa_web_search` | Web/AI search for hard-to-find or new companies; `category: "company"` | `EXA_API_KEY` set |
<!-- search-exa-companies-provider-row:end -->
<!-- search-bright-data-companies-provider-row:start -->
| **Bright Data** | `search_bright_data_business` (`entity: "company"`) | Plain-language company sets ("apparel brands in India with more than 50 stores"), budgeted ludicrous mode by default ($0.002/record), not a pasted LinkedIn URL or a taxonomy filter | `BRIGHT_DATA_API_KEY` set |
<!-- search-bright-data-companies-provider-row:end -->
<!-- search-wikidata-companies-provider-row:start -->
| **Wikidata** | `search_wikidata_companies` | Enrich a known domain/URL with structured facts (HQ, industry, employees, CEO) | Public Wikidata API (no key) |
<!-- search-wikidata-companies-provider-row:end -->
<!-- search-companies-index-provider-row:start -->
| **Internal index** | `search_companies_index` | Free-text company search across ES indices | Elasticsearch index |
<!-- search-companies-index-provider-row:end -->
| **Raw → std name** | `resolve_company_from_raw_name` | Standardize a messy employer string to one best company profile (`std_company_data_scores`) | Elasticsearch (`ES_ENDPOINT`) |

### learn_tools (companies)

```
# Outreach (default)
learn_tools({
  "toolNames": [
<!-- search-apollo-companies-learn-tools-line:start -->
    "search_apollo_companies",
<!-- search-apollo-companies-learn-tools-line:end -->
    "search_linkedin_companies",
<!-- search-companies-index-learn-tools-line:start -->
    "search_companies_index",
    "resolve_company_from_raw_name",
<!-- search-companies-index-learn-tools-line:end -->
<!-- search-wikidata-companies-learn-tools-line:start -->
    "search_wikidata_companies",
<!-- search-wikidata-companies-learn-tools-line:end -->
<!-- search-exa-companies-learn-tools-line:start -->
    "exa_web_search",
<!-- search-exa-companies-learn-tools-line:end -->
<!-- search-bright-data-companies-learn-tools-line:start -->
    "search_bright_data_business",
<!-- search-bright-data-companies-learn-tools-line:end -->
    "search_linkedin_parameters",
    "generate_linkedin_query_set",
    "plan-local-business-city-coverage",
    "fetch-and-upsert-local-businesses",
    "upsert_outreach_target_companies"
  ]
})

# Save to CRM only, after the user asks
learn_tools({ "toolNames": ["save_outreach_targets_to_crm"] })
```

Dedup across sources **by normalized name + domain** before saving.

<!-- search-apollo-companies-source-section:start -->
### Source — Apollo (`search_apollo_companies`)

Best for firmographic company search. Available in the `prospecting` pack.

- Use when the user names Apollo, or Bright Data is unavailable or returned nothing.
- Pass a structured filter object (organization params) — do not invent Apollo field names; `learn_tools` returns the live schema.
- Common filters: `organization_num_employees` ranges, `organization_industries`, `q_organization_keywords`, `organization_locations`.
- Keep `page_size` / `limit` modest; paginate with the returned cursor if the user wants more.
- Returns company name, domain, employee count, industry, location, and often LinkedIn URL — map these to CRM fields.

```
search_apollo_companies({
  "q_organization_keywords": "fintech",
  "organization_num_employees": ["51", "200"],
  "organization_locations": ["Mumbai, India"],
  "page_size": 25
})
```

<!-- search-apollo-companies-source-section:end -->
### Source — LinkedIn / Unipile (`search_linkedin_companies`)

Live LinkedIn company results. Company facet examples are at the end of this section. Resolve facet ids with `search_linkedin_parameters` and never invent one. Keep a close title match ("Trident Group" → "Trident Group India"). Drop a clear mismatch ("Raymond Ltd" → "Raymond James") or an empty result, and omit that filter.

- `searchType`: `classic` or `sales_navigator`, and only if that value is listed in the LinkedIn status appended when this skill loads.
- Resolve geo/industry facet IDs with `search_linkedin_parameters` (`LOCATION`, `INDUSTRY`).
- Named Sales Nav account lists: `search_linkedin_parameters({ parameterType: "ACCOUNT_LISTS" })` → `search_linkedin_companies` with `account_lists.include`.
- **Pasted LinkedIn company search URL** (`/sales/search/company?...` or `/search/results/companies?...`): call `search_linkedin_companies({ "url": "<exact pasted URL>", "limit": 100 })`. Do not parse the URL or resolve facet IDs yourself: the tool turns a Sales Nav company URL (region, industry, headcount, keywords, include/exclude) into the structured Unipile payload `{ api: "sales_navigator", category: "companies", location, industry, headcount }` and falls back to Unipile's own URL search when the URL has filters it cannot express. `searchType`/`searchParameters` are not needed.
- **Fetch all results.** Use `limit: 100` (the page maximum). The first result reports `paging.total_count` and a `cursor`; repeat `search_linkedin_continue({ "cursor": "<cursor>", "limit": 100 })` until no `cursor` comes back or the list `total` reaches `total_count`. Every page lands in the same list. Do not stop after the first page when the user asked for all results, and say the total up front (for example "808 companies, 9 pages").
- Then call `outreach_list` `attach` once with the `projectId` (from browsing context, or the one the user named) to show them on the project's Companies tab. If the project already has companies, `attach` adds to them (duplicates are dropped). Report fetched, added and duplicate counts.

### Source — Harvest (company discovery via people)

Harvest has no standalone company search — discover companies *through people* when certain roles exist, or when no LinkedIn session is available.

- Use People API tools with `dataSource: "harvest"`; extract `companyName` from hits to build the company list. A role at those companies, once they are named, is `people-by-company`.

<!-- search-exa-companies-source-section:start -->
### Source — Exa (`app_exa_web_search` / `exa_web_search`)

Web/AI search for new, niche, or poorly-covered companies.

- Prefer `app_exa_web_search` when preloaded; otherwise `exa_web_search`.
- Requires `EXA_API_KEY` (tell the user if missing).
- `category`: `"company"`. Returns title/url/snippet only — extract **name** from title and **domain** from URL host.
- Exa results go to a list like every other provider (see **Result lists**); you only get a `listId` and counts.

```
app_exa_web_search({
  "query": "Series B fintech startups in Mumbai hiring engineers",
  "category": "company",
  "numResults": 15
})
```

<!-- search-exa-companies-source-section:end -->
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
<!-- search-wikidata-companies-source-section:start -->
### Source — Wikidata (`search_wikidata_companies`)

Structured enrichment from Wikidata (no API key). Best when you have a **domain** or need firmographic facts.

- Prefer `domain` lookup; optional `name` via `wbsearchentities`.
- Use to enrich Apollo/Exa/LinkedIn rows before save — not as a broad industry crawler.

```
search_wikidata_companies({ "domain": "clariant.com" })
```

<!-- search-wikidata-companies-source-section:end -->
### Outreach ephemeral save (default on /outreach-home)

Follow **Ephemeral write contract** (preamble). Steps:

1. Collect + dedupe rows (normalize name; compare on **domain host**).
2. Map to `{ name, domain, industry, employees, segment, icpFit, status: "new" }` — domain = URL host without protocol.
3. Search tools in **Result lists** return a `listId`: show the rows with `outreach_list` `attach`. For a tool that still returns rows, build `companies[]` and make one `execute_tool` upsert. Never upsert from the sandbox.
4. Tell the user the Companies tab count (UI refreshes within a few seconds).

### Save to CRM (only when the user asks)

1. Normalize and dedupe on **domain host** or normalized name.
2. `save_outreach_targets_to_crm` with `target: "companies"`. Omit ids to save the whole tab. This creates Company records and does not start outreach.

### Places on a map

Use this when the user wants outlets they can walk into (hotels, restaurants, clinics, stores, plumbers) across a city. A firmographic set ("apparel brands in India") skips this and starts at Bright Data. A raw employer string with no map step is only `resolve_company_from_raw_name`.

A single `search_local_businesses` call does not cover a city. Run the seeded workflow:

1. `plan-local-business-city-coverage` builds the lat/lng grid and the cost estimate (optional `sample: true`).
2. `fetch-and-upsert-local-businesses` discovers over that grid and upserts Companies. `projectId` and `maxRecords` are required. Confirm the estimate first (`estimatedMaxRecords`, about $0.0015 per record).
3. `resolve_company_from_raw_name` on each place or brand name, so "Wow! Momo" becomes the canonical company.
4. `search_bright_data_business` with `entity: "company"` on that canonical name for the firmographic profile Maps does not have.

Bright Data Google Maps PAYG is about $1.50 per 1,000 records. Budget on gross deliveries. Do not invent another city-grid tool, and do not promise full-city coverage from one Maps search.

### Company facet examples

**Classic companies**

```json
{
  "searchType": "classic",
  "searchParameters": {
    "api": "classic",
    "category": "companies",
    "has_job_offers": true,
    "location": ["102277331", "102448103"]
  },
  "limit": 10
}
```

**Named Sales Navigator account list:** `search_linkedin_parameters({ parameterType: "ACCOUNT_LISTS", limit: 100 })`, pick the `id` whose title matches, then `search_linkedin_companies` with `account_lists: { include: ["<id>"] }`.

**Pasted company search URL** (`/sales/search/company` or `/search/results/companies`): `search_linkedin_companies({ "url": "<exact pasted URL>", "limit": 100 })`. Do not parse the URL yourself.

**Natural-language company brief:** `generate_linkedin_query_set` once when the category is companies, then `validate_linkedin_query_set`, then pass the params to `search_linkedin_companies`.

### Companies constraints

- On Outreach Companies tab, a Find must write the tab before ending: `search_bright_data_business` with `projectId`, or `outreach_list` `attach`, or `upsert_outreach_target_companies`. Do not end on a chat-only list.
- Present results with name, domain, industry, location, size, and source so the user can judge quality.

---
