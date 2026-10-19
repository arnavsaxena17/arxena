## Source: Harvest

### Limits and exhaustion

The cap for this source is not documented here yet. Treat a page or batch that adds no new rows (all duplicates) as exhausted, and report that.

### Source — Harvest (People API)

Taxonomy-backed people search without a LinkedIn session. Population examples (no named employer) are at the end of this section.

- `search_people_api` with `naturalLanguage` (preferred) or `search_people_by_job_title` alias.
- Always pass `dataSource: "harvest"`. Never invent `harvest_*` tool names.

### Source — Harvest (company discovery via people)

Harvest has no standalone company search — discover companies *through people* when certain roles exist, or when no LinkedIn session is available.

- Use People API tools with `dataSource: "harvest"`; extract `companyName` from hits to build the company list. A role at those companies, once they are named, is `people-by-company`.

**Harvest population** (no named employer). Call `list_people_data_sources` if you are unsure Harvest is configured. Never invent `harvest_*` tool names.

```json
{
  "dataSource": "harvest",
  "stdFunction": "engineering",
  "stdGrade": "leadership",
  "country": "United States",
  "limit": 20
}
```
