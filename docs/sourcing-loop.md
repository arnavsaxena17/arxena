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
PLANNED → PROBING → SELECTED → FETCHING → DONE
                     ↑            │
                     └── FIXING ──┘         (one knob, ≤2 rounds)
SHORT · BLOCKED · CANCELLED are terminal.
```

State is the existing ledger (`SourcingLedgerEvent[]`), one row per round. No new store,
no new entity, no workflow.

## Rounds

| Round | Does | Spend | Owner |
|---|---|---|---|
| PLAN | brief → candidate queries via the Python compiler | 0 | deterministic |
| PROBE | first page of each candidate; keep the rows, read the count | 1 page / variant | deterministic |
| SELECT | rank by expected unique-qualified per dollar; split the budget | 0 | deterministic |
| FETCH | run top-k, stream, stop when the rules fire | per page | deterministic |
| FIX | apply **one** knob from a closed set | next round | LLM, bounded |

`counts` is trustworthy on Sales Nav, Recruiter, Harvest and ES. **Never on classic**
(`search-execution.service.ts:405` already ignores it there).

## Stop rules

`shouldStop(state)` is pure and is the only loop logic in the system.

| Rule | Threshold |
|---|---|
| target met | qualified ≥ target |
| flat | < 5% of target added, twice in a row |
| rounds | 5 |
| exhausted | duplicate share > 80%, or source reports no more pages |
| budget | spend ≥ budgetUsd |

FIX rounds do not bypass these. FIX only reorders or adds **one** candidate.

## Code layout

```
candidate-sourcing/run/
  sourcing-run.service.ts   start / next — the loop, no business logic
  plan.ts                   brief -> candidates (calls the Python compiler)
  select.ts                 pure: rank + budget split
  stop.ts                   pure: shouldStop
  round.ts                  pure-ish: run one candidate, write one ledger row
candidate-sourcing/sources/
  registry.ts               alias -> adapter. The one place a source is chosen.
  adapter.ts                three capability kinds, one return shape
```

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

| Delete | Why |
|---|---|
| `strategyLimit = 1` in `strategy-execution.service.ts:77` | debug cap; the budget replaces it |
| `search-generation.service.ts` | 403 lines, all commented |
| `query-constructor`, `booltree-hint`, `job-title-expander`, `company-expander` services | reachable only from test controllers |
| `ai-filtering-processor.service.ts` | second filter stack; keep `ai-filter-engine` |
| `company-tools.ts` | 221 lines commented; company search is `company-api` |
| per-candidate LLM scoring | ~250 calls/run, no threshold, no consumer but a column |
| 3 × term-limit code (2 TS, 1 Python) | Python is authoritative, keep only it |
| 3 × provider selection (`PeopleApiService` if-chain, `SearchPeopleService`, tool layer) | one `registry.ts` |
| `exa_web_search` / `app_exa_web_search` | names with no handler |
| `dataSource: 'pdl'` in People API | throws NOT_IMPLEMENTED |
| 28-part `sourcing` skill | process moves into code; skills keep only facts |
| `pdb.set_trace()` — `arxena-site/search_model/checks_query.py:537` | hangs a worker |
| `console.log(... apiToken)` — `result-validation.service.ts:42-46` | token in logs |

## Invariants

1. The server never asks the model anything it can compute.
2. One budget number, checked every round, before every paid call.
3. Every round writes exactly one ledger row.
4. A redial is free — cache keyed `(source, normalised spec)`, not project.
5. `unknown` is not `fail` and not `continue`. It is its own state.
6. Skills describe facts and limits. They never describe the procedure.
7. Round names are verbs; source names are nouns. No word is both — `fetch`, not
   `harvest`; `plan`, not `apollo`.

## Migration order

1. **Delete.** Biggest win, zero behaviour change.
2. **Fix the seam** — forward `function_root`, `functions`, `grades`, `locations`,
   `industry` from the parsed requirement into the Python compiler so `/query-set`
   is actually reached. Today only `primary_role_name` survives.
3. **Budget replaces `strategyLimit`** — parameterise, don't hardcode.
4. **Stop rules into `stop.ts`** — port the numbers already in `sourcing-playbook-shortfall.md`.
5. **Wrap in `start` / `next`** — the ledger already holds the state.
6. **Retire the old drivers** — `SearchExecutionService`, `OrgChartSearchService` and
   the org-chart shard planner become rounds of the one loop.

## Tests

`select.ts` and `stop.ts` are pure — unit tests, no mocks, no network.
One gold brief replayed end to end, asserting `costPerQualified` and `duplicateShare`.
Those two numbers are the regression gate; nothing else is worth asserting first.
