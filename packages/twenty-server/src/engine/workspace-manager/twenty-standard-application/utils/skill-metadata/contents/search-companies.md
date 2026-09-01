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
<!-- search-wikidata-companies-provider-row:start -->
| **Wikidata** | `search_wikidata_companies` | Enrich a known domain/URL with structured facts (HQ, industry, employees, CEO) | Public Wikidata API (no key) |
<!-- search-wikidata-companies-provider-row:end -->
<!-- search-companies-index-provider-row:start -->
| **Internal index** | `search_companies_index` | Dedupe against companies already in the workspace | Elasticsearch index |
<!-- search-companies-index-provider-row:end -->

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
<!-- search-companies-index-learn-tools-line:end -->
<!-- search-wikidata-companies-learn-tools-line:start -->
    "search_wikidata_companies",
<!-- search-wikidata-companies-learn-tools-line:end -->
<!-- search-exa-companies-learn-tools-line:start -->
    "exa_web_search",
<!-- search-exa-companies-learn-tools-line:end -->
    "upsert_outreach_target_companies"
  ]
})

# Explicit CRM save only
learn_tools({ "toolNames": ["create_one_company", "update_one_company"] })
```

Dedup across sources **by normalized name + domain** before saving.

<!-- search-apollo-companies-source-section:start -->
### Source — Apollo (`search_apollo_companies`)

Best for firmographic company search. Available in the `prospecting` pack.

- Prefer whenever the user names Apollo, or wants industry / headcount / geo filtering on companies.
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

Live LinkedIn company results. **Full facet workflow: LinkedIn / Harvest section below.**

- `searchType`: `classic` or `sales_navigator`.
- Resolve geo/industry facet IDs with `search_linkedin_parameters` (`LOCATION`, `INDUSTRY`).
- `search_linkedin_from_url` for a pasted LinkedIn company search URL.
- Do **not** call `search_linkedin_with_query` (not active in MCP).

### Source — Harvest (company discovery via people)

Harvest has no standalone company search — discover companies *through people* when certain roles exist, or when no LinkedIn session is available.

- Use People API tools with `dataSource: "harvest"`; extract `companyName` from hits to build the company list.
- **Full Harvest examples: LinkedIn / Harvest section below.**

<!-- search-exa-companies-source-section:start -->
### Source — Exa (`app_exa_web_search` / `exa_web_search`)

Web/AI search for new, niche, or poorly-covered companies.

- Prefer `app_exa_web_search` when preloaded; otherwise `exa_web_search`.
- Requires `EXA_API_KEY` (tell the user if missing).
- `category`: `"company"`. Returns title/url/snippet only — extract **name** from title and **domain** from URL host.
- If results spill to a file, parse with `code_interpreter` — never paste multi-KB JSON into the code string.

```
app_exa_web_search({
  "query": "Series B fintech startups in Mumbai hiring engineers",
  "category": "company",
  "numResults": 15
})
```

<!-- search-exa-companies-source-section:end -->
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
3. Spilled search: one `code_interpreter` to build `companies[]` → one `execute_tool` upsert. Never upsert from the sandbox.
4. Tell the user the Companies tab count (UI refreshes within a few seconds).

### CRM save (only when the user asks)

1. Normalize and dedupe on **domain host** or normalized name.
2. Load `data-manipulation` + `code-interpreter`; resolve existing companies in `code_interpreter`:

```python
company_ids = arxena.lookup_by('companies', 'name', [r['name'] for r in company_records])
```

3. `create_one_company` for missing, `update_one_company` for present. Use returned **CRM UUID** — never provider ids.
4. Field map: name → `name`, domain → `domainName`, location → `address`, country → `country`, industry → `industry`, employees → `employees`, LinkedIn URL → `linkedinLink.primaryLinkUrl`.
5. If asked for CSV + project: write `/home/user/output/` from the **same parsed rows** before ending the turn.

### Companies constraints

- On Outreach Companies tab, `upsert_outreach_target_companies` is mandatory before ending the turn.
- Present results with name, domain, industry, location, size, and source so the user can judge quality.

---
