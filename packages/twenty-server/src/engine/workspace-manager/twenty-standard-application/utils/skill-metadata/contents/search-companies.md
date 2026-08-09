# Search Companies Skill

You source companies for the user across Arxena's connected data providers, dedupe them, and save the winners to the CRM (`companies` object). This skill picks the right source(s) for the user's intent and gives the exact tools and shapes to call.

## When to load this skill

Load this skill when the user wants to:

- "Find companies that…" / "List companies in <industry/country/size>"
- Build a target-account list for outreach, a project, or an ICP
- Enrich existing CRM companies, or discover new accounts to add
- Search companies by properties: industry, location, size (employees/revenue), tech stack, funding
- Turn a natural-language brief ("Series B fintechs in Mumbai with 50–200 staff") into a company list

## Provider map (choose by intent)

| Source | Tool(s) | Best for | Requires |
| --- | --- | --- | --- |
| **Apollo** | `search_apollo_companies` | Firmographic company search: industry, headcount, location, keywords; richest company metadata | Apollo connected (server config) |
| **LinkedIn / Unipile** | `search_linkedin_companies` | Live LinkedIn company results from a connected account; `has_job_offers`, geo/industry facets | Connected LinkedIn Unipile account |
| **Harvest** | People API (`dataSource: "harvest"`) | Company discovery *via people* — find companies where people match a role; Harvest has no standalone company search | Harvest configured |
| **Exa** | `exa_web_search` (logic function) | Web/AI search for hard-to-find or new companies; `category: "company"` | `EXA_API_KEY` set |
| **Internal index** | `search_companies_index` | Search companies already in the workspace Elasticsearch index / dedupe against CRM | Index populated |

Always prefer the **internal index** first when the user may already have the company, to avoid re-creating duplicates.

## Plan → Learn → Execute

1. Load this skill (`load_skills(["search-companies"])`).
2. Decide source(s) from the table above.
3. For **LinkedIn / Unipile** paths, load the `linkedin-search` sub-skill **in the same call** so its facet and `searchParameters` rules (incl. Harvest via `dataSource: "harvest"`) are available before you search: `load_skills(["search-companies", "linkedin-search"])`. Skip `linkedin-search` only when the user's request needs no LinkedIn/Harvest source.
4. `learn_tools` once with every tool you will use, e.g.:

```
learn_tools([
  "search_apollo_companies",
  "search_linkedin_companies",
  "search_companies_index",
  "exa_web_search",
  "create_one_company",
  "update_one_company"
])
```

5. Run searches with `limit` small (10–25) unless the user wants a big list.
6. Dedup across sources **by normalized name + domain** before saving.
7. Save: `arxena.lookup_by('companies', 'name', …)` → update if present, `create_one_company` if missing.
8. If the user asked for a CSV / project, load `data-manipulation` + `code-interpreter`, write `/home/user/output/`, and report references.

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
- `search_people_by_job_title` — preferred for natural-language roles at a company.
- `search_people_api` — when `stdFunction` / `stdGrade` / `companyName` filters are known.
- Always pass `dataSource: "harvest"`.

Harvest returns people; extract the `companyName` field to build the company list, then resolve each against the CRM. Never invent Harvest HTTP paths or `harvest_*` tool names — only these People API tools reach Harvest.

```
search_people_by_job_title({
  "jobTitle": "Head of Engineering",
  "companyName": "Acme",
  "dataSource": "harvest",
  "limit": 20
})
```

## Source 4 — Exa (`exa_web_search`)

Web/AI search via the `twenty-exa` logic function. Best for new, niche, or poorly-covered companies that Apollo/LinkedIn miss.

- Tool name: `exa_web_search`. Requires `EXA_API_KEY` (returns a clean "Exa is not configured" error if missing — tell the user).
- `query` (string, required): be specific — include industry + location + signal words ("funding", "founded", "startup").
- `category` (optional enum): use `"company"` for business/organization info; also `people`, `news`, `research paper`, `financial report`, `pdf`, `personal site`.
- `numResults` (optional, 1–30, default 10).
- Returns `{ success, message, result: [{ title, url, snippet }] }` — title/url/snippet only. You must read the snippet/URL to extract company name + domain; there is no structured company object.
- Good for "find AI startups in Mumbai hiring ML engineers" type queries where a structured DB underperforms.

```
exa_web_search({
  "query": "Series B fintech startups in Mumbai hiring engineers",
  "category": "company",
  "numResults": 15
})
```

## Source 5 — Internal company index (`search_companies_index`)

- Searches companies already indexed in the workspace (Elasticsearch).
- Use first when the user may already have the company, or to dedupe before saving sourced results.
- Returns existing CRM companies so you can update instead of create.

## Dedupe + CRM save workflow (when the user asks to save)

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
- Prefer the internal index to avoid duplicate CRM companies.
- For LinkedIn/Harvest, follow the `linkedin-search` skill's facet and shape rules (load it as a sub-skill).
- Dedup by domain/normalized name before any write.
- Present results with name, domain, industry, location, size, and source (Apollo / LinkedIn / Harvest / Exa) so the user can judge quality.
