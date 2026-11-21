## People

### What each source hands back

{{sources: returns people}}

`returns` is a ceiling, not a promise: any field can be null on any row. A row
without a `linkedinUrl` cannot be deduped, saved to the CRM or profile-fetched.

**One key chains the sources: `linkedinUrl`.** A step is worth running only if it
yields a key the next step consumes. Google search gives the URL but not the
profile, so a SERP row needs `fetch_profiles` before it can be scored; Bright Data
people returns the profile and the URL in one call, so for scoring it is usually
cheaper end to end even at $0.002 a row. When the Arxena index is on, resolve
there first: it is free and it can filter on `linkedinUrl` itself.

### What each source can filter on

{{sources: capabilities people}}

A population is this section: a title, a skill, an industry or a city; do not look up each person at each company. **Companies named, a set the user confirmed, or a known set ("top hospitals"): use "People by company" below and call `find_people_by_company`.** Never list employers in a Bright Data people query.

### Provider map (choose by intent)

{{sources: provider-map people}}

### learn_tools (people)

Do not `create_candidate` on Find or on Save to CRM. Write and Save to CRM follow **Result lists** and **Write contract** in the head of this skill.

{{sources: learn-tools people}}

<!-- search-find-candidate-internal-learn-tools-line:start -->
`find_candidate_in_arxena_internal` looks up one existing person. It does not create a record.
<!-- search-find-candidate-internal-learn-tools-line:end -->

The server dedupes on one key per row: public LinkedIn URL (never Sales Navigator), else name plus company. `against: "lists"` checks every list in the workspace. The CRM check uses the LinkedIn URL only: a row without one counts as new and `save_outreach_targets_to_crm` skips it.

### People constraints

- On Outreach People tab, a Find must write the tab before ending. Do not end on a chat-only list.
- Present results with name, title, company, location, and source; note when Recruiter results hide public identifiers.
- Save to CRM: `save_outreach_targets_to_crm` with `target: "people"`. Start outreach only after, and only when asked: `load_skills(["outreach"])`.

### Job title search

When people are filtered by the job they hold now ("heads of procurement", "plant managers", "CFOs"), check which sources filter the current title.

Use only the sources the user picked for this run.

| Source | Current title filter | How to write the titles | Trust |
| --- | --- | --- | --- |
| Bright Data people | `current_title` (separate from `past_job_titles`) | Plain words; the ludicrous planner compiles boolean strings from the request ("(VP OR Head) AND Procurement") | Good; a record can lag a recent job change |
| Sales Navigator (the user's LinkedIn) | `role: { include }` on the current position | Boolean string | Best precision; runs in slow mode |
| Harvest | `currentJobTitles` (Sales Navigator filters) | One entry per title | Same as Sales Navigator; paid |
| LinkedIn Recruiter | Title keywords with `scope: "CURRENT"` | Boolean string | Good |
| LinkedIn Classic | Keywords only (`advanced_keywords.title` is a keyword match too) | Short keywords | **Flaky**: a match can come from a past role, the headline or the about text. A Classic row is not a title match until its profile shows the title as the current position |
| Google search | Company + job title, to find LinkedIn URLs | One title per query | Snippets only; `find_people_by_company` already does this |
| Apollo | Person titles | One entry per title | Only when switched on |

### Job title rules

{{include: title-seniority}}

- **Vary the carrier; never trust one combination.** Harvest ANDs every parameter, so one unmet word returns nothing. Run the query as several searches — title + company, title alone, keywords alone, and a facet browse — and union them. Facets are labels a profile may skip, so a facet-only search loses people a direct title search finds.
- **Current titles**; past titles only for "ex-" or "former".
- **Expand titles in the user's words** with the synonym ladders above. Never drop a title the user named, and never add a lower level they did not ask for. `find_people_by_company` applies the taxonomy itself.
- **Write each title the way the source expects:** boolean for Sales Navigator and Recruiter, plain words for Bright Data, one per entry for Harvest. Classic takes no boolean.
- **Seniority follows company size.** "Head of X" at a small company can be a manager; "Director" at a large one can sit below VP. Read the scope on the profile (`scoring`).
- **Headline against position:** trust the current position in experience.
- **A title at named companies** is `find_people_by_company`, not a title search.

## People by company

A role at companies already named, or already on the project. The unit of work is the company × role pair: the run is done when every pair has a final state, not when a list reaches a size. `find_people_by_company` searches each company itself, cheapest source first (a found answer from an earlier run, Bright Data, then Google and the company's own pages, then Harvest when the user picked it), stops at the plan's confidence, and writes one state per company × role pair on the company row. You do not search companies one by one.

`learn_tools(["find_people_by_company", "get_outreach_tab", "get_sourcing_ledger", "ask_questions"])` once, then follow the steps.

1. **The plan is the brief.** Before the first lookup, the brief holds the roles, `persona`, the sources the user picked (`requirements`), `coverage`, and anything the user said about the title ladder: `ladder.maxRung` (1 the title as typed, 2 equivalents, 3 a related role or one level down, 4 the owner or MD of a small company; sales defaults to 4, exec search to 2), `capsUsd.perPair` (default $0.10) and, for exhaustive, `capsUsd.run`. `maxBudgetUsd` is the per-pair cap (max $1), never the run cap; the run cap is read from the brief. The tool reads it; do not repeat it in the call unless the user overrides it. Pass `criteria` with every person attribute the user stated, in their words ("payments or lending platform experience"): the tool judges it on each profile, rejects a person the profile shows lacks it, and keeps one the profile does not settle (`criteriaUnknown`).
2. **Which companies.** Do not read the companies and type them back: the tool reads them itself.
   - "All the companies", "these", "the project's companies": `fromProject: true` with `projectId` and no `companies`. Pairs already in a final state for these roles are skipped (`rerunFound: true` pays for them again; `onlyFailed: true` reruns only failed lookups). Rows the import marked unresolvable are not searched.
   - "Filtered" or "selected" means the rows shown on the Companies tab: add `onlyViewMatches: true`. If the view filter does not narrow the list but the user named a criterion, read the column that answers it with `get_outreach_tab`, then pass the companies you keep as an explicit `companies` list (`{ id, name, domain?, employees?, alternateNames? }`).
   - Say in one line how many companies you took and which you left out and why. When you chose the subset yourself, confirm it first with `ask_questions`: **Yes, these {N}** (recommended), **Edit the list**, **Cancel**. Keep the confirmation short: the count, the criteria, and at most 10 names. Do not page a 100-row list into the chat to show it.
3. **Pilot.** On the first lookup of a project, call with `pilotSize: 10`. Show the pilot in a short table (company, person, title, rung, confidence, state) and ask once whether the role reading and the rung are right. Adjust the brief if the user corrects them.
4. **Profiles.** Bright Data matches arrive with their profile stored on the row. A person found only by Google has a name and a LinkedIn URL at most: run `fetch_profiles` before scoring.
5. **Report in the same turn.** The tool result already carries the summary, the pairs and `withoutResults`: write the report from it. Never end a turn on "let me pull the details" — a spilled file is not a reason to stop.
6. **Report from data**: start with the coverage line from `get_sourcing_ledger` (`pairs.coverageLine`, pass `projectId` and `roles`), which counts company × role pairs, then `newRows`, then one short table (company, role, person, title, rung, confidence, source), then the pairs without a person and why, the spend, and the budget left. A company with the CEO found and the manufacturing head none_found is one covered pair and one none_found pair, not "covered". If coverage is exhaustive, quote the universe and the deferred count; if it is best effort, say so.

### Only when the user names LinkedIn

The default path does not issue these. Use them only when the user names that provider for this lookup. Harvest is already a step in the cascade when it was picked; do not call it per company.

**LinkedIn, role at one company.** `generate_linkedin_query_set` with the role and company as the brief returns the payload for the account's mode. By hand, resolve the company id first and do not invent ids. `searchParameters` for the account's `searchType`:

```json
// sales_navigator
{ "role": { "include": ["14"] }, "company": { "include": ["1441"] } }
// classic
{ "advanced_keywords": { "title": "Head of Engineering" }, "company": ["1441"] }
// recruiter
{ "role": [{ "keywords": "Head of Engineering", "priority": "MUST_HAVE", "scope": "CURRENT" }], "company": [{ "keywords": "Acme" }] }
```


