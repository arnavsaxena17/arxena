## Scoring

{{include: fitment-rules}}

### How to score

0. **Ask the plan what the rows can answer.** `get_scoring_plan({ projectId, tab, criteria })` (free) returns the evidence level of each row, the criteria already answered, and the steps worth running with their row count and cost. Run only those steps: it says which rows need a profile, which need one company web column, and which criteria no picked source can settle — report those `unknown`, never fail them silently.
1. **Write the rubric first.** Pick the archetype (`rubrics`). From the user's request, list 3 to 6 criteria, only facts the evidence level can show (later checks never go in). Mark each must-have or nice-to-have (the default is nice to have), give nice-to-haves a weight, and say what evidence counts (a title, a company type, a city, a skill). Use the user's words. Show the rubric to the user when the list is large or paid. For **people** at the profile stage, also add the worthiness must-haves below.
2. **Score snapshots.** `preview_ai_column` with `fitment: { stage: "snapshot", criteria: [{ key, description, mustHave, weight }] }` on about 10 rows, then `run_ai_column`. The model answers pass, fail or unknown per criterion; the server computes `fitmentOutcome`, `fitmentScore` and `fitmentReason` against the fitment threshold. You cannot lower that threshold; the user may ask for a higher one (`minimumScore`).
3. **Fetch profiles** for rows the snapshot cannot decide — the rows the plan marks for a profile fetch, not every unknown row (**When to fetch**; `fetch_profiles`, `rowLimit` up to 500; failed rows never climb). Bright Data Business Search by LinkedIn URL first, slow scrape for misses, then Harvest; store in `profile`. Skip people `find_people_by_company` already returned with a profile. Call again while `remaining` is above 0. Do not fetch to answer a later check.
4. **Enrich** only for a criterion that needs outside data. Cheaper cut first: a fact on the row, then a size proxy, then one web column. Employer facts that can fail many rows go before step 3; person facts after. Never build a column for a fact the web does not hold.
5. **Score full profiles** with `stage: "profile"` and `rerunAll: true`, including worthiness when the tab is people. A fetched row counts only when `fitmentOutcome` is pass at this stage. A snapshot passing every must-have and worthiness gate also counts.
6. **Read the yield, not the rows.** `get_outreach_tab` with `summarize: ["fitmentOutcome", "fitmentScore"]`; `outreach_list` `peek` for a few borderlines.

If the yield is low, fix the query before fetching more. Change one thing at a time and say what you changed.

### Scored list of about N

Search, then the steps above, for about N rows that must clear a rubric. Approve the fetch and enrichment caps once (`ask_questions`: go / change the caps / cancel); that yes covers every estimate, fetch and column run inside them. Round until the filtered count reaches about N or a cap is hit, filtering and enriching in `ai-filter-enrich`. Cheapest cut first: a row-answerable gate, a free size proxy already on the row, then one web-search column. Pass the enrichment cap as `approvedCostUsd` on every `run_ai_column`. Report the count and the spend, and offer export or save.

### Reading profiles

{{include: profile-reading}}

{{include: worthiness-gates}}

### What needs a yes

| Effect | Approval |
| --- | --- |
| Reads, searches, profile fetches and enrichment inside the caps approved once | None |
| Going past a cap | Ask |
| Sending a CV, profile or shortlist outside the project | Ask, every time |
| Messaging, enrolling, saving to the CRM, deleting | Ask |

### Evidence

{{include: evidence-ladder}}

**When to fetch.** Only when the snapshot cannot decide: a must-have is unknown, or the snapshot is thin (no connection count, as on Sales Navigator; no dates; one role). To spot fakes, `fetch_profiles` with `sources: ["bright_data"]` first (connections, followers); then omit `sources` for Harvest.
