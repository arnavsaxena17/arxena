## LinkedIn / Harvest

Use this section for LinkedIn / Unipile and Harvest People API paths (referenced from **Companies** and **People** above).

### Choose a provider

**Unipile** (`search_linkedin_*` / `list_linkedin_relations`) — live LinkedIn results from a connected account:

- Classic, Sales Navigator (`sales_navigator`), or Recruiter (`recruiter`)
- People, companies, jobs, posts
- Pasted search URLs (`searchUrl` on People API, `url` on Unipile search, or `search_linkedin_from_url`)
- Facet ID lookup (`search_linkedin_parameters`)
- Recently added connections (`list_linkedin_relations`)

Requires a connected LinkedIn Unipile account. Check **Connected Accounts** in the system prompt for available `searchType` values. `account_id` is optional (resolved from auth).

**Harvest** (People API) — people search without a LinkedIn session:

- `search_people_api` — preferred: `naturalLanguage` ("CEO at StayVista")
- `search_people_by_job_title` — alias of `search_people_api`
- Pass `dataSource: "harvest"`; Sales Nav URLs via `searchUrl`
- Call `list_people_data_sources` first if unsure Harvest is configured

Never invent Harvest HTTP paths or `harvest_*` tool names.

### learn_tools (LinkedIn / Harvest)

```
learn_tools([
  "search_linkedin_parameters",
  "search_linkedin_people",
  "search_linkedin_companies",
  "search_linkedin_continue",
  "list_linkedin_relations",
  "search_people_api",
  "list_people_data_sources",
  "generate_linkedin_query_set",
  "validate_linkedin_query_set"
])
```

Resolve facet IDs with `search_linkedin_parameters` before ID-based filters. Paginate with `search_linkedin_continue` (`cursor`) or `list_linkedin_relations` (`cursor`).

### Unipile tool map

| Tool | Use |
| --- | --- |
| `search_linkedin_people` | People; `searchType`: `classic` / `sales_navigator` / `recruiter` |
| `search_linkedin_companies` | Companies; `searchType`: `classic` / `sales_navigator` |
| `search_linkedin_jobs` | Jobs (classic) |
| `search_linkedin_posts` | Posts (classic) |
| `search_linkedin_from_url` | Paste browser search URL |
| `search_linkedin_continue` | Next page via `cursor` |
| `list_linkedin_relations` | Last n 1st-degree connections (`limit`); newest first via `created_at` |
| `search_linkedin_parameters` | Resolve LOCATION / REGION / INDUSTRY / SALES_INDUSTRY / COMPANY / SCHOOL / JOB_TITLE / SKILL / saved\|recent searches |

Do **not** call `search_linkedin_with_query` — catalogued but not active in MCP.

### Resolve facet IDs

```
search_linkedin_parameters({
  "parameterType": "LOCATION",
  "keywords": "San Francisco",
  "limit": 10
})
```

| Need | Classic | Sales Navigator | Recruiter |
| --- | --- | --- | --- |
| Geography | `LOCATION` | `REGION` (fallback `LOCATION`) | `LOCATION` |
| Industry | `INDUSTRY` | `SALES_INDUSTRY` | `INDUSTRY` |
| Job title | `JOB_TITLE` | `JOB_TITLE` | `JOB_TITLE` |
| Company / school / skill | `COMPANY` / `SCHOOL` / `SKILL` | same | same |

Use returned `id` values in `searchParameters`. Never invent facet IDs.

### Shape rules by search type (critical)

Do **not** mix classic flat arrays into Sales Navigator or Recruiter bodies.

| Field | Classic people | Sales Navigator people | Recruiter people |
| --- | --- | --- | --- |
| Job title | (keywords / no title facet) | `role: { include: ["id"] }` — **never** `job_title` | `role: [{ id, is_selection }]` or `[{ keywords }]` |
| Industry | `industry: ["id"]` | `industry: { include: ["id"] }` | `industry: { include: ["id"] }` |
| Location | `location: ["id"]` | `location: { include: ["id"] }` | `location: [{ id, … }]` |
| Company | `company: ["id"]` | `company: { include: ["id"] }` | array of `{ id }` / `{ keywords }` objects |

For Sales Navigator companies, use `include`/`exclude` objects — never classic flat arrays.

### NL → structured query workflow

For a natural-language brief (e.g. "senior TypeScript engineers at Series B fintechs in NYC"):

1. Call `generate_linkedin_query_set` **once** per unique `rawRequirement` (cached; duplicates skipped).
2. Call `validate_linkedin_query_set` (LinkedIn term limits: max 6 terms per field, max 10 combined).
3. Pass validated params into `search_linkedin_people` or `search_linkedin_companies` as `searchParameters`.

Prefer the orchestrator over stepping `generate_linkedin_query_agent1`–`agent4` manually.

### Concrete `searchParameters` examples

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

**Sales Navigator people**

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
    "company": { "include": ["1441"], "exclude": ["1035"] },
    "tenure": [{ "min": 3 }],
    "profile_language": ["en"]
  },
  "limit": 10
}
```

Wrong (classic shape — Unipile returns `Expected union value`): flat `job_title`, `industry`, `location` arrays on Sales Nav.

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

**Classic companies (with job offers)**

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

**From pasted URL** — use `search_linkedin_from_url` (not `search_linkedin_people`):

```json
{ "url": "https://www.linkedin.com/sales/search/people?query=(...)", "limit": 10 }
```

**Continue pagination**

```json
{ "cursor": "<cursor from previous search_linkedin_* response>", "limit": 10 }
```

**Recently added connections** — use `list_linkedin_relations` (not `search_linkedin_people`):

```json
{ "limit": 20 }
```

Pass the user's n as `limit`. Do **not** walk the entire network.

### Harvest People API examples

```
list_people_data_sources({})
```

Natural-language role (preferred):

```json
{
  "naturalLanguage": "Head of Engineering at Acme",
  "dataSource": "harvest",
  "limit": 20
}
```

Known taxonomy filters (only when codes are already known):

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

For company discovery via Harvest: extract `companyName` from people hits, then resolve against CRM.

### Facet match quality

After `search_linkedin_parameters`, check that returned `title` roughly matches `keywords`:

- Accept close matches (e.g. "Trident Group" → "Trident Group India").
- Reject clear mismatches (e.g. "Raymond Ltd" → "Raymond James") — drop the filter rather than using a wrong ID.
- If `paging.page_count` is 0 / no items, omit the filter — do not invent an ID.

### LinkedIn / Harvest constraints

- Respect LinkedIn rate limits; fetch only the last n connections the user asked for.
- Do not invent facet IDs — always resolve via `search_linkedin_parameters`.
- Call `generate_linkedin_query_set` only once per unique requirement.
- For Sales Navigator people, use `role` / `{ include: [...] }` — never classic flat `job_title` or bare arrays.
- On Outreach after people search: `upsert_outreach_target_people` (see **People** section) — do not enroll until user confirms.
