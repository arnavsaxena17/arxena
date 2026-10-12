## People

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

On Outreach include `upsert_outreach_target_people` and **omit** `create_candidate` unless the user confirmed CRM save:

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

# Explicit CRM save only
learn_tools([
<!-- search-apollo-people-learn-tools-line:start -->
  "search_apollo_people",
<!-- search-apollo-people-learn-tools-line:end -->
  "search_linkedin_people",
  "create_candidate",
<!-- search-find-candidate-internal-learn-tools-line:start -->
  "find_candidate_in_arxena_internal"
<!-- search-find-candidate-internal-learn-tools-line:end -->
])
```

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

Live LinkedIn people. **Full facet workflow: LinkedIn / Harvest section below.**

- `searchType`: `classic`, `sales_navigator`, or `recruiter` — check **Connected Accounts** in the system prompt.
- Resolve facet IDs with `search_linkedin_parameters` before ID-based filters.
- Named Sales Nav lead lists: `search_linkedin_parameters({ parameterType: "LEAD_LISTS" })` → `search_linkedin_people` with `lead_lists.include`.
- `search_linkedin_from_url` for pasted LinkedIn / Sales Nav / Recruiter URLs.
- Recently added 1st-degree connections: `list_linkedin_relations` with `limit` = n.

### Source — Harvest (People API)

Taxonomy-backed people search without a LinkedIn session. **Full Harvest examples: LinkedIn / Harvest section below.**

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
### Role at named companies ("get the CEO of each filtered company", "founders of these")

A targeted company + position lookup. **No estimate, no budget question, no provider question**: use Bright Data and just do it. The user's short sentence is the whole request.

1. **Which companies.** "Filtered", "selected" or "these" means the rows shown on the project's Companies tab. Read them with `get_outreach_working_set` (companies, `onlyViewMatches: true`). If the view filter does not narrow the list but the user named a criterion (a city, "HQed in Mumbai", revenue), use the AI column that answers it (its summary and values are in the working set) and keep only the rows that satisfy it. Say in one line how many companies you took and which you left out and why. Ask a question only if no tab or column can tell you.
2. **One call per company, all in the same step** (the calls are independent and run in parallel on the server; never wait for one before sending the next): `search_bright_data_business({ entity: "people", query: "CEO or founder of <company or brand name> <country>", autoExecute: true, maxBudgetUsd: 0.02, targetCount: 1, projectId })`. Name the company (and the brand it trades under) and the country, never a city, and never a sector-wide query ("CEOs of restaurants in Mumbai" returns strangers). `autoExecute` plans and fetches in one call and writes the People tab with all fields. Total spend is about $0.02 per company.
3. **No match.** If a company returns 0, try once with its other name (brand, legal name, parent). If that is also 0, leave it out and list it as no match. Do not broaden the query.
4. **Check before you report.** Call `get_outreach_working_set` for the People tab. For each company, say whether the person works at that company (the company column matches) and holds a CEO, MD, founder, co-founder or owner title. Do not call a row a match when the company or title is wrong; list it under "does not belong" so the user can delete it.
5. **Report in one short table**: company, person, title, LinkedIn URL; then the no-match companies and the spend. Nothing else is needed from the user.

### Source — Bright Data (`search_bright_data_business`)

Plain-language people sets. Pass the user's sentence as `query`. Do not turn it into a taxonomy filter, and do not use this for a pasted LinkedIn URL. Requires `BRIGHT_DATA_API_KEY`; tell the user if it is missing.

`entity`: `"people"`. `mode`: always ludicrous (smart and instant are not used; any `mode` passed is ignored).

**Ludicrous is budgeted. Show the cost before fetching, except for a targeted lookup (see Role at named companies).** It bills **$0.002 per returned record**, capped at **$10 per query**. The server turns the request into several structured, non-overlapping queries (title synonyms, cities, size and funding buckets), then fetches slice by slice and drops slices whose results stop being relevant.

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

Boolean title strings ("(VP OR Head) AND Sales NOT assistant") are supported in the user's request for ludicrous: pass them as written in `query`. Do not strip the operators; they are compiled for the engine.

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

### CRM save (only when the user asks)

On Outreach this does **not** apply until the user confirms Add to CRM / Enroll after seeing the People tab.

1. Dedupe on **email** first, then **LinkedIn URL**, then normalized name + company.
2. Load `data-manipulation` + `code-interpreter`; resolve existing candidates:

```python
existing = arxena.lookup_by('candidates', 'email', [r['email'] for r in people_records if r.get('email')])
```

   Or use `find_candidate_in_arxena_internal` for a single lookup.
3. `create_candidate` for missing, update for present. Use **CRM UUID** — never provider ids.
4. Field map: first/last name → `name`, headline → `jobTitle`, company → resolve `companyId`, email → `email`, phone → `phone`, LinkedIn URL → `linkedinLink.primaryLinkUrl`.
5. **LinkedIn results** are in a list (see **Result lists**): use `outreach_list` `save_to_crm` for the CRM write; do not parse them yourself.
6. If asked for CSV + project: write `/home/user/output/` from the **same parsed rows**; attach to project via candidate link tools when needed.

### People constraints

- On Outreach People tab, `upsert_outreach_target_people` is mandatory before ending the turn; never `create_candidate` until confirm.
- Present results with name, title, company, location, and source; note when Recruiter results hide public identifiers.

---
