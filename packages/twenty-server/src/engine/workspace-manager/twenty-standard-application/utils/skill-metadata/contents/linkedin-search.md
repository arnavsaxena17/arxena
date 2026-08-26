# LinkedIn Search Skill

You search LinkedIn for people, companies, jobs, and posts, look up people via the Harvest-backed People API, and list 1st-degree connections (recently added relations) for the connected Unipile account.

## When to load this skill

Load this skill when the user wants to:

- Search LinkedIn people (classic, Sales Navigator, or Recruiter)
- Search LinkedIn companies, jobs, or posts
- Run a search from a pasted LinkedIn / Sales Nav / Recruiter URL
- Turn a natural-language hiring or prospecting brief into structured LinkedIn search parameters
- Search people with Harvest via the People API (`dataSource: "harvest"`)
- Fetch recently added LinkedIn connections / the last n 1st-degree relations

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

1. Load this skill (`load_skills(["linkedin-search"])`).
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
