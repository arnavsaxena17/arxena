## Source: LinkedIn via Unipile

### Mode

The LinkedIn status appended when this skill loads lists the modes this user's account has. If LinkedIn is not connected, do not call `search_linkedin_*`.

`searchType` is optional on every LinkedIn tool. Omitted, the server uses the account's best seat (Sales Navigator, then Recruiter, then classic). A mode the account lacks comes back as an error naming the modes it has: tell the user and use one of those, or Harvest (`src-harvest`, paid). Pass `searchType` only to override the default:

| Request | `searchType` |
| --- | --- |
| Candidates for a role (`for-recruiting`) and the account has Recruiter | `recruiter` (skills, years of experience; results may hide public identifiers) |
| Prospects (`for-sales`), lead or account lists, function or seniority filters | `sales_navigator` |
| Neither seat | omit (classic: the user's network, fewer filters), or Harvest for Sales Navigator filters |

Companies: `sales_navigator` first (account lists, `annual_revenue`, `headcount_growth`), then `classic`. Both take `headcount: [{ min, max }]`. Recruiter has no company search; a Recruiter-only account uses `classic`.

### Limits

A LinkedIn search returns at most 1,000 results, so split a big request into slices (by location, industry or title band) that each stay under that. The account is rate-limited, though the calls are free. Read a long slice with one `search_linkedin_continue` call and `maxPages` (up to 50), then act on `autoContinue.stoppedBecause`:

| `stoppedBecause` | Next |
| --- | --- |
| `no_more_pages`, `empty_page` | The slice is exhausted |
| `page_limit`, `row_limit` | Call again with the returned `cursor` |
| `error` | A limit was hit: wait, then continue from the same `cursor` |

### Natural-language brief (people or companies)

Learn `generate_linkedin_query_set` and `search_linkedin_parameters` with the search tool.

1. `generate_linkedin_query_set({ rawRequirement, category })` once per brief. `category` is `people` (default) or `companies`; add `searchType` only to override the default. It returns `searchType` and `queries[]`, each with `searchParameters` already in that mode's shape and facet names resolved to ids.
2. For each query you run: `search_linkedin_people` (or `search_linkedin_companies`) with that `searchType` and `queries[i].searchParameters`, unchanged. Do not rebuild the payload or resolve facets yourself.
3. A query listing `unresolved` facets (`location`, `industry`, `company`) runs without them. Say so in the report. If `searchParametersError` comes back, report it; do not hand-build a payload.

### Other people searches (`search_linkedin_people`)

- **Named Sales Navigator lead list** (a name, no URL): `search_linkedin_parameters({ parameterType: "LEAD_LISTS", limit: 100 })`, pick the `id` whose title matches, then `search_linkedin_people` with `searchType: "sales_navigator"` and `lead_lists: { include: ["<id>"] }`.
- **Pasted people URL** (search, or `/sales/lists/people/{id}`): `search_linkedin_from_url({ url, limit: 25 })`, then `search_linkedin_continue` until the pages are done. Attach once.
- **Recently added connections:** `list_linkedin_relations` with the user's n as `limit`. Do not walk the whole network.

### Other company searches (`search_linkedin_companies`)

- **Named Sales Navigator account list:** `search_linkedin_parameters({ parameterType: "ACCOUNT_LISTS", limit: 100 })`, pick the matching `id`, then `search_linkedin_companies` with `searchType: "sales_navigator"` and `account_lists: { include: ["<id>"] }`.
- **Pasted company search URL** (`/sales/search/company?...` or `/search/results/companies?...`): `search_linkedin_companies({ "url": "<exact pasted URL>", "limit": 100 })`. No `searchType` or `searchParameters`, and do not parse the URL.
- **Fetch all results.** Use `limit: 100` (the page maximum). Repeat `search_linkedin_continue({ "cursor": "<cursor>", "limit": 100 })` until no `cursor` comes back or the list `total` reaches `paging.total_count`. Say the total up front ("808 companies, 9 pages") and do not stop after the first page when the user asked for all.
- Each page writes the Companies tab. Report fetched, added, duplicate and `ephemeralWritten` counts.

### Hand edits

Only when you add a filter the query set lacks. Resolve each facet id with `search_linkedin_parameters` (`LOCATION`, `INDUSTRY`, …) and never invent one; drop a clear mismatch ("Raymond Ltd" → "Raymond James") and omit that filter. Keep the shape of the `searchType` you send:

| `searchType` | Job title | Industry, location | Employer |
| --- | --- | --- | --- |
| `classic` | `advanced_keywords: { title }` | Flat arrays: `["6"]` | `company: ["<id>"]` |
| `sales_navigator` | `role: { include: [...] }`, never `job_title` | `{ include: ["60"] }` | `company: { include: ["<id>"] }` |
| `recruiter` | `role: [{ keywords }]`, with `priority` and `scope` | `industry: { include: ["4"] }`; `location: [{ id, priority, scope }]` | `company: [{ keywords }]`; `skills: [{ id, priority }]` |
