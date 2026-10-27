---
description: |-
  Source companies and people (Bright Data, LinkedIn/Unipile, Harvest, Apollo, Exa). Find, then Save to CRM, then Start outreach
priority: 20
routes:
  - when: |-
      Find companies or people / LinkedIn / Harvest / Sales Nav / places on a map
    hint: |-
      . Pass `sections`: `["people"]` for a population, `["companies"]` for companies and places on a map, `["people-by-company"]` for a role at companies already named. A scored list of about N also `load_skills(["ai-filter-enrich"])` and pass `sections`: `["playbook-scored-list"]` (plus `people` or `companies`).
parts:
  - companies
  - people
  - people-by-company
  - playbook-scored-list
  - playbook-company-first
  - playbook-shortfall
  - requirements
  - scoring
  - know-profiles
  - know-seniority
  - src-bright-data-people
  - src-bright-data-companies
  - src-linkedin
  - src-harvest
  - src-serp
  - src-apollo
  - src-exa
  - src-wikidata
requires:
  companies: [src-bright-data-companies]
  people: [src-bright-data-people]
  playbook-scored-list: [scoring, playbook-shortfall]
  playbook-company-first: [people-by-company, playbook-shortfall]
defaultSections:
  - people
  - companies
---
# Sourcing Skill

You source companies and people. <!-- search-skill-provider-summary:start -->LinkedIn, Harvest, Apollo, Exa, and Bright Data<!-- search-skill-provider-summary:end -->. Only the sections you asked for are loaded with this text. Follow them.

## Vocabulary

Use these words, and only these, when you reason, call tools and report.

| Term | Meaning |
| --- | --- |
| **Search** | A query to one source. Returns **snapshots**. |
| **Snapshot** | One search result: a partial profile with only the fields that source previews. A field a snapshot lacks is unknown, not absent. |
| **Profile fetch** | Takes the LinkedIn URL of a snapshot and returns the **full profile**. |
| **Enrichment** | Adds data from outside the profile or derived from it: company facts from a web search, distance from the job location, an AI column. Email and phone lookup is contact enrichment, a different job, and not part of sourcing. |
| **Scoring** | How well a person or company fits the user's criteria: pass, fail or unknown. Load `scoring`. |
| **Fitment threshold** | The minimum fitment score for a row to count toward the target. 50% unless the server says otherwise; never lower it to reach the number. |

Funnel, cheapest step first: search → score snapshots → profile fetch (pass and unknown only) → enrichment (only when a criterion needs it) → score full profiles. Only a row that clears the threshold on its full profile counts toward the target.

If the user gave no target count, ask for it with `ask_questions` before any paid fetch.

## Ask, decide or look up

Sort every open point before you ask anything.

- **Look it up:** `projectId`, the workspace ICP and target titles, HQ, connected channels, the tab, the columns that exist, what the user said earlier. Using these is not a question.
- **Decide, and say so in one line:** source and order, title synonyms, slicing, batch sizes, scoring model, preview size, column names, must-have for every attribute the user stated (nice-to-have only for "preferably" or "ideally"), dedupe against the CRM. Ask only when the options would lead to different results or costs.
- **Ask:** the target count when missing; what a match means when a term has two readings; the spend caps (once); relaxing a must-have; anything that sends, enrolls or deletes.

State the brief, ask what is missing in one batch (at most four questions, each with a recommended option), record it with `get_sourcing_ledger` (`brief`), then run. Later, ask only to go past an approved cap or to choose what to do about a shortfall. When the target, the criteria or the destination is missing, load `requirements`.

## Be fast

The user waits on every step. Fewer, bigger steps beat careful small ones.

- One `learn_tools` for every tool the route needs, then act. No narration between calls.
- Run independent calls in the same step. Never one call per company or per person: every sourcing tool takes the whole list.
- Ask once, up front: target count, caps, rubric. After a yes, do not ask again before spending inside the caps.
- Score the whole list with one `run_ai_column` after one 10-row preview. Do not preview twice.
- `run_ai_column` waits for the run. If it is still going, call `get_ai_column_run_status` once (it waits two minutes) and never more than once a minute: every check is a full model step.
- A long LinkedIn search is one `search_linkedin_continue` call with `maxPages` (up to 50), not a call per page.
- Never read rows into the chat. No `code_interpreter` or `extract_json_paths` on a list. `get_outreach_working_set` only with `summarize`; `outreach_list` `peek` shows at most 10 rows.
- Fetch profiles only for rows that passed or are unknown, with `fetch_profiles`; call again only while `remaining` is above 0.
- Do not read rows back to check the work. Counts and `summarize` are enough.
- A source that errors or returns nothing: take the next one in Source order in the same turn.
- Stop as soon as the target is met at the fitment threshold.

## Plan

Pick the path. If that section is not already in this prompt, load it and stop until it is.

| Request | Section |
| --- | --- |
| A population: a title, a skill, an industry, a city | `people` |
| Companies, or places on a map | `companies` |
| A role at companies already named or already on the project | `people-by-company` |
| A company list first, then a role at each | `playbook-company-first` |
| About N rows that must clear a rubric | `playbook-scored-list` |
| Fewer results than asked for | `playbook-shortfall` |
| The request lacks a target, criteria or destination | `requirements` |

Sections that are not search types: `scoring`, `know-profiles` and `know-seniority` (how to read profiles and titles), and one `src-*` section per source. Load a `src-*` section only for a source you will call.
The destination comes from the system prompt. The tools are:

- **Find** (default): rows on the project tab. List tools use `outreach_list` `attach`. Tools that still return rows use one `upsert_outreach_target_people` or `upsert_outreach_target_companies`.
- **Save to CRM**: only when the user says save or add to the CRM. `save_outreach_targets_to_crm`. Does not start outreach. Never `create_candidate` or `create_one_company` on Find or on Save to CRM.
- **Start outreach**: `load_skills(["outreach"])`. Not this skill.

A scored list (about N companies or people that must match a rubric, such as store count, revenue, or runs ads) is still `companies` or `people`, and also `load_skills(["ai-filter-enrich"])`. A role at companies already named is never that loop.

## Learn

One `learn_tools` call, with only the tools the loaded section names. Add `outreach_list` when the search returns a `listId`. Add `find_many_projects` and `ask_questions` only when `projectId` is missing. Do not learn tools from a section that was not loaded.

## Execute

Follow the loaded section, then these rules.

<!-- search-bright-data-default-rule:start -->
### Provider

For `people` and `companies`, use `search_bright_data_business` (`entity: "company"` or `"people"`, ludicrous mode, estimate then budget then fetch) unless the user names another provider (Apollo, LinkedIn / Sales Navigator, Harvest, Exa, a pasted LinkedIn URL) or the request needs a feature only that provider has (a named Sales Nav list, facet ids). For a **known domain or company website**, use Bright Data company search with `mode: "instant"` and the bare host (domain recipe in `src-bright-data-companies`), not ludicrous and not Apollo. Do not pick Apollo because it is listed first. Fall back only if Bright Data errors or returns nothing, and say so.

`people-by-company` is one `find_role_at_companies` call for the whole company list. No estimate and no provider question. The tool searches every company and returns the matching people. Do not search those companies yourself and do not loop them.
<!-- search-bright-data-default-rule:end -->

### Source order

The order we prefer, not a list to try in turn. Use the first source that has the fields the request needs. Go to a later one only when the user names it, an earlier one fails or returns nothing, or a field you need is only there. A source missing from that section's provider map is switched off: skip it.

{{sources: source-order}}

Exa (`src-exa`) and Wikidata (`src-wikidata`) are for niche public people and for company look-ups the sources above do not cover.

### Result lists

Search results never come back as rows. `search_bright_data_business`, `search_apollo_companies`, `search_apollo_people`, `search_linkedin_companies`, `search_linkedin_people`, `search_linkedin_from_url`, `search_linkedin_continue` and the Exa tools put what they find in a list and return only a `listId`, counts (`fetched`, `added`, `duplicates`, `total`), paging (`cursor`, `paging`) and a `nextStep`. Do not read the rows: no `code_interpreter`, no `extract_json_paths`, no pasting names into chat.

A list is temporary (Redis plus an S3 backup): 30 days when any source was paid (Bright Data), otherwise 7, extended each time it is used. Pages of one search append to the same list and duplicates are dropped.

`outreach_list` (`learn_tools` it once): `summary`, `peek` (at most 10 rows, only for a quality check), `export` (CSV download link), `dedupe` (`against: "crm"` or `"lists"`, `remove: true` drops the matches), `attach` (show rows on the tab, up to 20,000), `save_to_crm` (plain CRM Company / Person records, tagged to the project, never enrolled; up to 20,000 rows, `offset` continues), `list`, `delete`. Companies match by website, people by LinkedIn URL. For "find me N": fetch, `dedupe` against the CRM, report the counts, and offer export or save. Do neither without a yes.

### Write contract

List tools: show the rows with `outreach_list` `attach`, not an upsert. A tool that still returns rows (Harvest People API, `search_companies_index`, Wikidata): one upsert with `{ projectId, mode: "merge", people }` or `companies`, via `execute_tool`. Never upsert from inside `code_interpreter`. Build the array there, then upsert outside it.

`projectId` comes from the browsing context. If it is missing or `none`, do not guess, do not pick the closest name, and do not skip the write. Resolve it before the fetch (and before any paid fetch):

1. `learn_tools` `find_many_projects` and `ask_questions` if not already learned, then `find_many_projects` with `select: ["id", "name"]` and `limit` 10–20.
2. **Mandatory** `ask_questions`: "Which project should these results be tagged to?", one option per project (mark a recommended option only as a suggestion). If there are none, offer "Create a new project", then `create_one_project`.
3. Stop until the user answers. Use that id for the rest of the turn. Do not ask again in the same conversation.

When the user confirms Save to CRM, call `save_outreach_targets_to_crm` (omit ids to save the whole tab). Bulk LinkedIn lists: paginate with `search_linkedin_continue`; every page lands in one list, then `attach` or `save_to_crm`. Do not print multi-KB JSON into chat.
