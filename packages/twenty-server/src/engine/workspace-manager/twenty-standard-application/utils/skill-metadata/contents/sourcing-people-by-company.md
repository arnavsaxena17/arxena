## People by company

A role at companies already named, or already on the project. The unit of work is the company × role pair: the run is done when every pair has a final state, not when a list reaches a size. `find_people_by_company` searches each company itself, cheapest source first (a found answer from an earlier run, Bright Data, then Google and the company's own pages, then Harvest when the user picked it), stops at the plan's confidence, and writes one state per company × role pair on the company row. You do not search companies one by one.

`learn_tools(["find_people_by_company", "get_outreach_tab", "get_sourcing_ledger", "ask_questions"])` once, then follow the steps.

1. **The plan is the brief.** Before the first lookup, the brief holds the roles, `persona`, the sources the user picked (`requirements`), `coverage`, and anything the user said about the title ladder: `ladder.maxRung` (1 the title as typed, 2 equivalents, 3 a related role or one level down, 4 the owner or MD of a small company; sales defaults to 4, exec search to 2), `capsUsd.perPair` (default $0.10) and, for exhaustive, `capsUsd.run`. `maxBudgetUsd` is the per-pair cap (max $1), never the run cap; the run cap is read from the brief. The tool reads it; do not repeat it in the call unless the user overrides it. Pass `criteria` with every person attribute the user stated, in their words ("payments or lending platform experience"): the tool judges it on each profile, rejects a person the profile shows lacks it, and keeps one the profile does not settle (`criteriaUnknown`).
2. **Which companies.** Do not read the companies and type them back: the tool reads them itself.
   - "All the companies", "these", "the project's companies": `fromProject: true` with `projectId` and no `companies`. Pairs already in a final state for these roles are skipped (`rerunFound: true` pays for them again; `onlyFailed: true` reruns only failed lookups). Rows the import marked unresolvable are not searched.
   - "Filtered" or "selected" means the rows shown on the Companies tab: add `onlyViewMatches: true`. If the view filter does not narrow the list but the user named a criterion, read the column that answers it with `get_outreach_tab`, then pass the companies you keep as an explicit `companies` list (`{ id, name, domain?, employees?, alternateNames? }`).
   - Say in one line how many companies you took and which you left out and why. When you chose the subset yourself, confirm it first with `ask_questions`: **Yes, these {N}** (recommended), **Edit the list**, **Cancel**. Keep the confirmation short: the count, the criteria, and at most 10 names. Do not page a 100-row list into the chat to show it.
3. **Pilot.** On the first lookup of a project, call with `pilotSize: 10`. Show the pilot in a short table (company, person, title, rung, confidence, state) and ask once whether the role reading and the rung are right. Adjust the brief if the user corrects them.
4. **The rest.** Call again without `pilotSize`. A background run, `deferredByBudget`, or a pair you cannot settle: load `sourcing` sections `["run-edge"]`.
5. **Profiles.** Bright Data matches arrive with their profile stored on the row. A person found only by Google has a name and a LinkedIn URL at most: run `fetch_profiles` before scoring.
6. **Report in the same turn.** The tool result already carries the summary, the pairs and `withoutResults`: write the report from it. Never end a turn on "let me pull the details" — a spilled file is not a reason to stop.
7. **Report from data**: start with the coverage line from `get_sourcing_ledger` (`pairs.coverageLine`, pass `projectId` and `roles`), which counts company × role pairs, then one short table (company, role, person, title, rung, confidence, source), then the pairs without a person and why, the spend, and the budget left. A company with the CEO found and the manufacturing head none_found is one covered pair and one none_found pair, not "covered". If coverage is exhaustive, quote the universe and the deferred count; if it is best effort, say so.

### Only when the user names LinkedIn

The default path does not issue these. Use them only when the user names that provider for this lookup. Harvest is already a step in the cascade when it was picked; do not call it per company.

**LinkedIn, role at one company.** `generate_linkedin_query_set` with the role and company as the brief returns the payload for the account's mode (`src-linkedin`). By hand, resolve the company id first and do not invent ids. `searchParameters` for the account's `searchType`:

```json
// sales_navigator
{ "role": { "include": ["14"] }, "company": { "include": ["1441"] } }
// classic
{ "advanced_keywords": { "title": "Head of Engineering" }, "company": ["1441"] }
// recruiter
{ "role": [{ "keywords": "Head of Engineering", "priority": "MUST_HAVE", "scope": "CURRENT" }], "company": [{ "keywords": "Acme" }] }
```


