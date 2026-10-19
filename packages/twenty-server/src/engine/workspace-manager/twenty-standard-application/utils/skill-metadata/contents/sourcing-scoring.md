## Scoring

{{include: fitment-rules}}

### How to score

1. **Write the rubric first.** From the user's request, list 3 to 6 criteria. Mark each must-have or nice-to-have (the default is must-have), give nice-to-haves a weight, and say what evidence counts (a title, a company type, a city, a skill). Use the user's words. Show the rubric to the user when the list is large or paid.
2. **Score snapshots.** `preview_ai_column` with `fitment: { stage: "snapshot", criteria: [{ key, description, mustHave, weight }] }` on about 10 rows, then `run_ai_column`. The model answers pass, fail or unknown per criterion; the server computes `fitmentOutcome`, `fitmentScore` and `fitmentReason` against the fitment threshold. You cannot lower that threshold; the user may ask for a higher one (`minimumScore`).
3. **Fetch the profiles of the rows whose outcome is pass or unknown** with `fetch_profiles` (`rowLimit` up to 500; the default skips rows that failed). It tries Bright Data first, many at once, then Harvest, and stores the profile and where it came from in the `profile` column. People `find_role_at_companies` already returned with a profile are skipped. Call again while `remaining` is above 0.
4. **Enrich** only for a criterion that needs outside data (company revenue, distance from the job location). Add it as its own column first.
5. **Score the full profiles.** The same call with `stage: "profile"` and `run_ai_column` with `rerunAll: true`. A row counts toward the target only when `fitmentOutcome` is pass at this stage.
6. **Read the yield, not the rows.** Use `get_outreach_working_set` with `summarize: ["fitmentOutcome", "fitmentScore"]` for counts and the score spread. Look at a few borderline rows with `outreach_list` `peek`. Do not page through the list.

If the yield is low, fix the query before fetching more. Change one thing at a time and say what you changed.
