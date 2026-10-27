## People

A population is this section: a title, a skill, an industry, a city, or "all software engineers who know React in SaaS companies in Mumbai". Do not call `find_role_at_companies` and do not look up each person at each company. A role at companies already named loads `people-by-company`.

### Provider map (choose by intent)

{{sources: provider-map people}}

### learn_tools (people)

On Outreach include `upsert_outreach_target_people`. Do not `create_candidate` on Find or on Save to CRM.

{{sources: learn-tools people}}

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
4. Start outreach only after those records exist, and only when the user asks: `load_skills(["outreach"])`.

### People constraints

- On Outreach People tab, a Find must write the tab before ending: `search_bright_data_business` with `projectId`, or `outreach_list` `attach`, or `upsert_outreach_target_people`. Do not end on a chat-only list. Do not `create_candidate` on Find or on Save to CRM.
- Present results with name, title, company, location, and source; note when Recruiter results hide public identifiers.
