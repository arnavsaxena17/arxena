# The sourcing loop

One loop, two tools, one budget. The server owns the ladder; the agent owns judgement.

## The loop

```ts
run = sourcing_start({ brief, budgetUsd });   // plan only, no spend
while (!run.done) {
  run = sourcing_next({ runId, answer? });    // one round: probe | fetch | fix
}
report(run);                                  // rows, spend, whyStopped
```

That is the whole agent surface. `run.question` is set only when the server genuinely
cannot decide; `answer` is then required. Nothing else is asked of the model.

## State

```
PLANNED → PROBING → SELECTED → FETCHING → JUDGING → DONE
```

Two back-edges, and no others:

- `JUDGING → ENRICHING → JUDGING` — undecided rows only.
- `JUDGING → FIXING → PROBING` — one knob, at most twice.

`SHORT · BLOCKED · CANCELLED` are terminal.

State is the existing ledger (`SourcingLedgerEvent[]`), one row per round. No new store,
no new entity, no workflow. The ledger lives in
`outreach-command/utils/sourcing-ledger.util.ts`, so `run/` imports across modules; its
`search` / `score` / `profile_fetch` / `stop` events are the FETCH / JUDGE / ENRICH / stop
rows.

## Rounds

| Round | Does | Spend | Owner |
|---|---|---|---|
| PLAN | brief → candidate queries via the Python compiler | 0 | deterministic |
| PROBE | first page of each candidate; keep the rows, read the count | 1 page / variant | deterministic |
| SELECT | rank by expected unique-qualified per dollar; split the budget | 0 | deterministic |
| FETCH | run top-k, stream, stop when the rules fire | per page | deterministic |
| JUDGE | per-flag verdicts on new rows, batched; row outcome rolled up | ~$0.0005 / row | verdicts: LLM · outcome and threshold: code |
| ENRICH | profiles or web columns for `unknown` rows only, then re-judge | $0.004–0.02 / row | deterministic plan |
| FIX | apply **one** knob from a closed set | next round | LLM, bounded |

`JUDGE` must be in the loop: flat rounds and "target met" are defined on **qualified**, and
counts cannot produce that. `ENRICH` exists to settle decisions, not to decorate rows — its
work queue is the `unknown` set, planned by the existing `get_scoring_plan`. Contact reveal
(email, phone) is **not** a round: it changes `contactable`, not `qualified`.

| Changes | Belongs |
|---|---|
| `qualified` | in the loop |
| `contactable` | after the loop |
| a `to_confirm` answer | after the loop — the candidate gives it |

`counts` is trustworthy on Sales Nav, Recruiter, Harvest and ES. **Never on classic**
(`search-execution.service.ts:405` already ignores it there).

## Stop rules

`shouldStop(state)` is pure and is the only loop logic in the system.

| Rule | Threshold |
|---|---|
| target met | qualified + to_confirm ≥ target |
| flat | < 5% of target added, twice in a row |
| rounds | 5 |
| exhausted | duplicate share > 80%, or source reports no more pages |
| budget | spend ≥ budgetUsd |

FIX rounds do not bypass these. FIX only reorders or adds **one** candidate.

Coverage changes the table. The brief already carries `coverage: 'best_effort' |
'exhaustive'`. The table above is `best_effort`. An `exhaustive` run stops only on
**exhausted** or **budget** — target met, flat and the round cap do not end it.

"Exhausted" is per candidate (source × query). The run stops on it only when no candidate
can still return new rows. With no target, a round is flat when it qualifies nobody.

## Judge

`qualified` is not a stage. A row is qualified when every flag is settled, at whatever
evidence level settled it — sometimes the snapshot, sometimes the full profile, and
sometimes neither, in which case the candidate is asked.

The aim is the most likely good call: no red flag left standing, enough green flags matched.

| Flag | Is | Settled when |
|---|---|---|
| green, must-have | a fact the row must show | pass |
| green, nice-to-have | weighted, ranks rows | scored; never blocks |
| red | a disqualifier | cleared — the evidence can show it and does not |

A red flag the evidence cannot show is **unseen, not cleared**. Job-hopping needs dates, so
a snapshot without dates leaves it `unknown`.

**Judgement is the model's. The roll-up is code.**

| Who | Decides |
|---|---|
| model, from skill facts | each flag: `pass` · `fail` · `unknown`. For an `unknown`, `settledBy`: `profile` · `company_web` · `candidate`. And the question to ask when it is `candidate` |
| code (`judge.util.ts`) | the row outcome below. Nothing else |

| Outcome | When | Next |
|---|---|---|
| `fail` | a red flag is confirmed, or a must-have fails — at any level | terminal, never enriched |
| `qualified` | every must-have passes, every red flag is cleared, score ≥ threshold | counts |
| `unknown` | something unsettled has `settledBy` `profile` or `company_web` | ENRICH, cheapest level first |
| `to_confirm` | must-haves pass, and everything still unsettled has `settledBy: candidate` | leaves the loop with its questions |

Two additions to what exists, and no more: the `settledBy` field on an `unknown` verdict,
and the `to_confirm` outcome in the existing fitment roll-up. Which flags matter, what a
headline can show, what only a candidate knows — all of that is skill text
(`docs/sourcing-judge-skill-draft.md`).

What this changes:

- Today a must-have still `unknown` at profile fails the row. Now it fails only when the
  profile **could** have shown it; when only the candidate can, the row is `to_confirm`.
- Pay, notice, relocation and the like stop being "later checks that never go in the
  rubric". They go in as candidate-level flags and come out as questions.
- `computeSourcingFunnel` counts only profile-stage passes, while the scoring skill already
  counts a snapshot that passes every must-have. `judge.util.ts` becomes the one definition.
- The round's enrichment never runs for a `to_confirm` row: no source sells the answer.

**Target.** `qualified + to_confirm` is what the stop rules read; the report shows them
apart ("32 qualified, 9 to confirm"). Default pending confirmation — the alternative is
counting `qualified` alone, which keeps the loop spending on a number it cannot move.

`to_confirm` questions are stored on the row and read by the message drafter and the call
script. Asking them is outreach, not sourcing.

ENRICH has one stop of its own: the `unknown` set is empty, or its budget is spent. It never
re-opens a `fail`.

## Code layout

```
candidate-sourcing/run/
  sourcing-run.service.ts   start / next / cancel — the loop, no business logic
  sourcing-run.ports.ts     the ports, made from the compiler, tools, tab and scoring
  plan.util.ts              brief -> candidates (calls the Python compiler)
  select.util.ts            pure: rank + budget split
  judge.util.ts             pure: verdicts -> qualified | unknown | to_confirm | fail
  enrich.util.ts            the undecided set only, budgeted
  stop.util.ts              pure: shouldStop — landed, not wired
  round.util.ts             pure-ish: run one candidate page by page — landed, used by search
candidate-sourcing/sources/
  registry.ts               alias -> adapter. The one place a source is chosen.
  adapter.ts                three capability kinds, one return shape
```

File names carry the repo's `.util.ts` suffix; the prose below uses the short names.

`plan.ts` is also the preview the agent reads before spending anything — same function,
no second path.

## Adapter contract

One shape, three kinds. A source declares which kinds it accepts.

```ts
type Spec =
  | { kind: 'facets';  filters: Record<string, unknown> }   // ES, Apollo, ContactOut
  | { kind: 'boolean'; query: string; facets: Record<string, unknown> } // LinkedIn, Harvest
  | { kind: 'string';  query: string };                     // SERP, X-Ray, Apify

search(spec): Promise<{
  rows?: Row[]; counts?: number; costUsd: number; error?: string;
}>
```

Each source declares: accepted kinds, cost model, count reliability, retry policy.
Retry is per source, not global — Unipile defers (never retry), SERP retries with backoff,
Harvest re-fetch costs money, Apollo/ES retry freely.

## Delete

The loop cannot be simple while these exist. None of them changes behaviour.

| Delete | Why | Blocker |
|---|---|---|
| `strategyLimit = 1` in `strategy-execution.service.ts` | debug cap; the budget replaces it | done — `SOURCING_STRATEGY_LIMIT` |
| `search-generation.service.ts` | 403 lines, all commented | done |
| `company-tools.ts` | 270 lines commented; company search is `company-api` | done |
| `candidate-search-pipeline.controller.ts` | debug surface, 25 routes | done for 23 of them. Two stay at the same URL because they have callers: `generate-unresolved-search-parameters` (`arx-jd-upload/hooks/useSearchParameters.ts`, `internal-tools.ts`) and `job-brief-understanding` (`candidate-search-tools.ts`). Both are still unguarded, as before |
| `query-constructor`, `booltree-hint` services | reachable only from the debug controller | done — services, prompt, schema and mapper |
| `job-title-expander`, `company-expander` services | `candidate-search.controller.ts` (`expand-job-titles`, `expand-companies`) | **not dead** — `candidate-search-tools.ts` calls both routes |
| `ai-filtering-processor.service.ts` | second filter stack; keep `ai-filter-engine` | done — `AiFilteringService` runs each filter through `AiFilterEngineService`; `candidate-filter-spec.util.ts` turns the recruiting UI's filter config into the engine's `FilterSpec` |
| per-candidate LLM scoring | ~250 calls/run, no threshold, no consumer but a column | done on the server — `CandidateScoringService` is gone and rows stream unscored. The front-end `relevanceScore` column is now always empty; repoint it at fitment |
| 3 × term-limit code (2 TS, 1 Python) | Python is authoritative, keep only it | done — the splitter in the query-generation service and `countKeywordTerms` / `simplifyKeywordQuery` are gone. `apply-parsed-requirement.util.ts` still caps what it appends to `keywords` at 6 terms |
| 3 × provider selection (`PeopleApiService` if-chain, `SearchPeopleService`, tool layer) | one `registry.ts` | registry must land first |
| `exa_web_search` / `app_exa_web_search` | ~~names with no handler~~ | **not dead** — the `twenty-exa` marketplace app (`packages/twenty-apps/public/twenty-exa`) serves `exa_web_search`, surfaced as `app_exa_web_search`; the `research` skill uses it. Deleting it removes a working source |
| `dataSource: 'pdl'` in People API | throws NOT_IMPLEMENTED | keep the guard until a PDL search adapter exists |
| 28-part `sourcing` skill | process moves into code; skills keep only facts | the loop must exist first |
| `pdb.set_trace()` — `arxena-site/search_model/checks_query.py` | hangs a worker | done — two of them |
| `console.log(... apiToken)` — `result-validation.service.ts` | token and profiles in logs | done |

## Consolidations

Duplication the loop would otherwise inherit. Remove before building on top.

### One slice

```
SearchSpec → registry → adapter → Row → judge → list
             one table   one shape
```

Chat SSE, MCP tools, workflow actions and the org-chart API stop owning pipelines. They
build a `SearchSpec`; nothing else.

### Merge

| Merge | Into | Removes |
|---|---|---|
| `SearchExecutionService` (1505) + `OrgChartSearchService` (2062) + shard planner | one `fetch` round | both classes are gone. `SearchExecutionService` became `LinkedInStrategySource` (prepare a strategy, fetch one page) and `runStrategySearch` (one function over the fetch round, with streaming and page review as options). `OrgChartSearchService` became `OrgChartChartBuildService` (people -> Python chart builder, no searching) and `OrgChartLinkedInSearchService` (plan strategies and shards, run each through `runStrategySearch`). The shard planner is still its own service |
| 3 provider-selection sites | `registry.ts` | the if-chain and 2 re-derivations |
| two filter stacks | `ai-filter-engine` | done — ~500 lines, cartesian product, free-form JSON |
| 2 × TS term limits + Python enforcer | Python | ~250 lines, and the drift between them |
| TS `BooltreeHintService` + Python truth tables | Python | a dead filesystem reader, 2 required JSON files |
| 4-agent LLM chain | Agent 1 (parser) only | done — 3 sequential calls, 3 schemas, TS factoring. `generate` is now parse → Python `/query-set` → fold the requirement in |

**Org chart is not a product.** It is `fetch` with a pair dimension —
`find_people_by_company` already writes per-pair terminal states. Its shard planner exists
only because Unipile caps at 2,500 per search; that is "split a candidate into ≤N
candidates" in `plan.ts`.

### One shape

**Sources.** `DataSourceType`, `PeopleDataSourceAlias`, `candidateSource`, `dataSource`
literals and ledger `source: string` are four encodings of one thing. One enum, one table:

```ts
{ alias, kinds, costModel, countReliability, retryPolicy, adapter, transformer }
```

It replaces `search-tools-config`, the dispatch if-chain, `company-api` capability flags
and the retry knowledge currently living in comments.

**Rows.** `LinkedInSearchResponse`, `PeopleSearchResponse`, `OrgChartSearchResponse`,
`PersonCandidateDraft`, `CandidateTableRow` — five, and the project tab's `OutreachRow` is a
sixth. Decided: the loop keeps `OutreachRow`, because that is what the tab stores and what
every search tool already normalises into. The older candidate-search path
(`PersonCandidateDraft`, `CandidateTableRow`) converges onto it later.

**Errors.** Thrown strings, `AccountRateLimitDeferredError`, `NO_RESULTS`, 502/503 mapping
and `ignoredParameters` become one enum — `deferred | rate_limited | no_results |
unconfigured | budget | upstream` — driving retry, stop and the message.

**Money.** `costUsd: number`, one rounding rule.

### Naming

- Lifecycle verbs only: `plan / probe / fetch / judge / stop`.
- Tool prefix states cost: `get_*` free, `search_*` spends, `run_*` async. Enforce it in the catalog.
- One name per concept. `find_people_by_company`, `peopleByCompany` and
  `people-by-company` are three names for one thing.

### Order

1. Delete — zero behaviour change.
2. One enum, one row type — mechanical, unblocks the rest.
3. `registry.ts`.
4. The loop.
5. Org chart as the pair dimension.
6. One judge.
7. Python as the only query builder.

### Landmines

- `harvest-filter-ids.ts` is documented as **silently wrong** on whole-word mismatches. A
  quiet id mapping poisons every run and looks like a bad query.
- `ignoredParameters` drops unknown keys silently. Correct for users, fatal for a compiler —
  hard error outside production. Done in `harvest-search.controller.ts`: outside production
  an unknown key is a 400 that names it, before any paid call.

## Invariants

1. The server never asks the model anything it can compute.
2. One budget number, checked every round, before every paid call.
3. Every round writes exactly one ledger row.
4. A redial is free — cache keyed `(source, normalised spec)`, not project.
5. `unknown` is not `fail` and not `continue`. It is its own state. So is `to_confirm`:
   `unknown` means a source can still answer, `to_confirm` means only the candidate can.
6. Skills describe facts and limits. They never describe the procedure.
7. Round names are verbs; source names are nouns. No word is both — `fetch`, not
   `harvest`; `plan`, not `apollo`.
8. Never enrich a row before it is judged. `unknown` is the only enrichment queue.
9. The model judges flags; code rolls them up. A confirmed red flag is never weighed
   against a strong profile.

## Migration order

1. **Delete.** Biggest win, zero behaviour change.
2. **Typecheck ratchet** — see below. Without it, step 3 is blind.
3. **Fix the seam** — one call site. `python-query-generation.service.ts` already forwards
   `function_root`, `functions`, `grades` and `locations` to `/query-set`; the loss is in
   `candidate-search-handler.service.ts` (open-market path), which builds the Python input
   from `primary_role_name` alone. Forward the rest of the parsed requirement there. The
   other callers (org chart, people API) are unaffected.
4. **Budget replaces `strategyLimit`** — parameterise, don't hardcode.
5. **Stop rules into `stop.ts`** — port the numbers already in `sourcing-playbook-shortfall.md`.
6. **Wrap in `start` / `next`** — the ledger already holds the state.
7. **Retire the old drivers** — `SearchExecutionService`, `OrgChartSearchService` and
   the org-chart shard planner become rounds of the one loop.

Landed: the reference-free deletions and the two `pdb`s from step 1, and the env-driven
`SOURCING_STRATEGY_LIMIT` from step 4 (default 1, so behaviour is unchanged), the ratchet
from step 2, and the pure half of step 5 — `run/stop.util.ts` with its tests, called by
nothing yet. Step 3, wiring step 5, and steps 6–7 change what the pipeline returns and need
a reviewed run against a real brief first.

Also landed, with tests and called by nothing yet:

- `run/judge.util.ts` — `judgeRow` (flags + verdicts → `qualified | unknown | to_confirm |
  fail`, with `settledBy` and the questions) and `tallyJudgeOutcomes`. A level already on the
  row is not bought again: a must-have the profile could have shown fails, a red flag it
  could not clear becomes a candidate question. `scoreFitment` and `computeSourcingFunnel`
  still run the live pipeline; they are not repointed.
- `run/select.util.ts` — `selectCandidates`: rank by expected qualified per dollar, split the
  budget, at most 10 pages per candidate per round.
- `sources/adapter.ts` — the spec, result and error shapes, `roundUsd`, `pageCostUsd`,
  `actionForSourceError`.
- `sources/registry.ts` — one descriptor per source, keyed by the alias the APIs accept:
  `index`, `apollo`, `contactout`, `pdl`, `harvest`, `linkedin`, `linkedin_pool`,
  `recruiter`, `bright_data`, `serp`, `xray`, `apify`. Which LinkedIn product is searched is
  the request's `searchType`, not a source, so count reliability for the LinkedIn accounts is
  `isSourceCountReliable(alias, searchType)` (never on classic). It holds no adapters yet.
  Apollo, ContactOut, PDL, X-Ray and Apify are `unpriced`; `pageCostUsd` returns `null` for
  them so the loop cannot treat them as free.
- One source enum for the public APIs: the People, Company, Jobs and Posts `dataSource` types
  are `'auto' | PickSource<…>` over the registry, so an alias the registry lacks does not
  compile. `unipile` is now `linkedin` and `pool` is `linkedin_pool` everywhere a
  `dataSource` is read or written (services, resolvers, OpenAPI docs, tool descriptions,
  workflow sample outputs). The old values are rejected, not aliased. Still separate:
  `candidateSource` on the org chart (`unipile | linkedin_xray | apify`), the
  `DataSourceType` enum of import formats, and the ledger's free-text `source`.
- `sources/source-error.util.ts` — `toSourceErrorCode`: a thrown value → the one error enum.
- Money: `roundUsd` is now the rounding used by the ledger funnel, `find_people_by_company`
  spend and the Harvest controller.
- People API: `dispatchPeopleSearch` is a table keyed by `PeopleResolvedDataSourceAlias`, so
  an alias with no entry does not compile.

Python is the only query generator. The `multi_agent` option is gone from the chat handler,
the org-chart router and every request type; `generate_linkedin_query_agent2/3/4` and their
routes are deleted. The open-market path now forwards the parsed location to Python as well
as the role (step 3 of the migration, as far as the parsed requirement allows: it carries no
function root or grade). A search fails when the Python service is down. The front-end
org-chart generator preference is still sent and is ignored.

`run/round.util.ts` — `runFetchRound`: one candidate, page by page, until a rule stops it
(empty page, duplicates only, last page by count, max rows, max pages, no more pages, the
caller declines, abort, error). A source says whether it has more pages, so cursor paging and
the raw classic endpoint's offset paging are one convention. `SearchExecutionService` lost
its two copies of the loop and now only prepares a strategy and emits progress. Two small
behaviour changes came with it: a chat search with validation on now stops when the source
returns no cursor (it used to refetch page one and stop on duplicates), and one without
validation on the raw classic endpoint now pages past page one.

The filter merge changes three things for the recruiting AI filters: prompts and answer
validation are the engine's, a filter whose required answer is invalid leaves the column
empty instead of writing whatever came back, and the run uses the platform's model keys, not
the workspace's own OpenAI key. It is no longer recorded through `MeteredLlmService`; the
engine returns the cost and nothing bills it yet.

The loop is built, tested against fake sources, and reachable through two tools:

- `run/sourcing-run.service.ts` — `start` (plan only, no spend), `next` (one round: probe or
  fetch, judge, enrich the undecided, then stop or select) and `cancel`. Every round appends
  one `round` ledger row carrying the run state; `next` resumes from the latest one, so the
  ledger is the only store. The budget is checked before every paid page. FIX adds one
  candidate, at most twice, and only when the run is flat or dry.
- `run/plan.util.ts` — queries x sources -> candidates, the three spec kinds, the sources it
  cannot run (unknown, unpriced, no adapter, or a filter the adapter cannot express), and
  `needsSplit` / `splitCandidate`: a candidate above a source's `maxRowsPerSearch` (2,500 on
  the LinkedIn accounts) becomes smaller candidates.
- `run/enrich.util.ts` — only `unknown` rows, cheapest level first, within the budget left.
- `sources/adapter-registry.ts` — alias -> adapter, a thrown provider error becomes the one
  error code, a spec kind the source does not accept is a hard error.
- `tool/tools/sourcing-run-tool/` — `sourcing_start` and `sourcing_next` (with `cancel`),
  registered in the action tool provider. One run object is built per call from the calling
  user's context.

**Rows are outreach tab rows**, not `PersonCandidateDraft`. An adapter searches and writes
the page to the project tab in one step and returns counts (`fetched`, `newUnique`); the loop
never holds rows. The two adapters that exist run the existing search tools through
`ArxenaToolProvider.executeStaticTool`, which already normalises, writes the tab and appends
the ledger `search` row:

| Source | Tool | Cannot express |
|---|---|---|
| `index` | `search_people_index` | more than one company per search; a city (it goes in free text) |
| `harvest` | `search_harvest_leads` | employers by name (it takes LinkedIn company URLs) |

The real ports (`run/sourcing-run.ports.ts`):

- compile — one parse, then the Python compiler (`generateSearchQuerySet`).
- judge — runs the fitment column the agent previewed (`scoringPreviewId`, and optionally a
  profile-stage `profileScoringPreviewId`) and reads `fitmentOutcome` off the tab.
- tally — the same column, counted.
- enrich — `FetchProfilesService` for rows still `unknown`.

What this does not do yet:

- No adapter for `linkedin`, `linkedin_pool`, `recruiter`, `bright_data`, `serp`, `xray`,
  `apify`; a brief that picks one gets it back in `unusable`. Apollo, ContactOut and PDL are
  unusable until a price is recorded.
- The judge is the live fitment roll-up (`scoreFitment`: pass / unknown / fail), not
  `judgeRow`. So `to_confirm` is never produced, `settledBy` is not asked for, and the only
  enrichment queued is a profile. Making `judgeRow` the roll-up means changing
  `computeFitmentColumns` and shipping the judge skill text with it.
- `split` (the Unipile shard planner) and `fix` are not wired; both ports are optional.
- A preview expires after an hour, so a long run needs the scoring preview made again.
- No skill text tells the agent to use the two tools; the 28-part `sourcing` skill still
  describes the manual procedure.
- `select` ranks on unique rows per dollar only: there is no per-candidate qualified rate.
- It has not been run against a live source.

The org-chart LinkedIn search is not on `sourcing_start` / `sourcing_next`, and cannot be
as they stand: the loop counts rows on the project tab, while an org chart needs the raw
LinkedIn items to hand to the Python builder. What it shares with the loop is the fetch round
and the LinkedIn source.

`OrgChartLinkedInSearchService` now owns the request only — normalisation, the two caches,
the session and the progress events — and its phases are separate units, in the order they
run: `planStrategiesAndShards` (router → strategy cap → function-grade cache → cancel →
probe → search plan → unlimited shards), then `runStrategies` (the per-strategy fetch round,
persisting the raw snapshot after each), then `dedupeAndReturnCandidates` (dedupe, scope
filter, node filter). `planUnlimitedShardsOrResume` and
`resolveBusinessDivisionLinkedInContext` are their own units because the estimate probe
shares both. The 836-line method is gone; the phases are `services/orgchart-*.util.ts` and
are unit tested, with `runStrategySearch` still the only paging loop underneath.

The request itself is parsed once, in `services/orgchart-linkedin-request.util.ts`:
`normalizeOrgchartLinkedInRequest` trims and defaults every field, then
`deriveOrgchartRequestFilters` decides what the request narrows — after the
business-division step, because that step can narrow country and function. Both entry
points go through it, so they can no longer disagree about whether a search is "everyone
in the company": a LinkedIn location id or `leadershipOnly` now narrows it for the
estimate as well as the run, which is the divergence that used to be there. One options
type describes the request, with the five fields only the run can act on as an extension.

**Source encodings.** One enum, and one table per remaining spelling:

| Encoding | Now |
|---|---|
| People / Company / Jobs / Posts `dataSource` | `'auto' \| PickSource<…>`; `unipile` -> `linkedin`, `pool` -> `linkedin_pool` |
| `OutreachSource` (tab row, and the ledger `search` event) | `PickSource<…> \| 'other'`. Index rows are written as `index` and Wikidata rows as `wikidata`; `other` is only read, for rows stored before |
| org-chart `candidateSource` | values unchanged; `sourceOfOrgChartCandidateSource` maps each to a registry source (`unipile` -> `linkedin`, `linkedin_xray` -> `xray`, `m7kq` and `apollo` -> `apollo`) |
| `DataSourceType` (import formats) | values unchanged; `sourceOfImportFormat` gives a LinkedIn format its source and a job-board export, upload or parsed CV none |

The two tables are `Record`s over the whole encoding (`sources/source-encodings.ts`), so a
new value with no source does not compile. `candidateSource` and the import formats were not
renamed: they are sent by the org-chart client (38 files, front end included), held in queued
jobs and cache keys, and stored on imported candidates. `exa` and `wikidata` joined the
registry because the tab already records them.

Still to do: the tool renames to `get_` / `search_` / `run_`.

## Typecheck ratchet

`nest-cli.json` sets `"builder": "swc"` and `"typeCheck": false`, so no type error can block
a build or a boot. The checker is a separate pipeline that nothing depends on:

```
npx tsgo -p packages/twenty-server/tsconfig.json   →  1,043 errors, exit 1
```

Most are stale annotations, not runtime faults — `obj[stringKey]` on a type without an index
signature, `Property 'data' does not exist on type '{}'` where the value came from JSON,
159 parameters that are just missing an annotation. The server runs because the values are
right and the types are out of date.

That is fine until step 3. Collapsing four source enums into one and five row types into
`PersonCandidateDraft` needs the compiler to list every caller that breaks. So gate the five
modules the plan touches, not the package:

| Module | Errors | `any` |
|---|---|---|
| `candidate-sourcing` | 162 | 336 |
| `candidate-search` | 65 | 145 |
| `org-chart` | 29 | 54 |
| `linkedin-search` | 6 | 32 |
| `arxena-tools` | 0 | 0 |

Three numbers per module, each may only go down: type errors, `@ts-ignore` /
`@ts-expect-error` suppressions, and explicit `any`. Counting errors alone is gameable —
`as any`, `@ts-ignore`, or a widened index signature all lower the count while making the
checker less useful, and for TS7053 the dishonest fix is the tempting one.

Implementation — `packages/twenty-server/scripts/typecheck-sourcing-ratchet.mjs` plus
`packages/twenty-server/typecheck-sourcing.baseline.json`:

```bash
npx nx typecheck:sourcing twenty-server                 # gate, from the repo root
# from packages/twenty-server:
node scripts/typecheck-sourcing-ratchet.mjs --update    # accept current debt
```

It runs the real checker once (`tsgo -p tsconfig.json`) and filters the output to the five
module paths. A scoped `tsconfig` was the other option and does not work here: TypeScript
still reports on every transitively imported file, so `include` narrows almost nothing. The
filter lives in the script instead.

Fails when any of the three numbers rises, prints the module delta and the offending errors.
`--update` only ever accepts the current state — lower it as debt is paid off, never raise it
to make a red check green.

`--noEmit --incremental false` are load-bearing. Without them the checker writes JS and a
`.tsbuildinfo` into `dist/`, and the stale build info then silently ignores `compilerOptions`
changes — which is how a `lib` bump appeared to do nothing.

Starting point: 1,043 errors package-wide, 262 in these five modules. Wire it into CI next to
lint; the 262 is a day or two of work, cheaper than a blind refactor across 62k lines.

## Tests

`select.ts` and `stop.ts` are pure — unit tests, no mocks, no network.
One gold brief replayed end to end, asserting `costPerQualified` and `duplicateShare`.
Those two numbers are the regression gate; nothing else is worth asserting first.
