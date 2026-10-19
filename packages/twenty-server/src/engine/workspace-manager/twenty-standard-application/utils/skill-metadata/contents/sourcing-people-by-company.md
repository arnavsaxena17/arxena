## People by company

A role at companies already named, or already on the project. **One call for the whole list.** No estimate, no provider question, no second search, and no loop over companies. The tool searches every company and returns the matching people (up to 3 verified people per company). The agent does not search.

`learn_tools(["find_role_at_companies", "get_outreach_working_set"])` once, then follow the steps.

1. **Which companies.** Do not read the companies and type them back: the tool reads them itself.
   - "All the companies", "these", "the project's companies": `fromProject: true` with `projectId` and no `companies`. Companies already marked Found are skipped (`rerunFound: true` pays for them again). Up to 500 per call, in one call. People are saved to the tab as each company finishes.
   - "Filtered" or "selected" means the rows shown on the Companies tab: add `onlyViewMatches: true`. If the view filter does not narrow the list but the user named a criterion (a city, "HQed in Mumbai", revenue), read the AI column that answers it with `get_outreach_working_set`, then pass the companies you keep as an explicit `companies` list.
   - Say in one line how many companies you took and which you left out and why. Ask a question only if no tab or column can tell you.
2. **One call.** `find_role_at_companies({ fromProject: true, projectId, roles, country })`, or with an explicit `companies: [{ id, name, alternateNames? }]` list (up to 50 per call; more than 50: batches of 50, all the calls in one step). The tool limits itself to 50 lookups at a time across calls.
   - `roles`: every role the user named, in their words (`["CEO", "MD", "founder"]`). Never drop one and never add one they did not ask for.
   - `id` (explicit list): the company's row id from `get_outreach_working_set`. It links the found people to that company and fills the company's "People found" column, including when nobody is found.
   - `alternateNames` (explicit list only): legal or parent names you know, because profiles list the employer, not the brand.
   - `country` is a country, never a city. `projectId` writes the verified people to the People tab.
3. **Read `status` per company.** `matched`: someone holds the role. `related_role_only`: a deputy, vice or acting holder. `no_match`: searched, nothing verified. `source_error`: the lookup could not complete, so the answer is unknown. `rejected` lists people who were found but do not belong. They are not written to the tab. Keep every verified match the tool returns. Do not stop at the first person.
4. **No match.** For companies still `source_error`, call once more with `fromProject: true, onlyFailed: true`. For `no_match`, call with an explicit list and any `alternateNames` you can add. Do not broaden the roles.
5. **Profiles.** Bright Data matches arrive with their profile stored on the row. A person found only by Google has a name and a LinkedIn URL at most: run `fetch_profiles` before scoring.
6. **Report in one short table**: company, person, title, LinkedIn URL, source; then the related-role-only and no-match companies and the spend.

### Only when the user names LinkedIn or Harvest

The default path does not issue these. Use them only when the user names that provider for this lookup.

**Sales Navigator, role at one company.** Resolve the company id and the role id first. Do not invent ids.

```json
{
  "searchType": "sales_navigator",
  "searchParameters": {
    "api": "sales_navigator",
    "category": "people",
    "role": { "include": ["14"] },
    "company": { "include": ["1441"] }
  },
  "limit": 10
}
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
