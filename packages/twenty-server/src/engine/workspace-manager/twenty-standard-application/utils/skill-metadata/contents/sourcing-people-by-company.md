## People by company

A role at companies already named, or already on the project. **One call for the whole list.** No estimate, no provider question, no second search, and no loop over companies. The tool searches every company and returns the matching people (up to 3 verified people per company). The agent does not search.

`learn_tools(["find_role_at_companies", "get_outreach_tab", "ask_questions"])` once, then follow the steps.

1. **Which companies.** Do not read the companies and type them back: the tool reads them itself.
   - "All the companies", "these", "the project's companies": `fromProject: true` with `projectId` and no `companies`. Companies already marked Found are skipped (`rerunFound: true` pays for them again). Up to 500 per call, in one call. People are saved to the tab as each company finishes.
   - "Filtered" or "selected" means the rows shown on the Companies tab: add `onlyViewMatches: true`. If the view filter does not narrow the list but the user named a criterion (a city, "HQed in Mumbai", revenue), read the AI column that answers it with `get_outreach_tab`, then pass the companies you keep as an explicit `companies` list.
   - Say in one line how many companies you took and which you left out and why. When the user named the companies or said all or filtered, that is the list: no question.
   - When you chose the subset (narrowed by a column, or built it in `playbook-company-first`), confirm it before the call with `ask_questions`: **Yes, these {N}** (recommended), **Edit the list**, **Cancel**. Call only after a yes.
2. **One call.** `find_role_at_companies({ fromProject: true, projectId, roles, location })`, or with an explicit `companies: [{ id, name, alternateNames? }]` list (up to 50 per call; more than 50: batches of 50, all the calls in one step). The tool limits itself to 50 lookups at a time across calls.
   - `roles`: every role the user named, in their words (`["CEO", "MD", "founder"]`). Never drop one and never add one they did not ask for.
   - `id` (explicit list): the company's row id from `get_outreach_tab`. It links the found people to that company and fills the company's "People found" column, including when nobody is found.
   - `alternateNames` (explicit list only): legal or parent names you know, because profiles list the employer, not the brand.
   - `location` is where the people should be based: city, state/region, or country (e.g. `"Mumbai"`, `"Maharashtra"`, `"India"`). Pass the place the user named; do not widen a city to its country. `projectId` writes the verified people to the People tab.
3. **Read `status` per company**, then act once. Keep every verified match; do not stop at the first person, and never broaden the roles.

   | `status` | Means | Next |
   | --- | --- | --- |
   | `matched` | Someone holds the role | Keep all matches |
   | `related_role_only` | A deputy, vice or acting holder | Report apart |
   | `no_match` | Searched, nothing verified | Once more with an explicit list and any `alternateNames` you know |
   | `source_error` | The lookup did not complete: unknown | Once more with `fromProject: true, onlyFailed: true` |

   `rejected` lists people found who do not belong; they are not written to the tab.
4. **Profiles.** Bright Data matches arrive with their profile stored on the row. A person found only by Google has a name and a LinkedIn URL at most: run `fetch_profiles` before scoring.
5. **Report in one short table**: company, person, title, LinkedIn URL, source; then the related-role-only and no-match companies and the spend.

### Pool size

The tool returns up to 3 people per company, so N companies give at most 3N people. Name the pool in your report. If the target is larger (two named companies and a target of 30), say so before the call, build peer companies with `playbook-company-first`, and ask once whether to widen to peers.

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
