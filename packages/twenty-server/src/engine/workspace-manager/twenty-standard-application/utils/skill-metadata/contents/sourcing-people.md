## People

A population is this section: a title, a skill, an industry, a city, or "all software engineers who know React in SaaS companies in Mumbai". Do not call `find_role_at_companies` and do not look up each person at each company. A role at companies already named loads `people-by-company`.

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

On Outreach include `upsert_outreach_target_people`. Do not `create_candidate` on Find or on Save to CRM.

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

# Save to CRM only, after the user asks
learn_tools([
  "save_outreach_targets_to_crm"
])
```

<!-- search-find-candidate-internal-learn-tools-line:start -->
`find_candidate_in_arxena_internal` looks up one existing person. It does not create a record.
<!-- search-find-candidate-internal-learn-tools-line:end -->

Dedup across sources **by normalized name + email/linkedin** before writing.

### Outreach ephemeral save (default on /outreach-home)

Follow **Ephemeral write contract** (the head of this skill). Steps:

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

### Save to CRM (only when the user asks)

1. Dedupe on **email** first, then **LinkedIn URL**, then normalized name + company.
2. `save_outreach_targets_to_crm` with `target: "people"`. Omit ids to save the whole tab. This creates Person records and does not start outreach.
3. **LinkedIn results** are in a list (see **Result lists**): `outreach_list` `save_to_crm` is the same write. Do not parse the rows yourself.
4. Start outreach only after those records exist, and only when the user asks: load `outreach`.

### People constraints

- On Outreach People tab, a Find must write the tab before ending: `search_bright_data_business` with `projectId`, or `outreach_list` `attach`, or `upsert_outreach_target_people`. Do not end on a chat-only list. Do not `create_candidate` on Find or on Save to CRM.
- Present results with name, title, company, location, and source; note when Recruiter results hide public identifiers.
