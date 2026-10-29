## People by company

A role at companies already named, or already on the project. The unit of work is the company × role pair: the run is done when every pair has a final state, not when a list reaches a size. `find_people_by_company` searches each company itself, cheapest source first (a found answer from an earlier run, Bright Data, then Google and the company's own pages), stops at the plan's confidence, and writes each pair's state on the company row. You do not search companies one by one.

`learn_tools(["find_people_by_company", "get_outreach_tab", "get_sourcing_ledger", "ask_questions"])` once, then follow the steps.

1. **The plan is the brief.** Before the first lookup, the brief holds the roles, `persona`, the sources the user picked (`requirements`), and anything the user said about the title ladder: `ladder.maxRung` (1 the title as typed, 2 equivalents, 3 a related role or one level down, 4 the owner or MD of a small company; sales defaults to 4, exec search to 2) and `capsUsd.perPair` (default $0.10). The tool reads it; do not repeat it in the call unless the user overrides it.
2. **Which companies.** Do not read the companies and type them back: the tool reads them itself.
   - "All the companies", "these", "the project's companies": `fromProject: true` with `projectId` and no `companies`. Pairs already in a final state for these roles are skipped (`rerunFound: true` pays for them again; `onlyFailed: true` reruns only failed lookups). Rows the import marked unresolvable are not searched.
   - "Filtered" or "selected" means the rows shown on the Companies tab: add `onlyViewMatches: true`. If the view filter does not narrow the list but the user named a criterion, read the column that answers it with `get_outreach_tab`, then pass the companies you keep as an explicit `companies` list (`{ id, name, domain?, employees?, alternateNames? }`).
   - Say in one line how many companies you took and which you left out and why. When you chose the subset yourself, confirm it first with `ask_questions`: **Yes, these {N}** (recommended), **Edit the list**, **Cancel**.
3. **Pilot.** On the first lookup of a project, call with `pilotSize: 10`. Show the pilot in a short table (company, person, title, rung, confidence, state) and ask once whether the role reading and the rung are right. Adjust the brief if the user corrects them.
4. **The rest.** Call again without `pilotSize`. More than 25 companies start a background run: the call returns a `runId` and progress. Read it with `find_people_by_company({ runId })` (it waits up to `waitSeconds`), never more than once a minute; report at 50% and at completion. `cancel: true` with the `runId` stops it and keeps what was found.
5. **Read each pair's `terminalState`**, then act once:

   | `terminalState` | Means | Next |
   | --- | --- | --- |
   | `found` | Someone holds the role at or above the plan's confidence; `rungUsed` says how close the title is | Keep. Flag rung 3 and 4 in the report |
   | `ambiguous` | Only low-confidence people, or a questionable company match (parent, brand, namesake) | Ask the user, with the people and the reason |
   | `none_found` | Searched; `reason` says why: `no_such_role`, `profile_gaps`, `budget` | Report with the reason. `budget`: offer a higher `capsUsd.perPair`. Rerun only with new `alternateNames` |
   | `none_found` + `source_error` | The lookup did not complete | Once more with `fromProject: true, onlyFailed: true` |
   | `unresolvable` | The company could not be identified from the input | Ask for a domain or the legal name |

   `rejected` lists people found who do not belong, including people above the plan's rung; they are not written to the tab. Each kept person has `confidence`, `freshness` and `evidence` (source, query, date, snippet).
6. **Profiles.** Bright Data matches arrive with their profile stored on the row. A person found only by Google has a name and a LinkedIn URL at most: run `fetch_profiles` before scoring.
7. **Report from data**: start with the coverage line from `get_sourcing_ledger` (`pairs.coverageLine`), then one short table (company, person, title, rung, confidence, source), then the companies without a person and why, and the spend.

### Pool size

The tool keeps up to 3 people per company, so N companies give at most 3N people. Name the pool in your report. If the target is larger (two named companies and a target of 30), say so before the call, build peer companies with `playbook-company-first`, and ask once whether to widen to peers.

### Only when the user names LinkedIn or Harvest

The default path does not issue these. Use them only when the user names that provider for this lookup.

**LinkedIn, role at one company.** `generate_linkedin_query_set` with the role and company as the brief returns the payload for the account's mode (`src-linkedin`). By hand, resolve the company id first and do not invent ids. `searchParameters` for the account's `searchType`:

```json
// sales_navigator
{ "role": { "include": ["14"] }, "company": { "include": ["1441"] } }
// classic
{ "advanced_keywords": { "title": "Head of Engineering" }, "company": ["1441"] }
// recruiter
{ "role": [{ "keywords": "Head of Engineering", "priority": "MUST_HAVE", "scope": "CURRENT" }], "company": [{ "keywords": "Acme" }] }
```

**Harvest, a role at a named company.** One natural-language string, or `companyName` when the code is already known. `dataSource` is `"harvest"`. No `harvest_*` tool names.

```json
{
  "naturalLanguage": "Head of Engineering at Acme",
  "dataSource": "harvest",
  "limit": 20
}
```

```json
{
  "dataSource": "harvest",
  "stdFunction": "engineering",
  "stdGrade": "leadership",
  "companyName": "Acme",
  "country": "United States",
  "limit": 20
}
```
