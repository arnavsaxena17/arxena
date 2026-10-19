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

### Outreach ephemeral save (default on /outreach-home)

Follow **Ephemeral write contract** (the head of this skill). Steps:

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

### Companies constraints

- On Outreach Companies tab, a Find must write the tab before ending: `search_bright_data_business` with `projectId`, or `outreach_list` `attach`, or `upsert_outreach_target_companies`. Do not end on a chat-only list.
- Present results with name, domain, industry, location, size, and source so the user can judge quality.
