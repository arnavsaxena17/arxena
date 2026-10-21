---
name: no-root-run-artifacts
description: >-
  Keep agent run dumps, CSVs, JSONL outcome logs, scrapes, probes, and scratch
  notes out of the repo root. Use when writing FIND_ROLE_OUTCOME_LOG_PATH,
  saving find-role outcomes, Bright Data results, final_list CSVs, scrape
  JSON, .jsonl/.probe files, or any local experiment output. Apply before
  creating or committing files at the repository root.
---

# No root run artifacts

## Rule

Never write agent/debug/run output into the **repository root**. Root is for
project config and scripts only.

## Where files go

| Kind | Path (gitignored) |
| --- | --- |
| find-role outcomes / probes / run notes | `tmp/agent-runs/find-role/` |
| Bright Data scrapes / plan dumps | `tmp/agent-runs/bright-data/` |
| One-off list CSVs | `tmp/agent-runs/lists/` |
| Other scratch | `tmp/agent-runs/<topic>/` |

`tmp/` is already gitignored. Do not `git add` anything under it.

## Env / code defaults

- `FIND_ROLE_OUTCOME_LOG_PATH` must point under `tmp/agent-runs/find-role/`,
  e.g. `…/tmp/agent-runs/find-role/find-role-outcomes.jsonl`
- Prefer absolute paths under that tree; never a bare filename in the repo root
- Create the directory with `mkdir -p` before first write if needed

## Do not

- Drop `*.jsonl`, `*.probe`, `*.csv`, scrape `*.json`, or agent notes at repo root
- Commit run artifacts “for later” — keep them local under `tmp/`
- Use `/tmp` on the machine as a substitute when the files belong to this repo;
  use `tmp/agent-runs/` so they stay with the checkout and stay ignored

## If you find junk already in root

1. `mkdir -p tmp/agent-runs/<topic>`
2. `mv` the files there
3. `git rm --cached` if they were tracked
4. Confirm `.gitignore` covers the pattern (root `/find-role-outcomes*`,
   `/bright-data-*.json`, `/final_list_*.csv`, `/*.jsonl`, `/*.probe`, `tmp/`)
