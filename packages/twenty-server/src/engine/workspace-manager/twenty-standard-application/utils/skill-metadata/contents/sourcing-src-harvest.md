## Source: Harvest

Harvest runs LinkedIn Sales Navigator people and company searches on its own accounts: no LinkedIn seat needed, $0.004 per record returned. Use it when the user names Harvest, or when the request needs Sales Navigator filters and the LinkedIn status lists no `sales_navigator`. For a role at companies, `find_people_by_company` runs Harvest itself when the brief includes it; do not loop `search_harvest_leads` per company. Learn `generate_linkedin_query_set` and `search_harvest_leads` (people) or `search_harvest_accounts` (companies) for a population search.

### Spend

- A call fetches `limit` records (default 25, max 250). Say the cost before each call ("100 records, about $0.40"). Ask before going past 250 records for one request.
- Each result reports `costUsd`; rows land in a list kept 30 days. Continue with `page: paging.nextPage` until `totalElements` or the user's number is reached.
- One search stops at 100 pages of 25 (2,500 records). Split a bigger request by location or title band.

### Brief

1. `generate_linkedin_query_set({ rawRequirement, category, provider: "harvest" })` once per brief. It returns `tool` and `queries[]`: titles and locations as text, employers as LinkedIn company URLs.
2. Call `tool` with `queries[i].searchParameters` unchanged. Employers in `unresolvedCompanies` were left out: say so.

### Filters by hand

People (`search_harvest_leads`): `search` (LinkedIn operators), `currentJobTitles`, `locations` and `companyHeadquarterLocations` as text; `currentCompanies` as LinkedIn company URLs; `seniorityLevelIds`, `functionIds`, `industryIds` as Sales Navigator ids. Each has an `exclude…` twin. A pasted Sales Navigator people URL: `{ "salesNavUrl": "<url>" }`.

Companies (`search_harvest_accounts`): `search`, `headquarterLocations` (text), `industryIds`, `companyHeadcount` (`51-200`, `201-500`, …), `companyHeadcountGrowth` (`"10-100"`), `annualRevenue` (`"10-100;USD"`, millions), `departmentHeadcount` (`"10-100;Engineering"`), `jobOpportunities: "HIRING_ON_LINKEDIN"`. No account lists.

```json
{
  "searchParameters": {
    "currentJobTitles": ["Plant Manager", "Factory Manager"],
    "locations": ["Mumbai"]
  },
  "limit": 50
}
```

A role at companies already named stays on `people-by-company`.
