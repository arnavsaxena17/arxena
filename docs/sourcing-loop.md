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
  sourcing-run.service.ts   start / next — the loop, no business logic
  plan.util.ts              brief -> candidates (calls the Python compiler)
  select.util.ts            pure: rank + budget split
  judge.util.ts             pure: verdicts -> qualified | unknown | to_confirm | fail
  enrich.util.ts            the undecided set only, budgeted
  stop.util.ts              pure: shouldStop — landed, not wired
  round.util.ts             pure-ish: run one candidate, write one ledger row
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
| `candidate-search-pipeline.controller.ts` | debug surface, 25 routes | **not dead** — three callers: `arx-jd-upload/hooks/useSearchParameters.ts` (`generate-unresolved-search-parameters`), `arxena-tools/.../candidate-search-tools.ts`, `arxena-tools/.../internal-tools.ts`. Migrate or drop those first |
| `query-constructor`, `booltree-hint` services | reachable only from the debug controller | the controller above |
| `job-title-expander`, `company-expander` services | debug controller, plus `candidate-search.controller.ts` (`expand-job-titles`, `expand-companies`) | **not dead** — decide whether those two routes stay before deleting |
| `ai-filtering-processor.service.ts` | second filter stack; keep `ai-filter-engine` | **not dead** — `google-sheets` depends on it; migrate that caller first |
| per-candidate LLM scoring | ~250 calls/run, no threshold, no consumer but a column | repoint the table column at fitment |
| 3 × term-limit code (2 TS, 1 Python) | Python is authoritative, keep only it | delete the TS paths with the loop |
| 3 × provider selection (`PeopleApiService` if-chain, `SearchPeopleService`, tool layer) | one `registry.ts` | registry must land first |
| `exa_web_search` / `app_exa_web_search` | names with no handler | skill text mentions Exa |
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
| `SearchExecutionService` (1505) + `OrgChartSearchService` (2062) + shard planner | one `fetch` round | ~3.5k lines, 3 paging loops, 3 cursor conventions |
| 3 provider-selection sites | `registry.ts` | the if-chain and 2 re-derivations |
| two filter stacks | `ai-filter-engine` | ~500 lines, cartesian product, free-form JSON |
| 2 × TS term limits + Python enforcer | Python | ~250 lines, and the drift between them |
| TS `BooltreeHintService` + Python truth tables | Python | a dead filesystem reader, 2 required JSON files |
| 4-agent LLM chain | Agent 1 (parser) only | 3 sequential calls, 4 schemas, TS factoring |

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
`PersonCandidateDraft`, `CandidateTableRow` — five. Keep `PersonCandidateDraft`; the 15
registered transformers already normalise into it. Adapters emit it, and
`apolloPersonToLinkedInPeopleResult()` goes away.

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
  hard error outside production.

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
