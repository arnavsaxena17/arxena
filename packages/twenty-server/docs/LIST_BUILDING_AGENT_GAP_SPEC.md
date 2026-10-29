# Company-to-People List Building Agent: gap spec

Oct 29, 2026. Compares the product spec ("Company-to-People List Building Agent: Product Spec", Oct 28, 2026) with what Ask AI does today on `port/arxena-modules`, and lists the code changes that make the agent work the way the spec describes.

Section numbers in brackets (§3a, §6) point to the product spec.

## 1. Summary

Most of the parts exist. What is missing is the frame around them.

- **The unit of work is different.** Today a run aims at "about N rows that clear the fitment threshold" (`sourcing-scoring.md`, `playbook-shortfall`). The spec aims at "every company × role pair reaches a terminal state" (§3). This is the biggest change: it touches the ledger, the stop rules, the report and the skill text.
- **The people lookup is close to the spec but runs sources in parallel, not as a cascade.** `find_people_by_company` (then named `find_role_at_companies`) already does one deterministic call per company list, verifies with a judge, writes the People tab and records a per-company status. It always queries Bright Data and Google together and has no internal index, cache, company site or LinkedIn step, no ladder rungs and no confidence level.
- **Stage A (company list) is one search, not a loop.** Bright Data ludicrous already slices a request and measures sample precision per slice, which is most of a "lens". There is no union across sources, no company status pipeline (candidate, enriched, filtered, confirmed, rejected), no unknown bucket and no frozen list version.
- **State lives in Redis with short TTLs** (lists 7 or 30 days, ledger 30 days and 100 events). The spec needs a plan, a pair matrix and evidence that survive compaction, resume and audit. Decision 1 keeps Redis, adds an S3 backup like lists have, and extends the TTL while a run is active.
- **Not built at all:** probes as a tool, reconcile/conflict handling, off-limits lists, per-persona export, a run-level budget guard, a pilot checkpoint, workers and a residual queue.
- **Built but not wired in:** JD parsing (`parse_job_description`, `job_brief_understanding` in the candidate-search module) and LinkedIn per-account rate limits (`account-rate-limit`, already applied to Unipile search).

Recommendation: do not add the spec's 20+ tools one to one. Add **no new tools**. Every spec tool fits into an existing one with a small change: `get_sourcing_ledger` (plan, stats, diagnosis), `find_people_by_company`, `get_outreach_tab` (filters, group-by), `apply_table_view` (bulk status), `outreach_list` (persona export), the company and people search tools (lenses, probes), `resolve_company_from_raw_name` and `parse_job_description`. The one new piece is the `budget_guard` **service**, which the paid tools call and the model only reads. Section 4 maps each spec tool to its home.

### Unit of work

**Company × role pair reaching a terminal state is the unit; the fitment threshold is how a pair counts as `found`.** "N rows that clear the threshold" stays only for population searches with no company list, which sit outside this agent.

Why, from what the client has to do with the list:

- **Sales head:** "every company covered, gaps explained" is their definition of done. Their next step is outreach account by account and a CRM import, so they need an answer for every company, including "none found because…". An N-rows run fills up from the easy companies and stays silent about the rest.
- **Exec search consultant:** they hand the client a long list across a peer set, and the client asks "what about company X?" They need a candidate or a reason for every peer company, and a client's off-limits company must show as `excluded`, not just be missing.
- **Honesty and pressure:** with a count target, the only way to "finish" a thin market is to relax criteria, which the skills have to keep forbidding. With pairs, a thin market ends cleanly as `none_found` with a reason, and the coverage line says so.
- **Resume and cost:** pairs give a natural checkpoint (resume where pairs are non-terminal), a per-pair cost ceiling, and per-company diagnosis. A count gives none of these.

Where N still matters: a candidate-pool brief ("10 strong candidates for this role") sets `targetCount` in the plan. The run still walks pairs across the peer set and stops early once N people at `strong` tier are found. The progress report stays pair-based.

## 2. What exists today

| Spec concept | Today | Where |
| --- | --- | --- |
| Outer loop: plan, learn skill, learn tool, execute | Same four words, generic, in the core prompt. No observe/diagnose step, no re-plan triggers | `ai-chat/constants/contents/core.md` |
| Plan persisted to state | `get_sourcing_ledger({ brief })`: request type, target, who, criteria (must/nice), geography, exclusions, caps, destination, assumptions | `tool/tools/sourcing-ledger-tool/get-sourcing-ledger-tool.ts`, `outreach-command/utils/sourcing-ledger.util.ts` |
| Ledger of calls | Events `brief`, `score`, `profile_fetch`, `stop`; searches derived from list metadata (source, query, fetched, duplicates, spend). Redis, 30 days, last 100 events | `outreach-command/services/sourcing-ledger.service.ts` |
| Company × role lookup | `find_people_by_company`: up to 500 companies from the project (or 50 listed), roles expanded by the title taxonomy, Bright Data + Google in parallel, Google page names resolved to LinkedIn, LLM judge, max 3 people per company, statuses `matched` / `related_role_only` / `no_match` / `source_error`, retries source errors, writes People tab and "People found" on the company row, Bright Data cap $0.03 per company | `tool/tools/find-people-by-company-tool/` |
| Title ladder | Title taxonomy service gives curated titles for the role's function and grade (rungs 1 and 2 merged). `related_role_only` is a reported rung 3. No rung 4 | `title-taxonomy/title-expansion.service.ts`, `fragments/title-seniority.md` |
| Company search | Bright Data ludicrous: LLM plans structured shards, estimate with `samplePrecision` per shard, budget ask, fetch, drops shards whose relevance falls. Instant mode for domain / URL lookup | `bright-data/ludicrous/`, `sourcing-src-bright-data-companies.md` |
| Company resolution | `resolve_company_from_raw_name` (ES `std_company_data_scores`), Bright Data instant by domain, Wikidata | `tool/tools/company-name-resolver-tool/`, sources constant |
| Company enrichment | Enrichment collector with Apollo, Wikidata, web search, LinkedIn pool and companies-index sources; AI columns with web search (OpenAI default, Perplexity opt-in) | `outreach-command/services/outreach-company-enrichment-collector.service.ts`, `outreach-ai-column*.service.ts` |
| Scoring | Fitment columns: pass / fail / unknown per criterion, must/nice with weights, threshold in code, one-line reason, snapshot then profile stage | `candidate-sourcing/services/fitment/`, `sourcing-scoring.md` |
| Stats instead of rows | `get_outreach_tab({ summarize, onlyViewMatches })` returns value counts and quartiles; search tools return counts and a `listId`, never rows | `outreach-tab.service.ts`, `sourcing.md` "Result lists" |
| Upload | Spreadsheet import into Companies / People tabs, upsert by domain or name | `spreadsheet-import.md`, `outreach-spreadsheet-import-tool` |
| Dedupe | `outreach_list dedupe` against CRM (domain only) or other lists | `outreach-list` |
| Contact enrichment | `enrich-contact.service.ts`, `enrich_contact_from_data` | `outreach-command`, `arxena-tools` |
| Evals | Live sourcing eval harness, 12 scenarios, mostly recruiting populations | `ai-chat/__tests__/sourcing-eval/` |
| Agent runtime | One chat agent, `MAX_STEPS` 300, compaction, large tool output spilled | `chat-execution.service.ts`, `stream-agent-chat.job.ts` |

## 3. Gaps by spec section

Size: S (days), M (a week or two), L (more).

| § | Spec | Today | Change | Size |
| --- | --- | --- | --- | --- |
| 2 | Infer persona and target type (candidate pool, incumbent, decision-maker); one question at most | `for-recruiting` / `for-sales` decided by rule; no target type | Add `persona` and `targetType` to the plan; brief types in `requirements` | S |
| 2 | Unbounded brief gets a proposed scope; tiny brief gets an expected size | Dipstick and estimate exist for populations only | Count probe on the existing searches (section 4) + scope card in Stage A | M |
| 3 | Five brief types with plan templates | Six request types of a different cut (population, named role, company list, scored list, look-alike, expand) | Replace `requestType` enum with the spec's five types; keep population / look-alike as separate tracks outside this agent | S |
| 3 | Terminal states `found`, `none_found`, `ambiguous`, `unresolvable`, `excluded` with reason | `matched`, `related_role_only`, `no_match`, `source_error` on the company row only | New pair state (section 5.1). Map: matched→found, related_role_only→found at rung 3 or ambiguous by plan, no_match→none_found+reason, source_error→retry, then none_found(`source_error`). Add unresolvable and excluded | M |
| 3 | Run ends when no pair is non-terminal | Ends when the target count is met or stop rules fire | Ledger funnel becomes pair-based; `playbook-shortfall` stop rules apply to Stage A only | M |
| 3a | Several discovery lenses, union, provenance per company | Several company search tools; each call writes its own list, with no lens tag | `lens` tag on the existing company searches, one pool with `lensIds[]` | M |
| 3a | Company status `candidate → enriched → filtered → confirmed/rejected` | No company status; "People found" only | Company status column on the Companies tab | M |
| 3a | Cheap hard filters before paid enrichment; unknown kept in its own bucket | Skill text says "cheaper cut first"; nothing keeps unknowns apart | `filter_companies` in code: hard criteria exclude only on evidence; unknown → review bucket | M |
| 3a | Turnover with currency, fiscal year, source; estimated band flagged | AI column returns a number; no year, no source field | Structured turnover type in the enrichment column spec | S |
| 3a | Calibration: ~10 mixed companies, accept/reject with reason, before any people search | `playbook-company-first` confirms the whole list (yes / edit / cancel); no sample, no reasons | `calibrate` step via `ask_questions` with a mixed sample; reasons written to the plan and rubric | M |
| 3a | Lens stats, skew check, stability stop, frozen versioned list | Shard `samplePrecision` inside one ludicrous run | Lens stats in the ledger; list `version` on freeze | M |
| 3b | `parse_jd` with must/nice tagging, peer profile, exclusions, JD card | `parse_job_description` / `job_brief_understanding` exist, but have a flat schema and are not used by sourcing | Extend the schema + `jd-to-rubrics` skill section | M |
| 4 | Observe/diagnose with stage-tagged failure causes; re-plan triggers | Shortfall playbook, no causes, no triggers | `diagnose` output in the ledger; triggers in skill text and checked in code where measurable | M |
| 4 | Checkpoints: after list, after 10-company pilot, at 50%, at completion | List confirm only; one `find_people_by_company` call for everything | Pilot mode (`pilotSize: 10`) then batches; progress events at 50% | S |
| 4 | Workers in batches of 20-50, residual queue, verifier; resumable from state | One call does 500 companies with internal concurrency; skips Found rows on rerun (partly resumable) | Run the pair loop as a background job; residual queue as pair state; verifier sample | L |
| 5 | Cascade: cache → internal index → Bright Data → SERP → company site → LinkedIn; stop at first confident | Bright Data and Google in parallel always; no cache, index, site or LinkedIn | Rewrite the lookup as a cascade (section 5.2) | M |
| 5 | Conflicts marked, both citations kept | Duplicates merged by LinkedIn URL; disagreements not kept | `reconcile` inside the lookup | M |
| 5 | Probes (count, exists, fresh) precede pulls | Ludicrous estimate, instant probe, SERP and index search exist; no freshness signal | Probe recipe in the skill + `freshness` on lookup and profile results | S |
| 5 | Every evidence item: source, query, date, snippet | Judge note on the person; fitment reason one line | Evidence records (section 5.1) | M |
| 6 | `budget_guard` enforced in tools; model reads, never raises | Per-call caps (`maxBudgetUsd`, `approvedCostUsd`); no run-level cap, no LinkedIn per-day cap for sourcing found | Run budget in the plan, checked by each paid tool | M |
| 7 | Phase-gated skills | `sourcing` sections loaded by route; no phase gate | Re-cut sections (section 6) | M |
| 8 | `plan`, `company`, `pair`, `person`, `evidence`, `ledger`, `lists` | Ledger + lists in Redis; rows in tab `otherFields` | Durable run state (section 5.1) | L |
| 8 | Prior-run cache by company + role within a freshness window | None across projects | Cache keyed by company id + role class | M |
| 8a | `matrix_stats`, `query_rows`, `bulk_update`, `aggregate` | `get_outreach_tab` summarize / limit / onlyViewMatches; `apply_table_view` | Extend `get_outreach_tab`; `setStatus` on `apply_table_view` | M |
| 9 | Four-rung ladder, size-aware, rung recorded, plan sets max rung by persona | Rungs 1+2 merged; rung 3 reported; no size awareness | `ladder` input and `rungUsed` output | M |
| 9 | Confidence high only on two agreeing sources or one fresh primary; stale = unverified | No confidence field; staleness only in skill text | Confidence computed in code | S |
| 9 | Tiers strong / possible / stretch (exec search) | Fitment score only | Tier from fitment + rung + freshness | S |
| 10 | Coverage line first; persona exports; excluded tab | Report written by the model from ledger counts | Persona export on `outreach_list` + coverage from pair state | M |
| 12 | Off-limits and CRM checked at write time | CRM dedupe on demand, domain only; no off-limits list | Exclusion lists in the plan; checked in the People-tab write path | M |
| 13 | Golden set of 30 briefs, metrics per section 13 | 12 live scenarios, quality and path graders | New company × role scenarios and metric graders | M |

## 4. Tool map: spec tool → home

| Spec tool | Home | Change |
| --- | --- | --- |
| `plan_get` / `plan_update` | `get_sourcing_ledger` | The `brief` input grows into a `plan` input with the section 5.1 fields, accepting partial updates; each update appends a versioned event. The tool already returns the latest brief, so it returns the current plan the same way |
| `resolve_company` | `resolve_company_from_raw_name` | Return `matchConfidence` and `alternates[]` (subsidiary, group, homonym); used by spreadsheet import (calling the service directly) and by the company searches for upload lenses. Bright Data instant stays its own lookup |
| `search_companies` / `discover_companies` | **Existing company search tools**, no new tool: `search_companies_index` (shallow, fast, little company detail), topped up by `search_bright_data_business` (`entity: "company"`) for completeness and detail; also Harvest accounts, Apollo, Wikidata, SERP | Add an optional `lens: { kind, label }` input to each company search. The tool tags the rows it writes with that `lensId` and status `candidate`, and logs the lens in the ledger. Skill text: index first for a cheap pool, Bright Data for completeness and fields |
| `merge_pool` | On append, in the list store | Dedupe already happens on append (domain, then LinkedIn URL, then name). Add a group/legal-entity key and keep every `lensId` on merge, so an index row topped up by Bright Data is one company with both lenses |
| `enrich_company` | Enrichment collector + AI columns | Expose collector as cheap-first enrichment for pool rows; status → `enriched` |
| `score_companies` / `filter_companies` | Fitment AI column with `tab: "companies"` | Add hard/soft criterion kinds; hard fails only on evidence; unknown → `review` bucket; status → `filtered` |
| `lens_stats` | `get_sourcing_ledger` | Per lens: candidates, unique, qualified, sampled precision, cost |
| `propose_peers` | **Skill text** (`company-list`, peer-set entry mode) | The model proposes peers; they enter the pool as a `peer` lens |
| `probe` | The existing searches | `count`: the Bright Data ludicrous estimate (a call without `listId` writes nothing) or the `search_companies_index` hit count. `exists`: `google_serp_search` for a role at a company, with a no-write flag if it can write today. `fresh`: a new `freshness` field (record or snippet date) on `find_people_by_company` and `fetch_profiles` results. The Bright Data instant probe (up to 25 preview rows, never written) covers a quick look. The recipe lives in the skill (`query-planning` dipstick) |
| `find_people_by_company` | `find_people_by_company` (renamed from `find_role_at_companies`, decision 3) | Cascade, ladder, confidence, pair state, evidence, ledger (section 5.2) |
| `linkedin_search` | `search_linkedin_*`, `generate_linkedin_query_set`, or Harvest | Runs only if the user picked it at the start (section 5.8). The user's own account always runs in slow mode on the account limiter |
| `fetch_page` | Raw fetch archive / web search | Use inside the cascade's company-site step |
| `score_people` | Fitment column, `tab: "people"` | Add size-aware seniority (company size passed in) and tier |
| `reconcile` | Inside the lookup | Conflict flag, both citations, confidence rule |
| `diagnose` | `get_sourcing_ledger({ diagnose: true })` | Groups non-found pairs by stage tag and reason, 5-10 examples each |
| `enrich_contact` | `enrich-contact.service.ts` | Expose for sales export; provenance per field |
| `matrix_get/put`, `matrix_stats` | `get_sourcing_ledger` (stats) + `get_outreach_tab` (rows) | Pair counts by state, rung, source; cost; top causes |
| `query_rows`, `aggregate` | `get_outreach_tab` | Already has `summarize` and a row cap. Add `filter` (field predicates), `fields`, `groupBy` + metric |
| `bulk_update` | `apply_table_view` | Add `setStatus` + `reason`: reuse the filter compiler, show `matchCount` before writing, apply the status to every matching row, log it so it can be undone. Most statuses are set in code by the company fitment column; this is for user-driven rules. If views must stay read-only, put `setStatus` on `outreach_list` instead |
| `ledger_log` | Written by tools, not by the model | Each paid tool appends `call` events (tool, source, query, hypothesis, results, new unique, cost) |
| `dedupe` | `outreach_list dedupe` + write-path check | Add off-limits companies and people |
| `calibrate` | `ask_questions` | A mixed sample shown with accept/reject + reason; answers written to the plan |
| `ask_user` | `ask_questions` | No change |
| `budget_guard` | **New service**, read by a field on `get_sourcing_ledger` | Run caps per source, LinkedIn per run and per day; tools refuse past the cap |
| `export` | `outreach_list` `export` (already builds a CSV with `buildOutreachListCsv`) | Today it exports one list by `listId`. Add `projectId` + `tab` + `persona`: persona columns, the coverage line first, excluded rows apart (section 5.6) |
| `parse_jd` | **Existing** `parse_job_description` + `job_brief_understanding` (`candidate-search/services/job-description.service.ts`, schema `candidate-search/schemas/job-description.schema.ts`) | Extend the schema and expose it to the sourcing skill (section 5.5) |

## 5. Changes in detail

### 5.1 Run state

Today a run's facts are spread over Redis lists (7 or 30 days), the ledger (Redis, 30 days, last 100 events) and row `otherFields`. The spec needs state that outlives compaction and can be audited.

- **Where:** rows stay in the tab store, which already backs the UI. The plan, pair states, evidence and the ledger stay in Redis with an S3 backup, like lists (decision 1). Raise the ledger cap and extend the TTL each time a run is read.
- **Plan** (replaces `brief`): `briefText`, `briefType` (the five types), `persona`, `targetType`, `interpretation`, `assumptions[]`, `companyRubric`, `personRubric`, `expectedSize`, `doneDefinition`, `sourceStrategy` (allowed sources, LinkedIn allowed for which companies), `ladder` (max rung), `thresholds` (confidence, freshness days), `budgets` (per source, per company, per run, LinkedIn per day), `exclusions` (off-limits companies and people, CRM export id), `jdSource` / `jdExtraction` / `jdCardVersion`, `sampleDecisions[]` (decision + sample size), `version`.
- **Company row** (Companies tab `otherFields`): `status` (`candidate`, `enriched`, `filtered`, `review`, `confirmed`, `rejected`), `statusReason`, `lensIds[]`, `matchConfidence`, `alternates[]`, `turnover { value, currency, fiscalYear, source, estimated }`, `calibrationNote`, `listVersion`.
- **Pair** (one per company × role, stored on the company row keyed by role so the UI can show it): `role`, `titlesTried[]`, `rungUsed`, `terminalState`, `reason`, `personIds[]`, `sourcesUsed[]`, `costUsd`, `attempts`. The existing "People found" column becomes a view of `terminalState`.
- **Person row**: add `confidence`, `tier`, `conflict`, `freshness` (`current` / `unverified`), `rungUsed`, `evidenceIds[]`.
- **Evidence**: `id`, `subjectId`, `source`, `query`, `retrievedAt`, `snippet`, `url`. The judge's note and the Google snippet that already exist become evidence rows instead of a free-text note.
- **Ledger**: add `call` events written by the tools, and `plan`, `calibration`, `checkpoint`, `diagnosis` events. `computeSourcingFunnel` gets a pair-based sibling: pairs by state, by rung, by source; resolution rate; cost per resolved company.

### 5.2 `find_people_by_company` (renamed from `find_role_at_companies`)

File: `tool/tools/find-role-at-companies-tool/find-role-at-companies-tool.ts` (1,500 lines; split the cascade out into a service while changing it).

1. **Input additions:** `ladder` (`maxRung` 1-4, from the plan), `thresholds` (`minConfidence`, `freshnessDays`), `allowLinkedin` (per company, or from the plan's high-value list), `forceSource` and `reason` for overrides, `pilotSize`. Replace `maxBudgetUsd` (Bright Data only) with a per-company ceiling over all sources.
2. **Cascade instead of parallel.** Today `lookupCompany` runs Bright Data and Google together. New order, stopping at the first result at or above `minConfidence`:
   1. Workspace cache of prior runs (company id + role class, inside `freshnessDays` = 365; skipped for confidential projects).
   2. Bright Data people (current ludicrous call).
   3. SERP (current Google search + page-name extraction + LinkedIn URL resolution).
   4. Company site leadership page, read through the web search options (not a separate source).
   5. Harvest, then the user's own LinkedIn (slow mode), when `budget_guard` and the account limits have room.
   Only the sources the user picked at the start run; the rest are skipped (section 5.8). The internal people index is not a step (decision 4). The stop level is medium confidence (decision 7).
   Within each source try rungs 1-2; rungs 3-4 only after every source is exhausted and only up to `maxRung`. Code picks the next source; the model never does.
3. **Ladder rungs.** Split the taxonomy output: rung 1 = titles as typed, rung 2 = curated equivalents. Rung 3 = adjacent function or one grade down (the current `related_role_only` detection, plus taxonomy grade − 1). Rung 4 = owner / promoter / MD, only when company size is under the plan's small-company band. Return `rungUsed`.
4. **Size-aware seniority.** Pass company size (employees, turnover band) into the judge (`candidate-judge.service.ts`) and title matching (`role-title-matching.util.ts`).
5. **Reconcile and confidence** (in code): high = two independent sources agree on name, title and company, or one fresh primary source (company site, fresh profile); medium = one source, fresh; low = stale or snippet only. Stale (older than `freshnessDays`) → `unverified`. Disagreement → `conflict`, keep both evidence rows, prefer the fresher.
6. **Terminal states:** return `found` / `none_found` (reason: `no_such_role`, `too_small`, `profile_gaps`, `budget`, `source_error`) / `ambiguous` (several plausible people, or a company match below threshold) / `unresolvable` (company match failed) / `excluded` (off-limits or CRM, checked before any spend). Keep `source_error` as an internal retry state only.
7. **Side effects:** write the pair, the evidence rows and one ledger `call` event per source step. Keep the idempotent upsert that exists today.
8. **Pilot:** `pilotSize: 10` runs the first N pairs and returns, so the agent can show the checkpoint before the rest.
9. **Max people per company** stays 3 for incumbent / decision-maker; for `targetType: candidate_pool` it should be larger and come from the plan.

### 5.3 Stage A: company discovery loop

1. **Lenses on the existing searches**: each company search call carries a `lens` and writes to the one pool. Lens kinds from §3a: `description`, `industry_codes`, `product`, `directory` (SERP + fetched pages), `look_alike` (from confirmed companies), `supply_chain`, `seed_expansion`, `peer`, `upload`, `revenue_band` (Sales Nav filter through Harvest or the user's account, section 5.8). Per lens: `search_companies_index` first (shallow, fast, cheap pool), then `search_bright_data_business` to top up completeness and fill the fields filtering needs. Bright Data keeps its estimate → budget → fetch flow.
2. **Spreadsheet upload as a lens.** `import_outreach_spreadsheet` writes rows as `candidate` with `lensIds: ["upload"]`, then runs `resolve_company` on each (subsidiary, group, homonym, dead domain flags) instead of trusting the sheet's name.
3. **Cheap filters first**, in code: geography, entity type and segment mismatch from fields already on the row. Only survivors get paid enrichment (this is the rule the user already set for the QSR run: gate, free LinkedIn proxies, then one web column).
4. **Hard vs soft criteria** in the company fitment column. A hard criterion fails only on evidence of mismatch; unknown → `review`. Segment fit scored from products, not name; description-only evidence marked weaker.
5. **Calibration**: a sample of about 10 (likely yes, borderline, near-threshold rejects) through `ask_questions`, reasons stored, rubric updated, then re-filter.
6. **Diagnostics**: lens yield and precision, skew against expected spread (sub-segment, region, size band) via `aggregate`, stability stop when a new lens adds less than the agreed share.
7. **Freeze**: status `confirmed` on the kept rows, `listVersion` bumped; later additions pass the same gate.

### 5.4 Loop, checkpoints and workers

- **Checkpoints** in skill text, backed by tool output: after the list freeze (calibration), after the 10-company pilot (role interpretation and ladder), at 50% and at completion (the coverage line from pair state).
- **Re-plan triggers** returned as flags by `get_sourcing_ledger`: resolution rate below the plan threshold, a source's hit rate or error rate past a limit, more than N pairs with the same reason, budget past a share, calibration contradicting an assumption.
- **Workers (decision 2).** The spec uses subagents for parallelism and context. Here the lookup is already a deterministic tool with internal concurrency, so a **BullMQ job** runs `find_people_by_company` over the confirmed pairs in batches of 20-50, writes state, and emits progress. The chat agent starts it, reads stats and handles checkpoints. This keeps one chat context small and makes the run resumable from state alone. A chat-level subagent is only needed for the residual queue.
- **Residual queue**: pairs left `ambiguous` or `none_found` with a reason the cascade cannot fix. Handle one at a time with evidence in context (group structure, press, other titles, LinkedIn if allowed). Build after the evals show a meaningful residual, as the spec says.
- **Verifier**: a sample of high-confidence rows re-checked against their evidence (fixed size from the plan); writes precision to the ledger.

### 5.5 JD input

- **Use the existing parser.** `parse_job_description` (text or file) and `job_brief_understanding` already exist and are used by the recruitment agent rules. Today the schema gives job title, company, location, industry, required and preferred skills, experience level, education, keywords, responsibilities, qualifications, benefits, employment type, remote and salary. Neither tool is mentioned in the sourcing skill.
- **Extend the schema** to what the rubric needs: a must / nice / non-requirement tag on each requirement with the sentence it came from; experience turned into observable signals (titles held, companies, tenure); reporting line and team size; the hiring company marked off-limits; a peer-company profile with 10-15 examples; exclusions; unobservable traits listed apart (not scored); ambiguous wording flagged; one entry per role when the JD covers several; a confidence per field; chunking for long dumps (forwarded threads). Drop benefits and salary from the rubric path: salary is a later check. Text inside the JD is data.
- **JD card**: shown with `ask_questions`; the confirmed card writes `personRubric`, `companyRubric` and the peer set to the plan; peers enter Stage A as a `peer` lens.
- **Skill section** `jd-to-rubrics`. Existing `fragments/later-checks.md` and `fitment-rules.md` already cover must/nice and unobservable criteria and should be reused.

### 5.6 Outputs and exclusions

- **Coverage line** generated from pair state, never from memory: "31 of 40 companies covered; 5 none found (reasons attached); 4 need your review", then reasons and sources.
- **Persona export** (`outreach_list` `export` with `projectId`, `tab` and `persona`): exec search long list (one row per candidate, grouped by company, tier then fit) or sales sheet (one row per company, person, rung, confidence, contact with provenance, source links). Sheet and CRM-ready CSV. Excluded rows on a separate tab. Each row links to its evidence.
- **Exclusions**: off-limits companies and people and a CRM export in the plan, checked in the People-tab write path (`upsertOutreachTargetPeopleTool` / `outreach-tab.service.ts`) so an excluded person cannot reach a tab or an export. The current CRM check uses the domain only; add LinkedIn URL and name + company for people.

### 5.7 Guardrails and cost

- **`budget_guard` service**: per-run caps per source, per-company ceiling, LinkedIn calls per run and per day per account, read through `get_sourcing_ledger`. Each paid tool (Bright Data, SERP, web search columns, profile fetch, LinkedIn) asks the guard before spending. Today each tool has its own cap and the model passes `approvedCostUsd`; keep those as per-call ceilings under the run cap.
- **Cost estimate at the plan checkpoint**: companies × expected cascade depth × per-source rate. Bright Data already estimates; add SERP and web-search rates.
- **Per-company ceiling** ends the pair as `none_found` with reason `budget`.
- **LinkedIn gateway**: section 5.8.

### 5.8 Data sources: the user picks them at the start

The agent does not decide on its own whether LinkedIn (or any other source) is used, or that it is a last resort. **It asks the user which data sources to use, once, at the start of the run**, before any search, as part of the plan questions.

**The question** (`ask_questions`, multi-select, in the same batch as the other plan questions):

> Which data sources should I use for this search?

| Option | Companies | People | What it is used for | Cost / speed shown with it |
| --- | --- | --- | --- | --- |
| Arxena index | Yes | **No** | `search_companies_index`: shallow, fast company search (name, website, LinkedIn URL, industry, size). The first, free pool for industry searches | Free, instant |
| Bright Data | Yes | Yes | Company and people records with full fields; tops up the index for completeness | $0.002 per record |
| Google search | LinkedIn URLs | LinkedIn URLs | Company + job title → person's LinkedIn URL; company + name → person's LinkedIn URL; company name + "linkedin" or domain + "linkedin" → company LinkedIn URL. Company websites and filings are read through the web search options, not as a separate source | Per query, fast |
| Harvest | Yes | Yes | Sales Navigator filters without using the user's LinkedIn account | Paid per call |
| My LinkedIn (Sales Navigator / Classic / Recruiter) | Yes | Yes | The user's own connected account, in slow mode | Free, but rate-limited (hours for large pulls) |
| Apollo, Exa, Wikidata | Varies | Varies | Shown only when the workspace has them switched on | Per source |

- **Show only what is available.** Sources the workspace has not configured, or a LinkedIn account that is not connected, are left out (the provider flags in `search-tools-config` already know this). Each option shows its cost and speed so the user can choose knowingly.
- **Pre-select from the last run.** The previous run's choice in this workspace (stored with the plan) is pre-selected; first time, the cheap set (index, Bright Data, Google) is pre-selected and LinkedIn and Harvest are not.
- **Ask once per run.** The answer is not asked again, unless the user changes the brief or a re-plan trigger shows the chosen sources cannot cover it (then ask whether to add a source, with the measured gap).
- **Stored in the plan** as `sourceStrategy.allowed: string[]`, plus `sourceStrategy.linkedinMode: "own_account" | "harvest" | null`.

**How the choice is used.**

- **Enforced in code, not in the prompt.** Every search tool reads the run's plan and refuses a source the user did not pick, with a message saying it was not selected. The cascade in `find_people_by_company` skips sources that are not allowed.
- **Order is still code's job.** Chosen sources run cheapest first (cache → index (companies only) → Bright Data → Google (and company pages via web search) → Harvest → own LinkedIn), stopping at medium confidence. LinkedIn sits last in that order because it is the slowest and the account's limits are the scarcest, not because the agent ruled on it. If the user picks only LinkedIn, LinkedIn is the whole cascade.
- **Stage A too.** The same choice covers company discovery: the Sales Nav revenue filter runs through Harvest or the user's account only if that source was picked.
- **Report by source.** The coverage line and the ledger show results and cost per chosen source, so the user can see what each source added and pick differently next time.

#### When the user picks their own LinkedIn: slow mode

**Rate limits already exist.** `account-rate-limit/` keeps per-account sliding windows in Redis and `linkedin-search.service.ts` wraps Unipile search in `withAcquiredAccountRateLimit`. Defaults (`twenty-shared/src/arx/accountRateLimits.ts`), editable per account within bounds:

| Limit | Default | Allowed range |
| --- | --- | --- |
| Searches per minute | 4 | 1-10 |
| Searches per day | 10 | 1-40 |
| Profile views | 1 per 10 s, 100 per day | 1-3 per 10 s, up to 200 per day |
| Company profile views | 1 per 10 s, 100 per day | same |
| All LinkedIn calls per day | 100 | up to 500 |

Plus at least 1 second between requests (`LINKEDIN_REQUEST_DELAY_MS`). When a window is full the call is deferred, not failed.

**The gap: continuation pages are not counted.** `shouldCountLinkedInSearchQuota` skips any call with a cursor or offset, so one counted search with `search_linkedin_continue({ maxPages: 50 })` makes about 50 requests, one second apart, in under a minute. That is the burst the user wants to avoid.

**Slow mode** (always on when the user picked their own LinkedIn):

1. Count every page, including continuations, against a new `searchPagePerDay` window (for example 40 per day), and against the shared daily endpoint cap.
2. Space pages with jitter: a random 20-60 seconds between pages, and a longer pause (5-10 minutes) every 10 pages. Set per account in the same limits config as `searchPageIntervalMs`.
3. Cap `maxPages` at 5 per call in slow mode, so a long pull becomes several deferred calls run by the BullMQ job, not one burst inside a chat turn.
4. Stop and pause the run on any warning, challenge or 429 from Unipile, mark LinkedIn degraded in the ledger, and tell the user.
5. Show the remaining daily LinkedIn budget in `get_sourcing_ledger`; the model can read it, never raise it.

Because slow mode can take hours for a large pull, LinkedIn steps only run inside the background job, never inline in a chat turn.

### 5.9 Search methods: industry and job title

Two kinds of search need knowledge the model does not reliably have: how industries are labelled, and which sources can filter on the current job title. Both now live in the `sourcing` skill as parts that load only for the searches that need them.

**How this content reaches the agent.** The `sourcing` skill is one head file plus parts. The front matter says which part brings which (`requires`), and the route hint tells the model which `sections` to pass to `load_skills`. A part costs tokens on every model step once it is loaded, so each one is scoped to the searches that use it:

| Part | File | Loaded when | Tokens (about) |
| --- | --- | --- | --- |
| `industry-search` | `contents/sourcing-industry-search.md` | The route hint says to add it whenever the request names an industry, sector or segment; `playbook-company-first` also brings it | 900 |
| `industry-labels` | `contents/sourcing-industry-labels.md` (includes `fragments/linkedin-industries.md`) | On demand: `industry-search` tells the model to load it when it is unsure of the exact labels for a sector | 1,800 |
| Job title search | Merged into `contents/sourcing-people.md` | Always with `people` | 600 |

Same pattern for later knowledge: put it in a part, keep it scoped to a route, and add a token budget for that route in `skill-library.spec.ts`. Skill text is served from code, so no workspace sync command is needed.

**Industry searches** (from the LinkedIn V2 industry list the user supplied, reshaped for search):

- Map the user's segment to every label its companies might pick: the industry, its parent and siblings, plus old (V1) labels. Each company page has one self-chosen industry, so one label misses companies. Spelling rules: under Manufacturing, add "Manufacturing" to the end; under Wholesale, start with "Wholesale".
- Sources, cheapest first: the Arxena index (free and shallow, companies only), then a Bright Data top-up for completeness and fields, then the Harvest or Sales Navigator industry facet, then Apollo, Exa or Wikidata when switched on. Move to the next only when the pool is far below the expected size, or lacks a field the rubric needs.
- By kind of search: companies in an industry; people whose employer is in an industry (companies first); peers of a named company; adjacent industries for a shortfall (siblings, then the parent sector); industry plus size or revenue.
- Dropped from the source document: profile-setting advice, API endpoints and ID-collision notes. If industry ids are ever stored in code, key them by (taxonomy version, id).

**Job title searches:**

| Source | Current title filter | Notes |
| --- | --- | --- |
| Bright Data people | `current_title` | Plain words; the planner compiles boolean strings |
| Sales Navigator (own LinkedIn) | `role` include | Best precision; slow mode |
| Harvest | `currentJobTitles` | Sales Navigator filters, paid |
| Recruiter | Title keywords, `scope: "CURRENT"` | |
| LinkedIn Classic | Keywords only | Flaky: matches past roles, headline and about. A row is not a title match until its profile shows the title as the current position |
| Google search | Company + title → LinkedIn URL | Already inside `find_people_by_company` |

**Follow-ups in code (not done):**

- `BRIGHT_DATA_LINKEDIN_INDUSTRIES_HINT` (`bright-data/ludicrous/constants/bright-data-ludicrous-field-registry.const.ts`) is a hand-picked list of about 60 labels used by the planner. Generate it from the same V2 list so the planner and the skill agree.
- The sources constant (`sourcing-sources.constant.ts`) still lists the internal index as a people source for dedupe; mark it companies-only for search, per the source table in 5.8.
- When Classic is used for a title search, the cascade should send its rows to profile fetch before they count, rather than leaving that to the skill text.

## 6. Skills: final parts

All under `workspace-manager/twenty-standard-application/utils/skill-metadata/contents/`. The `sourcing` skill keeps its head + parts structure. The spec's skills are clubbed into existing parts wherever they always load together or do the same job, so the skill ends with **28 parts, 2 of them new** (`company-list`, `jd-to-rubrics`), instead of the 35 the spec's list would give.

### Final parts

| Group | Part | Holds | Status |
| --- | --- | --- | --- |
| Head | `sourcing.md` | Vocabulary, routing, source order, result lists, write contract | Existing |
| Plan | `requirements` | The brief: the five brief types, persona, target type, scope and expected size, the source question at the start (section 5.8), what to ask and what to decide | Extended |
| Plan | `intent-glossary` | What a client's word usually means | Existing |
| Plan | `query-planning` | Probes (count, exists, fresh), sizing, slicing, variants, and large lists of about 1,000 rows or more | Extended |
| Plan | `rubrics` | Person rubric archetypes, plus the company rubric (hard and soft criteria) | Extended |
| Plan | `jd-to-rubrics` | Reading a JD into the person rubric, the company rubric and a peer set; the JD card | **New** |
| Search types | `companies` | Calling the company search tools | Existing |
| Search types | `places` | Places on a map | Existing |
| Search types | `people` | Calling the people search tools, now including which sources filter the current job title | Extended |
| Search types | `people-by-company` | Calling `find_people_by_company`: pilot, then the batch job | Extended |
| Search types | `inbound-applicants` | Applicants to a posting | Existing |
| Run playbooks | `playbook-company-first` | The whole company × role run in order (plan, Stage A, pilot, batches, checkpoints), the spec's §11 text, and at the end the coverage line and persona export | Extended |
| Run playbooks | `company-list` | Stage A: entry modes, lenses, cheap-first filtering, calibration, freeze (see below) | **New** |
| Run playbooks | `playbook-shortfall` | Why results fell short, by stage-tagged cause, and the one change to make next | Extended |
| Detail | `industry-search` | Industry lens: label mapping, sources cheapest first, kinds of industry search | Existing (added this week) |
| Detail | `industry-labels` | The LinkedIn V2 label list, loaded on demand | Existing (added this week) |
| Detail | `scoring` | Fitment, profile reading, worthiness, approvals | Existing |
| Detail | `source-profiles` | What each source covers and gets wrong; staleness by field; plus conflict and confidence rules | Extended |
| Detail | `for-recruiting` | Candidates for a role | Existing |
| Detail | `for-sales` | Prospects you sell to | Existing |
| Sources | `src-bright-data-people`, `src-bright-data-companies`, `src-harvest`, `src-apollo`, `src-exa`, `src-wikidata`, `src-naukri` | One part per source, loaded only when that source is picked | Existing |
| Sources | `src-linkedin` | Adds slow mode and the account limits | Extended |
| Sources | `src-serp` | Adds probing and the four LinkedIn URL lookups | Extended |

Removed as separate parts (done Oct 29): `title-search` (into `people`, since it always loaded with it) and `playbook-large-list` (into `query-planning`, which that route always loaded). A request for either old section name is reported back as unknown, so the model reloads with the new one.

### Where each spec skill went

| Spec skill | Part |
| --- | --- |
| `classify-brief`, `scope-and-size`, (new) `choose-sources` | `requirements` (scope and size also use the probe recipe in `query-planning`) |
| `write-rubric` | `rubrics` |
| `jd-to-rubrics` | `jd-to-rubrics` |
| `resolve-companies`, `company-discovery-lenses`, `find-companies-by-description`, `company-enrichment-and-filtering`, `peer-set-for-search`, `calibrate-with-samples` | `company-list` |
| `source-routing` | Mostly code (the cascade); the explanation stays in the head file's source order |
| `serp-probing` | `src-serp` |
| `title-ladder` | `people` (current-title rules) and `fragments/title-seniority.md` (synonyms), with the rungs, size bands and persona max rung added |
| `read-messy-profiles` | `fragments/profile-reading.md`, already included in `scoring` |
| `linkedin-last-resort` | `src-linkedin`, loaded only when the user picked LinkedIn or Harvest |
| `reconcile-evidence` | `source-profiles` |
| `diagnose-and-adjust` | `playbook-shortfall` |
| `coverage-and-export` | `playbook-company-first` |

### Kept separate on purpose

- `industry-labels` apart from `industry-search`: the 1,800-token list loads only when needed.
- `jd-to-rubrics` apart from `rubrics`: `rubrics` loads with every recruiting or sales search, and the JD text would be re-sent on every step.
- `for-recruiting` and `for-sales`: a run is only ever one of them.
- `src-*`: one per source, so only the picked sources load.
- `people-by-company`: still loaded alone for "a role at named companies".
- Outside `sourcing`: `spreadsheet-import` (the upload entry mode in `company-list` hands off to it), `ai-filter-enrich` (column mechanics for the filter step) and `validate-profiles` stay their own skills.

Also:

- `sourcing-people-by-company.md` currently tells the model "no estimate, no second search, no loop" and to call for all companies at once. Change to: pilot, checkpoint, then start the batch job. It stays the part that explains how to call `find_people_by_company`.
- Update `docs/SOURCING_SKILLS.md` and the token budgets in `skill-library.spec.ts` / `skill-content-integrity.spec.ts`. No workspace sync command is needed: skill text is served from code.

### Stage A in two parts

The spec lists seven skills for building and confirming the company list. They are steps of one phase, not separate jobs, and none of them is a tool. Splitting them would mean several loads for one phase and the same rules repeated in each. They collapse into two parts, plus the detail parts that already exist:

| Part | Covers | Replaces |
| --- | --- | --- |
| `playbook-company-first` (existing, extended; the name stays) | The whole company × role run in order: plan and source choice, Stage A (via `company-list`), the 10-company pilot, batches, checkpoints at 50% and completion, coverage report. Holds the spec's §11 text (mission, unit of work, loop, invariants) | The spec's `company-role-run` playbook |
| `company-list` (new; brought in by `playbook-company-first` through `requires`) | Stage A from start to finish. **Entry modes:** upload (resolve each company with `resolve_company_from_raw_name`: subsidiary, group, same name, dead domain), described segment, peer set. **Lenses:** description, industry (details in `industry-search`), peers, look-alike, supply chain, seed expansion, revenue band, each tagged on the existing company searches. **Filtering:** cheap hard filters first, then paid enrichment; hard criteria fail only on evidence; unknown goes to review; turnover with currency, year and source. **Calibration:** about 10 mixed companies, accept or reject with a reason, rubric updated. **Freeze:** confirmed rows, list version | `resolve-companies`, `company-discovery-lenses`, `find-companies-by-description`, `company-enrichment-and-filtering`, `peer-set-for-search`, `calibrate-with-samples` |
| `industry-search`, `industry-labels` (existing) | Detail for the industry lens | — |
| `companies`, `src-bright-data-companies` (existing) | How to call the company search tools | — |
| `ai-filter-enrich` (existing skill) | Mechanics of the enrichment and fitment columns used by the filter step | — |

Loading: `company-list` comes only with `playbook-company-first`, so a plain company search ("QSR brands in India") does not pay for it. Give the `["playbook-company-first"]` route a new token budget once the part is written.

## 7. System prompt

The spec's §11 prompt is skill-sized, not system-prompt-sized. `core.md` is shared by every Ask AI intent, so put the §11 text in the extended `playbook-company-first` part (mission, unit of work, loop, routing stance, checkpoints, invariants) and add only one routing line to `core.md` and the `sourcing` skill `routes`: "A role at companies, a company list then people, or a pasted JD → `load_skills(["sourcing"], sections: ["playbook-company-first"])`".

## 8. Decisions (settled Oct 29, 2026)

These override anything earlier in this doc that says otherwise.

| # | Question | Decision | Effect on the changes |
| --- | --- | --- | --- |
| 1 | Where run state lives | **Redis with an S3 backup**, the same way lists work | Plan, pair states, evidence and the ledger use the cache store with the S3 backup that `outreach-project-cache-backup.service.ts` gives lists. No new Postgres entity or instance command. Raise the ledger's 100-event cap and back the ledger up too. Extend the TTL every time a run is read, like lists, so an active run never expires |
| 2 | How large runs execute | **BullMQ job** | The chat agent starts a job that runs `find_people_by_company` over the confirmed pairs in batches of 20-50, writes state and reports progress. No worker subagents |
| 3 | Tool name | **Renamed to `find_people_by_company`** (done Oct 29) | Tool name, class, schema, files, skills, evals and docs renamed; no alias, because skill text is served from code. The `FIND_ROLE_*` environment variables keep their names so existing config still applies |
| 4 | Internal people index | **Not used** | The cascade has no internal-index step. The internal index stays a company-side lens source only (`search_companies_index`) |
| 5 | Cost ceiling per pair | **$0.10** across Bright Data, SERP, web search and site fetch | Replaces the Bright Data-only `maxBudgetUsd` (default $0.03, max $0.10). Hitting it ends the pair as `none_found` with reason `budget`. 200 companies ≈ $20 worst case |
| 6 | Freshness window | **365 days** | Evidence older than a year marks the person `unverified`. Matches the "role ended over a year ago is stale" rule already in `fragments/profile-reading.md` |
| 7 | Where to stop the cascade | **Medium confidence**: one fresh source agreeing on name, title and company | The cascade stops at medium. High (two sources agree, or a fresh company site) is recorded when it happens but is not chased |
| 8 | Indian turnover | **Depends on the brief.** Sales Navigator has a rough revenue filter, which must be checked with a web-search column | The turnover lens picks its source by brief. A Sales Nav revenue band is a starting filter only, never a final value: the company keeps `turnover.estimated: true` until a web column confirms it. Store every value with currency, fiscal year and source |
| 9 | Cross-project cache | **Shared across the workspace, with a confidential opt-out per project** | Cache key: workspace + company + role class, inside the 365-day window. A project flagged confidential neither reads from nor writes to the cache |
| 10 | LinkedIn use in people lookups | **Superseded by decision 12.** The user decides whether LinkedIn is used at all | No fixed "last resort" or "high-value only" rule. When picked, it runs last in the cost order and in slow mode |

| 11 | Unit of work | **Company × role pair reaching a terminal state**; fitment decides `found` | Section 1, "Unit of work" |
| 12 | Which data sources | **The user picks the sources at the start of each run** (multi-select, only available sources, pre-selected from the last run) | Section 5.8. Enforced by the tools from the plan. Their own LinkedIn always runs in slow mode. Resolves the clash between decisions 8 and 10: the Sales Nav revenue filter runs only if Harvest or the user's LinkedIn was picked |
| 13 | JD parsing | **Reuse** `parse_job_description` / `job_brief_understanding` | Extend the schema, no new tool (section 5.5) |
| 14 | Company discovery | **No new tool.** `search_companies_index` (shallow, fast) topped up by Bright Data | A `lens` tag on the existing searches (section 4) |
| 15 | New tools | **None.** Plan on `get_sourcing_ledger`, probes on the existing searches, export on `outreach_list`, bulk status on `apply_table_view`. Keep the `budget_guard` service | Section 4 |

Still open from spec §13: which Bright Data datasets to use and how fresh they are for Indian companies, and who owns the LinkedIn account risk for the high-value step.

## 9. Phasing

Aligned with spec §13.

**Phase 1: uploaded domains + one role, sales, no LinkedIn**
- Run state: plan, pair state, evidence, call events (5.1).
- `find_people_by_company` cascade without the LinkedIn step: workspace cache → Bright Data → SERP → company site; ladder rungs; confidence (stop at medium); terminal states; $0.10 per-pair ceiling (5.2).
- `resolve_company` in spreadsheet import; `unresolvable` state.
- Pilot + batch job + coverage line (5.4, 5.6).
- `get_sourcing_ledger` pair stats; `get_outreach_tab` filter / groupBy.
- Evals: 10 uploaded-domain briefs with labels; metrics: terminal-state rate, high-confidence precision, cost per resolved company.

**Phase 2: described segments**
- Lens tags on company searches (index, then Bright Data top-up), lens stats, company status pipeline, cheap-first filter, unknown bucket, structured turnover, calibration, freeze (5.3).
- Contact enrichment in the sales export; CRM dedupe at write time.
- Probe recipe + `freshness` field; `budget_guard` run caps.

**Phase 3: exec search**
- Extend `parse_job_description` + JD card; peer sets; tiers; off-limits lists; exec search export; candidate-pool target type with more people per company.

**Phase 4: LinkedIn and Harvest as user-picked sources**
- Harvest and own-LinkedIn steps in the cascade, run only when picked, with slow mode (section 5.8); residual subagent and verifier if the evals show a residual.

The source question itself (section 5.8) lands in Phase 1, with the plan, so every run starts with the user's choice even before the LinkedIn steps exist.
