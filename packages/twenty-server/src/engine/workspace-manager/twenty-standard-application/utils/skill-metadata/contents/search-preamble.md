---
description: |-
  Source companies and people (Apollo/LinkedIn/Harvest/Exa/Bright Data). Find, then Save to CRM, then Start outreach
priority: 20
routes:
  - when: |-
      Find companies or people / LinkedIn / Harvest / Sales Nav / places on a map
    hint: |-
      . Load one section: `["people"]` for a population, `["companies"]` for companies and places on a map, `["people-by-company"]` for a role at companies already named. A judged list of about N also loads `ai-filter-enrich`.
---
# Search Skill

You source companies and people. <!-- search-skill-provider-summary:start -->LinkedIn, Harvest, Apollo, Exa, and Bright Data<!-- search-skill-provider-summary:end -->. One section is loaded with this text. Follow that section.

## Plan

Pick the path. If that section is not already in this prompt, load it and stop until it is.

| Request | Section |
| --- | --- |
| A population: a title, a skill, an industry, a city | `people` |
| Companies, or places on a map | `companies` |
| A role at companies already named or already on the project | `people-by-company` |

Stage comes from the system prompt. The tools are:

- **Find** (default): rows on the project tab. List tools use `outreach_list` `attach`. Tools that still return rows use one `upsert_outreach_target_people` or `upsert_outreach_target_companies`.
- **Save to CRM**: only when the user says save or add to the CRM. `save_outreach_targets_to_crm`. Does not start outreach. Never `create_candidate` or `create_one_company` on Find or on Save to CRM.
- **Start outreach**: load `outreach`. Not this skill.

A judged list (about N companies or people that must match a rubric, such as store count, revenue, or runs ads) is still `companies` or `people`, and also `load_skills(["ai-filter-enrich"])`. A role at companies already named is never that loop.

## Learn

One `learn_tools` call, with only the tools the loaded section names. Add `outreach_list` when the search returns a `listId`. Add `find_many_projects` and `ask_questions` only when `projectId` is missing. Do not learn tools from a section that was not loaded.

## Execute

Follow the loaded section, then these rules.

<!-- search-bright-data-default-rule:start -->
### Provider

For `people` and `companies`, use `search_bright_data_business` (`entity: "company"` or `"people"`, ludicrous mode, estimate then budget then fetch) unless the user names another provider (Apollo, LinkedIn / Sales Navigator, Harvest, Exa, a pasted LinkedIn URL) or the request needs a feature only that provider has (a named Sales Nav list, facet ids, a known domain to enrich). Do not pick Apollo because it is listed first. Fall back only if Bright Data errors or returns nothing, and say so.

`people-by-company` is one `find_role_at_companies` call for the whole company list. No estimate and no provider question. The tool searches every company and returns the matching people. Do not search those companies yourself and do not loop them.
<!-- search-bright-data-default-rule:end -->

### Result lists

Search results never come back as rows. `search_bright_data_business`, `search_apollo_companies`, `search_apollo_people`, `search_linkedin_companies`, `search_linkedin_people`, `search_linkedin_from_url`, `search_linkedin_continue` and the Exa tools put what they find in a list and return only a `listId`, counts (`fetched`, `added`, `duplicates`, `total`), paging (`cursor`, `paging`) and a `nextStep`. Do not read the rows: no `code_interpreter`, no `extract_json_paths`, no pasting names into chat.

A list is temporary (Redis plus an S3 backup): 30 days when any source was paid (Bright Data), otherwise 7, extended each time it is used. Pages of one search append to the same list and duplicates are dropped.

`outreach_list` (`learn_tools` it once): `summary`, `peek` (at most 10 rows, only for a quality check), `export` (CSV download link), `dedupe` (`against: "crm"` or `"lists"`, `remove: true` drops the matches), `attach` (show rows on the tab, up to 20,000), `save_to_crm` (plain CRM Company / Person records, tagged to the project, never enrolled; up to 20,000 rows, `offset` continues), `list`, `delete`. Companies match by website, people by LinkedIn URL. For "find me N": fetch, `dedupe` against the CRM, report the counts, and offer export or save. Do neither without a yes.

### Write contract

List tools: show the rows with `outreach_list` `attach`, not an upsert. A tool that still returns rows (Harvest People API, `search_companies_index`, Wikidata): one upsert with `{ projectId, mode: "merge", people }` or `companies`, via `execute_tool`. Never upsert from inside `code_interpreter`. Build the array there, then upsert outside it.

`projectId` comes from the browsing context. If it is missing, do not guess and do not skip the write. Resolve it before the fetch:

1. `learn_tools` `find_many_projects` and `ask_questions` if not already learned, then `find_many_projects` with `select: ["id", "name"]` and `limit` 10–20.
2. `ask_questions`: "Which project should these results be tagged to?", one option per project. If there are none, offer "Create a new project", then `create_one_project`.
3. Use that id for the rest of the turn. Do not ask again in the same conversation.

When the user confirms Save to CRM, call `save_outreach_targets_to_crm` (omit ids to save the whole tab). Bulk LinkedIn lists: paginate with `search_linkedin_continue`; every page lands in one list, then `attach` or `save_to_crm`. Do not print multi-KB JSON into chat.

### Judged lists

Approve fetch and enrichment caps once (`ask_questions`: go / change the caps / cancel). That yes replaces the per-query budget question and covers every estimate, fetch, and column run inside those caps. Then round until the filtered count reaches about N or a cap is hit: fetch in this skill, then filter and enrich in `ai-filter-enrich`. Cheapest cut first: a row-answerable gate, then a free size proxy (employees or followers already on the row), then one web-search column for the facts the row does not hold. Reuse one column per fact. Do not exceed a cap. Report the count, the spend, and offer export or save.
