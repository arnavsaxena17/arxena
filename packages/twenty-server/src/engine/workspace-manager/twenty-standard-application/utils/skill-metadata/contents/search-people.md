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

- Prefer whenever the user names Apollo, or wants title / company / headcount / geo filtering on people.
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
- `search_linkedin_from_url` for pasted LinkedIn / Sales Nav / Recruiter URLs.
- Recently added 1st-degree connections: `list_linkedin_relations` with `limit` = n.
- Do **not** call `search_linkedin_with_query` (not active in MCP).

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
### Outreach ephemeral save (default on /outreach-home)

1. Confirm browsing context has `projectId`.
2. Search people (LinkedIn / Harvest / Apollo…).
3. Map hits to the person shape expected by `upsert_outreach_target_people`.
4. `upsert_outreach_target_people({ projectId, mode: "merge", people })`.
5. Summarize. Do **not** create enrollment records until the user confirms.

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
5. **LinkedIn spill files:** keep `fileId` / `outputRef.fileId` from `search_linkedin_people`; mount in `code_interpreter` via `files: [{ fileId, filename: "search.json" }]` — parse `result.items`, never paste JSON into the code string.
6. If asked for CSV + project: write `/home/user/output/` from the **same parsed rows**; attach to project via candidate link tools when needed.

### People constraints

- On Outreach People tab, `upsert_outreach_target_people` is mandatory before ending the turn; never `create_candidate` until confirm.
- Present results with name, title, company, location, and source; note when Recruiter results hide public identifiers.

---
