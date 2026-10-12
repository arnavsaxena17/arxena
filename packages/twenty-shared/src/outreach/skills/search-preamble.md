# Search Skill

You source **companies and people** across connected data providers, dedupe them, and **route winners to the correct destination** (Find / Save to CRM / Enroll / Harvest). <!-- search-skill-provider-summary:start -->LinkedIn, Harvest, Apollo, Exa, and Bright Data<!-- search-skill-provider-summary:end --> details live in the sections below — load this one skill only (`load_skills(["search"])`).

Prefer this skill over `research` when sourcing target accounts or people.

<!-- search-bright-data-default-rule:start -->
## Default provider: Bright Data

For any company or people search, use `search_bright_data_business` (`entity: "company"` or `"people"`, ludicrous mode with the estimate → budget → fetch flow) **unless** the user names another provider (Apollo, LinkedIn / Sales Navigator, Harvest, Exa, a pasted LinkedIn URL) or the request needs a feature only another provider has (a named Sales Nav list, facet IDs, a known domain to enrich). Do not pick Apollo just because it is listed first. Fall back to another provider only if Bright Data errors or returns nothing, and say so. A short request such as "get the CEO of each filtered company" is a **Role at named companies** lookup (People section): resolve the companies from the project tab yourself and run it without asking about provider, budget or estimates.

<!-- search-bright-data-default-rule:end -->

## Building a list of N that must be filtered and enriched

When the user wants a **finished list of about N companies** that also needs judging against criteria not in the source data (store count, revenue, marketing activity, category fit), do not run one search. Follow **Build a target list** in the Companies section: many queries per category, estimate, fetch in rounds, filter and enrich, and repeat until the filtered count reaches N or the approved caps are used.

## Destination verbs (choose first)

| Verb | Meaning | Typical tools |
| --- | --- | --- |
| **Find** | Ephemeral campaign list (Companies/People tabs) | `upsert_outreach_target_companies` / `upsert_outreach_target_people` |
| **Save to CRM** | Plain Company / Person records from the Find tabs (no Candidate, no enrollment) | `save_outreach_targets_to_crm({ projectId, target, companyIds?, personIds? })` |
| **Enroll** | Person + enrollment record (`create_candidate`, `QUEUED`) after user confirms | `upload-profiles` / `create_candidate` — or load `outreach` for workflows |
| **Harvest** | Scheduled CRM companies + `projectIds` | Load `outreach` + `workflow-building` — do **not** Redis-upsert |

On Find (campaign tabs): never end after a chat-only table — persist with the upsert tools first. Do **not** Enroll until the user confirms Add to CRM / Enroll.

## Result lists (every provider)

Search results never come back to you as rows. `search_bright_data_business`, `search_apollo_companies`, `search_apollo_people`, `search_linkedin_companies`, `search_linkedin_people`, `search_linkedin_from_url`, `search_linkedin_continue` and the Exa tools put what they find in a **list** and return only a `listId`, counts (`fetched`, `added`, `duplicates`, `total`), paging (`cursor`, `paging`) and a `nextStep`. You cannot read the rows and must not try: no `code_interpreter`, no `extract_json_paths`, no pasting names into chat.

A list is **temporary** (Redis plus an S3 backup): 30 days when any source was paid (Bright Data), otherwise 7, extended each time it is used. Pages of one search append to the same list and duplicates are dropped. Building a list is two separate steps:

1. **Fetch** (the search tools above): results are in the list.
2. **Save** (only when the user asks or confirms): `outreach_list` with `action: "save_to_crm"` and a `projectId` creates plain CRM Company / Person records, tagged to the project and never enrolled. It handles up to 20,000 rows a call (`offset` continues; the result gives `nextOffset`), one company at a time, so a large save takes a while. Companies are matched by website and people by LinkedIn URL.

Everything else is `outreach_list` too (`learn_tools` it once): `summary` (counts, top industries and countries), `peek` (at most 10 short rows, only for a quality check), `export` (a CSV with every row: give the user the download link), `dedupe` (`against: "crm"` or `"lists"`, `remove: true` drops the matches), `attach` (show rows on the project's Companies or People tab, up to 20,000), `list` (all lists), `delete`. For "find me N companies" requests: fetch, `dedupe` against the CRM, report the counts, and offer export or save.

## Ephemeral write contract (Find / Outreach tabs)

For the tools in **Result lists**, show the rows on the tab with `outreach_list` `attach` (not an upsert). For any other search tool that still returns rows (Harvest People API, `search_companies_index`, Wikidata), do **one** upsert before ending the turn:

```
execute_tool({
  toolName: "upsert_outreach_target_people",  // or upsert_outreach_target_companies
  arguments: { projectId, mode: "merge", people: [...] }  // JSON object — from browsing context
})
```

- `projectId` comes from the browsing context (`projectId: none` or no browsing context means it is missing). **If it is missing, do not guess and do not skip the write: ask the user which project the results should be tagged to.** Resolve it before the fetch step, not after, so the results are written once:
  1. `learn_tools({ toolNames: ["find_many_projects", "ask_questions"] })` (skip anything already learned), then `execute_tool` `find_many_projects` with `select: ["id", "name"]` and a small `limit` (10–20), newest first when possible.
  2. Call `ask_questions` with one single-choice question, "Which project should these results be tagged to?", one option per project (label = project name, keep the id for yourself). If there are no projects, offer "Create a new project" and ask for a name, then `create_one_project`.
  3. Use the chosen project's id as `projectId` for the rest of the turn (Bright Data fetch call, `upsert_outreach_target_*`). Do not ask again in the same conversation.
- **Never** call upsert from inside `code_interpreter`. Use interpreter only to build the array from spilled search files, then upsert via `execute_tool`. This applies only to tools that still return rows, not to the list tools.
- **Never** `create_candidate` / `create_one_company` for Find. When the user confirms Save to CRM, call `save_outreach_targets_to_crm` (omit ids to save the whole tab, pass the selected ids otherwise); it dedupes against the CRM and never enrolls. Enrollment (`upload-profiles` / `create_candidate`) needs its own confirmation.
- Bulk LinkedIn lists: paginate per **LinkedIn / Harvest**; every page lands in one list, then `attach` or `save_to_crm`. Do not print multi-KB JSON into chat or loop many interpreter calls.

## Plan → Learn → Execute

1. `load_skills(["search"])`
2. Choose destination verb (table above).
3. Choose **Companies**, **People**, or both — read that section; read **LinkedIn / Harvest** when using LinkedIn or Harvest sources.
4. One `learn_tools` with every tool you will use, then `execute_tool`.
5. Keep search `limit` small (10–25) unless the user wants a big list.
6. Dedup before any write, persist to the chosen destination, then report.

## Global constraints

- Never invent provider field names or tool names — always `learn_tools` first and use what the schema returns.
- Respect rate limits; avoid large bulk scrapes unless the user explicitly asks.
- For LinkedIn/Harvest, follow the **LinkedIn / Harvest** section (facet IDs, `searchParameters` shapes, Harvest People API).
- Scheduled CRM harvest/enroll workflows are `outreach`, not this skill.

---
