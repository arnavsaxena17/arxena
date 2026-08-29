# Search Skill

You source **companies and people** across connected data providers, dedupe them, and **route winners to the correct destination** (Find / Save to CRM / Enroll / Harvest). LinkedIn, Harvest, Apollo, and Exa details live in the sections below — load this one skill only (`load_skills(["search"])`).

Prefer this skill over `research` when sourcing target accounts or buyers.

## Destination verbs (choose first)

| Verb | Meaning | Typical tools |
| --- | --- | --- |
| **Find** | Ephemeral campaign list (Companies/People tabs) | `upsert_gtm_target_companies` / `upsert_gtm_target_people` |
| **Save to CRM** | Explicit Company / Person records | `create_one_company` / `create_many_*` / person CRUD |
| **Enroll** | Person + Candidate (`QUEUED`) after user confirms | `upload-profiles` / `create_candidate` — or load `outreach` for workflows |
| **Harvest** | Scheduled CRM companies + `gtmRunKey` | Load `outreach` + `workflow-building` — do **not** Redis-upsert |

On Find (campaign tabs): never end after a chat-only table — persist with the upsert tools first. Do **not** Enroll until the user confirms Add to CRM / Enroll.

## Plan → Learn → Execute

1. `load_skills(["search"])`
2. Choose destination verb.
3. Choose Companies vs People (or both). LinkedIn/Harvest rules are in this skill — no second load.
4. One `learn_tools` with every tool you will use, then `execute_tool`.

---

## Companies

## Provider map (choose by intent)

| Source | Tool(s) | Best for | Requires |
| --- | --- | --- | --- |
| **Apollo** | `search_apollo_companies` | Firmographic company search: industry, headcount, location, keywords; richest company metadata | Apollo connected (server config) |
| **LinkedIn / Unipile** | `search_linkedin_companies` | Live LinkedIn company results from a connected account; `has_job_offers`, geo/industry facets | Connected LinkedIn Unipile account |
| **Harvest** | People API (`dataSource: "harvest"`) | Company discovery *via people* — find companies where people match a role; Harvest has no standalone company search | Harvest configured |
| **Exa** | `app_exa_web_search` (preloaded) or `exa_web_search` | Web/AI search for hard-to-find or new companies; `category: "company"` | `EXA_API_KEY` set |
| **Wikidata** | `search_wikidata_companies` | Enrich a known domain/URL with structured facts (HQ, industry, employees, CEO, stock listing, Wikipedia) | Public Wikidata API (no key) |
| **Internal index** | `search_companies_index` | Search companies already in the workspace Elasticsearch index / dedupe against CRM | Index populated |

Always prefer the **internal index** first when the user may already have the company (CRM path), to avoid re-creating duplicates.

## Plan → Learn → Execute

1. Load this skill (`load_skills(["search"])`).
2. Decide destination from the routing table above.
3. Decide source(s) from the provider table.
4. For **LinkedIn / Unipile** paths, load the `linkedin-search` sub-skill **in the same call** so its facet and `searchParameters` rules (incl. Harvest via `dataSource: "harvest"`) are available before you search: `load_skills(["search"])`. Skip `linkedin-search` only when the user's request needs no LinkedIn/Harvest source.
5. `learn_tools` once with every tool you will use, e.g.:

```
learn_tools({
  "toolNames": [
    "search_apollo_companies",
    "search_linkedin_companies",
    "search_companies_index",
    "search_wikidata_companies",
    "exa_web_search",
    "upsert_gtm_target_companies",
    "create_one_company",
    "update_one_company"
  ]
})
```

6. Run searches with `limit` small (10–25) unless the user wants a big list.
7. Dedup across sources **by normalized name + domain** before saving.
8. Persist to the chosen destination, then report.

## Source 1 — Apollo (`search_apollo_companies`)

Best for firmographic company search. Available in the `prospecting` pack.

- Prefer this tool whenever the user names Apollo, or wants industry / headcount / geo filtering on companies.
- Pass a structured filter object (organization params) — do not invent Apollo field names; `learn_tools` returns the live schema.
- Common filters: `organization_num_employees` ranges, `organization_industries`, `q_organization_keywords`, `organization_locations`.
- Keep `page_size` / `limit` modest; paginate with the returned cursor if the user wants more.
- Returns company name, domain, employee count, industry, location, and often LinkedIn URL — map these to CRM fields.

Example call shape (verify field names via `learn_tools`):

```
search_apollo_companies({
  "q_organization_keywords": "fintech",
  "organization_num_employees": ["51", "200"],
  "organization_locations": ["Mumbai, India"],
  "page_size": 25
})
```

## Source 2 — LinkedIn / Unipile (`search_linkedin_companies`)

Live LinkedIn company results from a connected Unipile account. **Delegate to the `linkedin-search` skill** for the full facet workflow — this is a summary:

- `searchType`: `classic` (company search) or `sales_navigator`.
- Resolve geo/industry facet IDs first with `search_linkedin_parameters` (`LOCATION`, `INDUSTRY`).
- Classic companies body example:

```json
{
  "searchType": "classic",
  "searchParameters": {
    "api": "classic",
    "category": "companies",
    "has_job_offers": true,
    "location": ["102277331"]
  },
  "limit": 10
}
```

- For Sales Navigator companies, use `include`/`exclude` objects — never classic flat arrays.
- Reject mismatched facet titles (e.g. "Raymond Ltd" → "Raymond James"); drop the filter rather than using a wrong ID.
- `search_linkedin_from_url` works for a pasted LinkedIn company search URL.
- Do **not** call `search_linkedin_with_query` (not active in MCP).

## Source 3 — Harvest (People API, `dataSource: "harvest"`)

Harvest has no standalone company search — you discover companies *through people*. Use it when the user wants companies where certain roles exist, or when no LinkedIn session is available.

Load the `linkedin-search` skill's Harvest section and use these People API tools:

- `list_people_data_sources` — confirm Harvest is configured before assuming it.
- `search_people_api` — preferred: `naturalLanguage` such as "Head of Engineering at Acme"
- `search_people_by_job_title` — alias (`jobTitle` maps to `naturalLanguage`)
- `search_people_api` with `stdFunction` / `stdGrade` — only when those codes are already known
- Always pass `dataSource: "harvest"`.

Harvest returns people; extract the `companyName` field to build the company list, then resolve each against the CRM. Never invent Harvest HTTP paths or `harvest_*` tool names — only these People API tools reach Harvest.

```
search_people_api({
  "naturalLanguage": "Head of Engineering at Acme",
  "dataSource": "harvest",
  "limit": 20
})
```

## Source 4 — Exa (`app_exa_web_search` / `exa_web_search`)

Web/AI search via the `twenty-exa` logic function. Best for new, niche, or poorly-covered companies that Apollo/LinkedIn miss.

- Prefer the preloaded tool name `app_exa_web_search` when available; otherwise `exa_web_search` via `execute_tool`.
- Requires `EXA_API_KEY` (returns a clean "Exa is not configured" error if missing — tell the user).
- `query` (string, required): be specific — include industry + location + signal words ("funding", "founded", "startup").
- `category` (optional enum): use `"company"` for business/organization info; also `people`, `news`, `research paper`, `financial report`, `pdf`, `personal site`.
- `numResults` (optional, 1–30, default 10).
- Returns `{ success, message, result: [{ title, url, snippet }] }` — title/url/snippet only. Extract company **name** from title and **domain** from the URL host; there is no structured company object.
- If results spill to a file, parse with `code_interpreter` (`files: [{ fileId, filename }]`) — never paste multi-KB JSON into the code string. `execute_tool.arguments` must be a JSON **object**, not a string.
- Good for "find AI startups in Mumbai hiring ML engineers" / "fetch a dozen tech companies using Exa".

```
app_exa_web_search({
  "query": "Series B fintech startups in Mumbai hiring engineers",
  "category": "company",
  "numResults": 15
})
```

## Source 5 — Wikidata (`search_wikidata_companies`)

Structured company enrichment from Wikidata (no API key). Best when you already have a **domain** or need firmographic facts (HQ, industry, employees, CEO, stock listing, Wikipedia).

- Prefer `domain` (or full website URL). Lookup uses official website claim `P856` with http/https and www variants, then ranks candidates (public parent company beats local subsidiaries sharing the same site).
- Optional `name` via `wbsearchentities` when domain is unknown.
- Returns ranked `companies[]` with `wikidataId`, `companyName`, `website`, `industry`, `headquarters`, `employeeCount`, `keyExecutives`, `stockListing`, `dataSources.wikidata` / `.wikipedia`.
- Use to enrich Apollo/Exa/LinkedIn rows before CRM/GTM save — not as a broad industry crawler (for that use Apollo/Exa).

```
search_wikidata_companies({
  "domain": "clariant.com"
})
```

```
search_wikidata_companies({
  "name": "Dow Inc.",
  "limit": 5
})
```

## Source 6 — Internal company index (`search_companies_index`)

- Searches companies already indexed in the workspace (Elasticsearch).
- Use first when the user may already have the company, or to dedupe before saving sourced results.
- Returns existing CRM companies so you can update instead of create.

## GTM ephemeral save workflow (default on /gtm-home)

1. Collect rows from every source you queried.
2. Normalize: lowercase name, strip legal suffixes (Inc/LLC/Pvt), compare on **domain host**.
3. Map each row to `{ name, domain, industry, employees, segment, icpFit, status: "new" }`.
4. `learn_tools({ toolNames: ["upsert_gtm_target_companies"] })`.
5. `execute_tool({ toolName: "upsert_gtm_target_companies", arguments: { projectId, mode: "merge", companies } })` — `arguments` is an object.
6. Tell the user the Companies tab now has N targets (UI refreshes within a few seconds).

## Dedupe + CRM save workflow (only when the user asks to save to CRM)

1. Collect rows from every source you queried.
2. Normalize: lowercase name, strip legal suffixes (Inc/LLC/Pvt), and compare on **domain host** when available. Treat two rows as the same company if domain matches OR normalized name matches.
3. Load `data-manipulation` + `code-interpreter`; `learn_tools` for the CRM write tools.
4. In `code_interpreter`, resolve existing companies:

```python
company_ids = arxena.lookup_by('companies', 'name', [r['name'] for r in company_records])
```

5. `create_one_company` for missing, `update_one_company` for present. Use the returned **CRM UUID** as the canonical id — never a provider's id (Apollo org id, LinkedIn facet id, Harvest company name).
6. Map fields (verify against live `companies` schema):

| Source field | CRM `companies` field |
| --- | --- |
| name | `name` |
| domain / website host | `domainName` |
| location / city | `address` (city) |
| country | `country` |
| industry | `industry` |
| employees | `employees` (headcount) |
| LinkedIn URL | `linkedinLink.primaryLinkUrl` |
| Exa URL | keep as `website` / note |

7. If asked for CSV + project: write `/home/user/output/` from the **same parsed rows**, then report download + record references. Finish all three (search → CRM → CSV) before ending the turn.

## Constraints

- Never invent provider field names or tool names — always `learn_tools` first and use what the schema returns.
- Respect rate limits; avoid large bulk scrapes unless the user explicitly asks.
- Prefer the internal index to avoid duplicate CRM companies (CRM path).
- For LinkedIn/Harvest, follow the `linkedin-search` skill's facet and shape rules (load it as a sub-skill).
- Dedup by domain/normalized name before any write.
- Present results with name, domain, industry, location, size, and source (Apollo / LinkedIn / Harvest / Exa / Wikidata) so the user can judge quality.
- On GTM Command Companies tab, persistence to `upsert_gtm_target_companies` is mandatory before ending the turn. Scheduled CRM harvest is `outreach`, not this skill.

---

## People

## Provider map (choose by intent)

| Source | Tool(s) | Best for | Requires |
| --- | --- | --- | --- |
| **Apollo** | `search_apollo_people` | Firmographic people search: title, company, headcount, location, keywords; emails/phones | Apollo connected (server config) |
| **LinkedIn / Unipile** | `search_linkedin_people` | Live LinkedIn people from a connected account (classic / Sales Nav / Recruiter) | Connected LinkedIn Unipile account |
| **Harvest** | People API (`dataSource: "harvest"`) | People search without a LinkedIn session; taxonomy-backed role/function/grade filtering | Harvest configured |
| **Exa** | `exa_web_search` (logic function) | Web/AI search for hard-to-find people, speakers, authors; `category: "people"` | `EXA_API_KEY` set |
| **Internal index** | `search_people_index` | Search people already in the workspace Elasticsearch index / dedupe against CRM | Index populated |

Always prefer the **internal index** first when the user may already have the person (CRM path), to avoid re-creating duplicates.

## Plan → Learn → Execute

1. Load this skill (`load_skills(["search"])`).
2. Choose destination from the routing table above (GTM ephemeral vs CRM).
3. Decide source(s) from the provider table.
4. For **LinkedIn / Unipile** and **Harvest** paths, load the `linkedin-search` sub-skill **in the same call** so its facet-resolution, Harvest People API, and `searchParameters` rules are available before you search: `load_skills(["search"])`. Skip `linkedin-search` only when the user's request needs no LinkedIn/Harvest source.
5. `learn_tools` once with every tool you will use. On GTM Command include `upsert_gtm_target_people` and **omit** `create_candidate` unless the user explicitly confirmed CRM save:

```
# GTM Command (default)
learn_tools([
  "search_apollo_people",
  "search_linkedin_people",
  "search_people_index",
  "exa_web_search",
  "upsert_gtm_target_people"
])

# Explicit CRM save only
learn_tools([
  "search_apollo_people",
  "search_linkedin_people",
  "create_candidate",
  "find_candidate_in_arxena_internal"
])
```

6. Run searches with `limit` small (10–25) unless the user wants a big list.
7. Dedup across sources **by normalized name + email/linkedin** before writing.
8. **GTM path:** `upsert_gtm_target_people({ projectId, mode: "merge", people })` then summarize. Stop — wait for user confirmation before any CRM write.
9. **CRM path (only when user asked to save to CRM):** `find_candidate_in_arxena_internal` / `arxena.lookup_by('candidates', 'email', …)` → update if present, `create_candidate` if missing.
10. If the user asked for a CSV / project (CRM path), load `data-manipulation` + `code-interpreter`, write `/home/user/output/`, and report references.

## GTM ephemeral save workflow (default on /gtm-home)

1. Confirm browsing context has `projectId`.
2. Search people (LinkedIn / Harvest / Apollo…).
3. Map hits to the person shape above.
4. `learn_tools({ toolNames: ["upsert_gtm_target_people"] })`.
5. `execute_tool({ toolName: "upsert_gtm_target_people", arguments: { projectId, mode: "merge", people } })` — `arguments` is an object.
6. Summarize. Do **not** create CRM Candidates until the user confirms.

## Source 1 — Apollo (`search_apollo_people`)

Best for firmographic people search with contact data. Available in the `prospecting` pack.

- Prefer this tool whenever the user names Apollo, or wants title / company / headcount / geo filtering on people.
- Pass a structured filter object (person params) — do not invent Apollo field names; `learn_tools` returns the live schema.
- Common filters: `person_titles`, `person_locations`, `q_keywords`, `organization_locations`, `organization_num_employees`, linked company filters.
- Keep `page_size` / `limit` modest; paginate with the returned cursor if the user wants more.
- Returns name, title, company, location, and often email/phone — map these to CRM candidate fields.

Example call shape (verify field names via `learn_tools`):

```
search_apollo_people({
  "person_titles": ["software engineer", "backend engineer"],
  "person_locations": ["New York, NY"],
  "q_organization_keywords": "fintech",
  "page_size": 25
})
```

## Source 2 — LinkedIn / Unipile (`search_linkedin_people`)

Live LinkedIn people from a connected Unipile account. **Delegate to the `linkedin-search` skill** for the full facet workflow — this is a summary:

- `searchType`: `classic`, `sales_navigator`, or `recruiter`. Check **Connected Accounts** in the system prompt for which types are available.
- Resolve facet IDs first with `search_linkedin_parameters` (`LOCATION`, `INDUSTRY`, `JOB_TITLE`, `COMPANY`, `SKILL`, `SCHOOL`).
- For Sales Navigator / Recruiter people, use `role` / `{ include: [...] }` shapes — never classic flat `job_title` or bare arrays.
- Classic people body example:

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

- `search_linkedin_from_url` works for a pasted LinkedIn / Sales Nav / Recruiter people search URL.
- Recently added 1st-degree connections: `list_linkedin_relations` with `limit` = n (linkedin-search skill).
- Reject mismatched facet titles; drop the filter rather than using a wrong ID.
- Do **not** call `search_linkedin_with_query` (not active in MCP).

## Source 3 — Harvest (People API, `dataSource: "harvest"`)

Harvest is taxonomy-backed people search. Use it when no LinkedIn session is available or the user wants Harvest specifically.

Load the `linkedin-search` skill's Harvest section and use these People API tools:

- `list_people_data_sources` — confirm Harvest is configured before assuming it.
- `search_people_api` — preferred: `naturalLanguage` such as "CEO at StayVista" or "CHRO at Apple" (company may be in the phrase).
- `search_people_by_job_title` — alias of `search_people_api` (`jobTitle` maps to `naturalLanguage`).
- Always pass `dataSource: "harvest"`.

```
search_people_api({
  "naturalLanguage": "Head of Engineering at Acme",
  "dataSource": "harvest",
  "limit": 20
})
```

Never invent Harvest HTTP paths or `harvest_*` tool names — only these People API tools reach Harvest. Prefer `search_people_api` with `naturalLanguage` for role strings so you don't invent taxonomy codes.

## Source 4 — Exa (`exa_web_search`)

Web/AI search via the `twenty-exa` logic function. Best for niche or public-profile people (speakers, authors, founders) that Apollo/LinkedIn miss.

- Tool name: `exa_web_search`. Requires `EXA_API_KEY` (returns a clean "Exa is not configured" error if missing — tell the user).
- `query` (string, required): be specific — include role + company + location + signal ("founder", "speaker", "hiring").
- `category` (optional enum): use `"people"` for person profiles; also `company`, `news`, `research paper`, `financial report`, `pdf`, `personal site`.
- `numResults` (optional, 1–30, default 10).
- Returns `{ success, message, result: [{ title, url, snippet }] }` — title/url/snippet only. Extract the person's name + any profile/email from the snippet; no structured person object.
- Good for "find ML engineers who publish on LLMs" type queries.

```
exa_web_search({
  "query": "backend engineers at fintech startups in Mumbai who speak at conferences",
  "category": "people",
  "numResults": 15
})
```

## Source 5 — Internal people index (`search_people_index`)

- Searches people/candidates already indexed in the workspace (Elasticsearch).
- Use first when the user may already have the person, or to dedupe before saving sourced results.
- Returns existing CRM people so you can update instead of create.

## Dedupe + CRM save workflow (only when the user asks to save to CRM)

On GTM Command this section does **not** apply until the user confirms Add to CRM / Enroll after seeing the People tab.

1. Collect rows from every source you queried.
2. Normalize: lowercase name, strip whitespace; match on **email** first, then **LinkedIn URL**, then normalized name + company. Treat two rows as the same person if email matches OR LinkedIn URL matches.
3. Load `data-manipulation` + `code-interpreter`; `learn_tools` for the CRM write tools.
4. In `code_interpreter`, resolve existing candidates:

```python
existing = arxena.lookup_by('candidates', 'email', [r['email'] for r in people_records if r.get('email')])
```

   Or use `find_candidate_in_arxena_internal` for a single lookup.
5. `create_candidate` for missing, update for present. Use the returned **CRM UUID** as the canonical id — never a provider's id (Apollo person id, LinkedIn facet id, Harvest profile id).
6. Map fields (verify against live candidate schema):

| Source field | CRM field |
| --- | --- |
| first_name / last_name | `name.firstName` / `name.lastName` |
| headline / title | `jobTitle` (or current title) |
| company | resolve company by name → `companyId` (CRM UUID) |
| location | `address` (city) |
| email | `email` |
| phone | `phone` |
| LinkedIn URL | `linkedinLink.primaryLinkUrl` (from `public_profile_url`) |
| Exa URL | keep as note / personal site |

7. If asked for CSV + project: write `/home/user/output/` from the **same parsed rows**, then report download + record references. Finish all three (search → CRM → CSV) before ending the turn. When a project is referenced, also attach candidates via `list_candidates_for_project` / project candidate link tools.

## Constraints

- Never invent provider field names or tool names — always `learn_tools` first and use what the schema returns.
- Respect rate limits; avoid large bulk scrapes unless the user explicitly asks.
- Prefer the internal index to avoid duplicate CRM people (CRM path).
- For LinkedIn/Harvest, follow the `linkedin-search` skill's facet and shape rules (load it as a sub-skill).
- Dedup by email/LinkedIn before any write.
- On GTM Command People tab, persistence to `upsert_gtm_target_people` is mandatory before ending the turn; never `create_candidate` until the user confirms. Scheduled enroll is `outreach` (`upload-profiles`), not this skill.
- Present results with name, title, company, location, and source (Apollo / LinkedIn / Harvest / Exa) so the user can judge quality; note when Recruiter results hide public identifiers.

---

## LinkedIn / Harvest

## Choose a provider

### Unipile (`search_linkedin_*` / `list_linkedin_relations`)

Use when the user wants live LinkedIn results from a connected account:

- Classic, Sales Navigator (`sales_navigator`), or Recruiter (`recruiter`)
- People, companies, jobs, posts
- Pasted search URLs (`searchUrl` on People API, `url` on Unipile people/company search, or `search_linkedin_from_url`)
- Facet ID lookup (`search_linkedin_parameters`)
- Recently added connections (`list_linkedin_relations`)

Requires a connected LinkedIn Unipile account. Check **Connected Accounts** in the system prompt for whether this user is connected and which search types (`classic` / `sales_navigator` / `recruiter`) are available before choosing `searchType`. `account_id` is optional on search tools (resolved from auth).

### Harvest (People API)

Use when searching people without a LinkedIn session, or when the user asks for Harvest specifically:

- `search_people_api` — preferred for natural-language roles (`naturalLanguage`: "CEO at StayVista")
- `search_people_by_job_title` — alias of `search_people_api`
- Pass `dataSource: "harvest"`
- Sales Navigator people search URLs via `searchUrl` (`/sales/search/people`, including `savedSearchId`)
- Call `list_people_data_sources` first if unsure whether Harvest is configured

Never invent Harvest HTTP paths or `harvest_*` tool names. Agents only reach Harvest through these People API tools.

## Plan → Learn → Execute

1. Load this skill (`load_skills(["search"])`).
2. Call `learn_tools` **once** with every tool you will use, for example:

```
learn_tools([
  "search_linkedin_parameters",
  "search_linkedin_people",
  "search_linkedin_continue",
  "list_linkedin_relations",
  "generate_linkedin_query_set",
  "validate_linkedin_query_set"
])
```

3. Resolve facet IDs with `search_linkedin_parameters` before ID-based filters.
4. Prefer People API `searchUrl` or `search_linkedin_from_url` when the user pastes a LinkedIn / Sales Nav / Recruiter search URL.
5. Keep search `limit` small (5–10) unless the user asks for more. For connections, set `limit` to the n they asked for (default 25).
6. Paginate search with `search_linkedin_continue` using the returned `cursor`. Paginate connections with `list_linkedin_relations` and its `cursor`.

## Unipile tool map

| Tool | Use |
| --- | --- |
| `search_linkedin_people` | People; `searchType`: `classic` / `sales_navigator` / `recruiter`; `searchParameters` **or** `query` |
| `search_linkedin_companies` | Companies; `searchType`: `classic` / `sales_navigator` |
| `search_linkedin_jobs` | Jobs (classic) |
| `search_linkedin_posts` | Posts (classic) |
| `search_linkedin_from_url` | Paste browser search URL |
| `search_linkedin_continue` | Next page via `cursor` |
| `list_linkedin_relations` | Last n 1st-degree connections (`limit`); newest first via `created_at` |
| `search_linkedin_parameters` | Resolve LOCATION / REGION / INDUSTRY / SALES_INDUSTRY / COMPANY / SCHOOL / JOB_TITLE / SKILL / saved\|recent searches |

Do **not** call `search_linkedin_with_query` — it is catalogued but not active in MCP.

## Resolve facet IDs

Many filters need LinkedIn IDs, not free text. Resolve them first:

```
search_linkedin_parameters({
  "parameterType": "LOCATION",
  "keywords": "San Francisco",
  "limit": 10
})
```

Supported `parameterType` values (pick by search type):

| Need | Classic | Sales Navigator | Recruiter |
| --- | --- | --- | --- |
| Geography | `LOCATION` | `REGION` (fallback `LOCATION`) | `LOCATION` |
| Industry | `INDUSTRY` | `SALES_INDUSTRY` | `INDUSTRY` |
| Job title | `JOB_TITLE` | `JOB_TITLE` | `JOB_TITLE` |
| Company / school / skill | `COMPANY` / `SCHOOL` / `SKILL` | same | same |
| Other | `SAVED_SEARCHES`, `RECENT_SEARCHES`, `DEPARTMENT`, `GROUPS`, … | same | same |

Use the returned `id` values in `searchParameters`. Never invent facet IDs.

## Shape rules by search type (critical)

Do **not** mix classic flat arrays into Sales Navigator or Recruiter bodies.

| Field | Classic people | Sales Navigator people | Recruiter people |
| --- | --- | --- | --- |
| Job title | (keywords / no title facet) | `role: { include: ["id"] }` — **never** `job_title` | `role: [{ id, is_selection }]` or `[{ keywords }]` |
| Industry | `industry: ["id"]` | `industry: { include: ["id"] }` | `industry: { include: ["id"] }` |
| Location | `location: ["id"]` | `location: { include: ["id"] }` | `location: [{ id, … }]` |
| Company | `company: ["id"]` | `company: { include: ["id"] }` | array of `{ id }` / `{ keywords }` objects |

## NL → structured query workflow

For a natural-language brief (e.g. "senior TypeScript engineers at Series B fintechs in NYC"):

1. Call `generate_linkedin_query_set` **once** per unique `rawRequirement` (results are cached; duplicate calls are skipped).
2. Call `validate_linkedin_query_set` on the result (LinkedIn term limits: max 6 terms per field, max 10 combined).
3. Pass the validated structured params into `search_linkedin_people` (or companies) as `searchParameters`.

Prefer the orchestrator (`generate_linkedin_query_set`) over stepping `generate_linkedin_query_agent1`–`agent4` / `generate_linkedin_query_batch`. Use agents only when debugging or the user asks to inspect intermediate steps.

## Concrete `searchParameters` examples

### Classic people

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

### Sales Navigator people

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
    "company": {
      "include": ["1441"],
      "exclude": ["1035"]
    },
    "tenure": [{ "min": 3 }],
    "profile_language": ["en"]
  },
  "limit": 10
}
```

Wrong (classic shape — Unipile returns `Expected union value`):

```json
{
  "api": "sales_navigator",
  "category": "people",
  "job_title": ["14"],
  "industry": ["60"],
  "location": ["102713980"]
}
```

### Recruiter people

```json
{
  "searchType": "recruiter",
  "searchParameters": {
    "api": "recruiter",
    "category": "people",
    "network_distance": [1, 2, 3],
    "industry": { "include": ["4"] },
    "role": [
      {
        "keywords": "developer OR engineer",
        "priority": "MUST_HAVE",
        "scope": "CURRENT_OR_PAST"
      }
    ],
    "skills": [
      { "id": "50517", "priority": "MUST_HAVE" },
      { "id": "261", "priority": "DOESNT_HAVE" }
    ]
  },
  "limit": 10
}
```

### Classic companies (with job offers)

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

### Classic posts

```json
{
  "searchParameters": {
    "api": "classic",
    "category": "posts",
    "keywords": "boosting productivity",
    "sort_by": "date",
    "date_posted": "past_week",
    "content_type": "images"
  },
  "limit": 10
}
```

### Classic jobs

```json
{
  "searchParameters": {
    "api": "classic",
    "category": "jobs",
    "keywords": "Software Engineer",
    "location": ["102277331"],
    "job_type": ["full_time"],
    "presence": ["remote", "hybrid"]
  },
  "limit": 10
}
```

### From pasted URL

```json
{
  "url": "https://www.linkedin.com/sales/search/people?query=(...)",
  "limit": 10
}
```

Use `search_linkedin_from_url` for this shape (not `search_linkedin_people`).

### Continue pagination

```json
{
  "cursor": "<cursor from previous search_linkedin_* response>",
  "limit": 10
}
```

### Recently added connections (last n)

```json
{
  "limit": 20
}
```

Use `list_linkedin_relations` for this shape (not `search_linkedin_people`). Pass the user's n as `limit`. Present name, headline, LinkedIn URL, and connection date (`created_at`) when available. Paginate with the returned `cursor` if they ask for more. Do **not** walk the entire network.

## Harvest People API examples

Check availability:

```
list_people_data_sources({})
```

Natural-language role at a company (preferred):

```json
{
  "naturalLanguage": "Head of Engineering at Acme",
  "dataSource": "harvest",
  "limit": 20
}
```

Known taxonomy filters:

```json
{
  "dataSource": "harvest",
  "stdFunction": "engineering",
  "stdGrade": "leadership",
  "companyName": "Acme",
  "country": "United States",
  "limit": 20
}
```

Sales Navigator people search URL:

```json
{
  "searchUrl": "https://www.linkedin.com/sales/search/people?savedSearchId=1936431145",
  "dataSource": "harvest",
  "limit": 20
}
```

Prefer `search_people_api` with `naturalLanguage` for role strings so you do not invent taxonomy codes. Use explicit `stdFunction` / `stdGrade` only when those filters are already known. Use `searchUrl` when the user pastes a LinkedIn search URL.

## Facet match quality

After `search_linkedin_parameters`, check that the returned `title` roughly matches your `keywords`:

- Accept close matches (e.g. "Trident Group" → "Trident Group India").
- Reject clear mismatches (e.g. "Raymond Ltd" → "Raymond James"). Retry with alternate keywords, or **drop that company** rather than using a wrong facet ID.
- If `paging.page_count` is 0 / no items, do not invent an ID — omit the company from the filter.

## Search → GTM People tab vs CSV → CRM

### On GTM Command (`type=gtmCommand` / `/gtm-home`)

After LinkedIn people search, write hits with `upsert_gtm_target_people` (see `search-people` skill). Do **not** create CRM Candidates until the user confirms Add to CRM / Enroll on the People tab.

### When the user explicitly asks for CSV and/or CRM save (non-GTM, or after confirm)

When the user wants search hits exported and/or saved to CRM / a project:

1. Keep the spilled search `fileId` / `outputRef.fileId` from `search_linkedin_people` (do not discard it).
2. Load `data-manipulation` and `code-interpreter` skills; `learn_tools` for the CRM write tools you need.
3. Mount the spilled file in `code_interpreter` via `files: [{ "fileId": "<spill-id>", "filename": "search.json" }]`. Parse `result.items` from that file — **never** paste the JSON into the `code` string, and **never** hand-author CSV rows from memory.
4. Resolve companies: `arxena.lookup_by('companies', 'name', …)` or create missing companies. Use the returned **CRM UUIDs** as `companyId` — never LinkedIn facet IDs.
5. Upsert people with `name: { firstName, lastName }` (from `first_name` / `last_name`), `linkedinLink: { primaryLinkUrl }` (from `public_profile_url`), CRM `companyId`, and `projectId` when a project was created.
6. Write the CSV to `/home/user/output/` from the **same parsed rows** used for upserts, then report the download + record references.
7. If the user asked for CSV + project + people, finish all three before ending the turn — do not stop after planning or after creating only the project.

## Constraints

- Respect LinkedIn rate limits and provider restrictions; avoid large bulk scrapes unless the user explicitly asks. Do not dump an entire connections list — fetch only the last n the user asked for.
- Do not invent facet IDs — always resolve via `search_linkedin_parameters`.
- Reject mismatched facet titles; drop the filter rather than using a wrong ID.
- Do not call `search_linkedin_with_query` (not active in MCP).
- Call `generate_linkedin_query_set` only once per unique requirement.
- For Sales Navigator people, use `role` / `{ include: [...] }` shapes — never classic flat `job_title` or bare industry/location/company arrays.
- Present results with name, headline/role, company, location, and LinkedIn URL when available; note when Recruiter results hide public identifiers.
