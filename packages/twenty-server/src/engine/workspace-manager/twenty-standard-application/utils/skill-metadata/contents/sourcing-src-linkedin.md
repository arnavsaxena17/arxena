## Source: LinkedIn via Unipile

### Limits and exhaustion

A LinkedIn search returns at most 1,000 results, so split a big request into slices (by location, industry or title band) that each stay under that. The account is rate-limited, though the calls are free: use them with care. Read a long slice with one `search_linkedin_continue` call and `maxPages` (up to 50). Its `autoContinue.stoppedBecause` says what to do next: `no_more_pages` or `empty_page` means the slice is exhausted; `page_limit` or `row_limit` means call again with the returned `cursor`; `error` means a limit was hit, so wait and continue from the same `cursor`.

### Source — LinkedIn / Unipile (`search_linkedin_people`)

Live LinkedIn people. Facet examples are at the end of this section. Resolve facet ids with `search_linkedin_parameters` and never invent one. Keep a close title match ("Trident Group" → "Trident Group India"). Drop a clear mismatch ("Raymond Ltd" → "Raymond James") or an empty result, and omit that filter.

- `searchType`: `classic`, `sales_navigator`, or `recruiter` — only values listed in the LinkedIn status appended when this skill loads. If Sales Navigator or Recruiter is not listed, say so and use `classic` or Harvest (`dataSource: "harvest"`). If LinkedIn is not connected, do not call `search_linkedin_*`.
- Named Sales Nav lead lists: `search_linkedin_parameters({ parameterType: "LEAD_LISTS" })` → `search_linkedin_people` with `lead_lists.include`.
- `search_linkedin_from_url` for pasted LinkedIn / Sales Nav / Recruiter people URLs.
- Recently added 1st-degree connections: `list_linkedin_relations` with `limit` = n.

### Source — LinkedIn / Unipile (`search_linkedin_companies`)

Live LinkedIn company results. Company facet examples are at the end of this section. Resolve facet ids with `search_linkedin_parameters` and never invent one. Keep a close title match ("Trident Group" → "Trident Group India"). Drop a clear mismatch ("Raymond Ltd" → "Raymond James") or an empty result, and omit that filter.

- `searchType`: `classic` or `sales_navigator`, and only if that value is listed in the LinkedIn status appended when this skill loads.
- Resolve geo/industry facet IDs with `search_linkedin_parameters` (`LOCATION`, `INDUSTRY`).
- Named Sales Nav account lists: `search_linkedin_parameters({ parameterType: "ACCOUNT_LISTS" })` → `search_linkedin_companies` with `account_lists.include`.
- **Pasted LinkedIn company search URL** (`/sales/search/company?...` or `/search/results/companies?...`): call `search_linkedin_companies({ "url": "<exact pasted URL>", "limit": 100 })`. Do not parse the URL or resolve facet IDs yourself: the tool turns a Sales Nav company URL (region, industry, headcount, keywords, include/exclude) into the structured Unipile payload `{ api: "sales_navigator", category: "companies", location, industry, headcount }` and falls back to Unipile's own URL search when the URL has filters it cannot express. `searchType`/`searchParameters` are not needed.
- **Fetch all results.** Use `limit: 100` (the page maximum). The first result reports `paging.total_count` and a `cursor`; repeat `search_linkedin_continue({ "cursor": "<cursor>", "limit": 100 })` until no `cursor` comes back or the list `total` reaches `total_count`. Every page lands in the same list. Do not stop after the first page when the user asked for all results, and say the total up front (for example "808 companies, 9 pages").
- Then call `outreach_list` `attach` once with the `projectId` (from browsing context, or the one the user named) to show them on the project's Companies tab. If the project already has companies, `attach` adds to them (duplicates are dropped). Report fetched, added and duplicate counts.

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
