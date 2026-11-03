## Run edge cases

Load this only when a lookup has started a background run, returned
`deferredByBudget`, or reported a pair it could not settle. The happy path does
not need it.

### Background run

More than 25 companies start a background run: the call returns a `runId` and
progress. Read it with `find_people_by_company({ runId })` — it waits up to
`waitSeconds` — never more than once a minute; report at 50% and at completion.
`cancel: true` with the `runId` stops it and keeps what was found. An exhaustive
run does not stop at a target; it stops when every pair is terminal or
`capsUsd.run` is spent.

### Pair states

| `terminalState` | Means | Next |
| --- | --- | --- |
| `found` | Someone holds the role at or above the plan's confidence; `rungUsed` says how close the title is | Keep. Flag rung 3 and 4 in the report |
| `ambiguous` | Only low-confidence people, or a questionable company match (parent, brand, namesake) | Ask the user, with the people and the reason |
| `none_found` | Searched; `reason` says why: `no_such_role`, `profile_gaps`, `budget` | Report with the reason. `budget`: offer a higher `capsUsd.perPair`. Rerun only with new `alternateNames` |
| `none_found` + `source_error` | The lookup did not complete | Once more with `fromProject: true, onlyFailed: true` |
| `unresolvable` | The company could not be identified from the input | Ask for a domain or the legal name |

`rejected` lists people found who do not belong, including people above the
plan's rung; they are not written to the tab. Each kept person has `confidence`,
`freshness` and `evidence` (source, query, date, snippet).

### Budget

If the result has `deferredByBudget`, report it and ask once whether to raise
`capsUsd.run`. A company that hits its per-pair cap ends `none_found` with reason
`budget`; offer a higher `capsUsd.perPair` rather than rerunning it unchanged.

### Pool size

The tool keeps up to 3 people per company, or one per role when more roles were
asked, so N companies give at most max(3, roles) x N people. Name the pool in
your report. If the target is larger (two named companies and a target of 30),
say so before the call, build peer companies with `playbook-company-first`, and
ask once whether to widen to peers.
