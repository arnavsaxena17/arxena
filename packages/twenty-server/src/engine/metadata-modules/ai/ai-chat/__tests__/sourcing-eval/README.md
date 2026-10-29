# Sourcing eval

Tests what the sourcing skill makes the agent do. The agent gets the real skill
text (`getSkillContent`, with the sections it loads) and a real model.

**Stub mode (default):** every tool records the call and returns a fixed result,
so this checks the agent's choices, not what Bright Data, LinkedIn or Naukri
return.

**Live backend mode (`SOURCING_EVAL_LIVE_BACKEND=1`):** allowlisted tools proxy
to a running `twenty-server` via MCP `execute_tool`, under hard caps. Yields and
tab cells are real. After an ad-hoc run the harness calls
`get_outreach_tab` and writes `adhoc.quality.md` (enrichment fill +
ranked shortlist by `fitmentScore`).

## Run

```
SOURCING_LIVE_EVAL=1 OPENROUTER_API_KEY=... \
  npx jest sourcing-eval --config=jest.config.mjs
```

`SOURCING_LIVE_EVAL=1` turns off Jest `silent` so `console.log` in the runner
shows. Without it, `jest.config.mjs` suppresses all console output. During a
live run each tool call and model step prints as it happens; Ctrl+C stops the
process mid-run.

| Variable | Effect |
| --- | --- |
| `SOURCING_EVAL_ONLY` | one scenario id |
| `SOURCING_EVAL_REPEAT` | runs per scenario (default 1; the model is not deterministic) |
| `SOURCING_EVAL_JUDGE=1` | a model also reads each trace against the plan assertions and the judge lines |
| `SOURCING_EVAL_MODEL` | default `deepseek/deepseek-v4-flash-0731`, Ask AI's default |
| `SOURCING_EVAL_OUT` | trace folder, default `tmp/sourcing-eval` |
| `SOURCING_EVAL_MAX_STEPS` | agent step cap, default `30` (raise for long ad-hoc paths) |
| `SOURCING_EVAL_TIMEOUT_MS` | whole-run abort, default `240000` |
| `SOURCING_EVAL_PROMPT` | ad-hoc path only (writes `adhoc.path.md`) |
| `SOURCING_EVAL_LIVE_BACKEND=1` | proxy allowlisted tools to the server (needs token + project) |
| `SOURCING_EVAL_BASE_URL` | server origin, default `http://localhost:3000` |
| `SOURCING_EVAL_API_TOKEN` | workspace API key (Bearer) for MCP |
| `SOURCING_EVAL_PROJECT_ID` | disposable Outreach project id |

### Live capped ad-hoc example

Requires a running server, Bright Data key, LinkedIn Unipile on the workspace,
and an empty-ish Outreach project.

```
SOURCING_LIVE_EVAL=1 \
SOURCING_EVAL_LIVE_BACKEND=1 \
SOURCING_EVAL_BASE_URL=http://localhost:3000 \
SOURCING_EVAL_API_TOKEN=... \
SOURCING_EVAL_PROJECT_ID=... \
SOURCING_EVAL_MODEL=deepseek/deepseek-v4-flash-0731 \
SOURCING_EVAL_OUT=tmp/sourcing-eval/deepseek-live \
SOURCING_EVAL_MAX_STEPS=40 \
SOURCING_EVAL_TIMEOUT_MS=600000 \
SOURCING_EVAL_PROMPT='Give me all sales reps in pharma companies that manufacture oncology drugs in mumbai' \
npx jest sourcing-eval --config=jest.config.mjs
```

Hard caps (enforced in `live-tools.ts`, not trusted to the model):

- Bright Data company: ≤25 rows, ≤$0.05, one successful fetch
- Bright Data people: ≤25 rows, ≤$0.05, one successful fetch
- LinkedIn people/companies/continue: ≤25 rows cumulative
- `find_people_by_company`: ≤25 companies, `maxBudgetUsd` ≤$0.04 per company, one full call + one `onlyFailed`
- `preview_ai_column` / `run_ai_column` / `fetch_profiles`: `rowLimit` ≤25

Inspect: `adhoc.path.md` (behavior) and `adhoc.quality.md` (tab enrichment + ranked shortlist).

The scenario files are checked on every normal test run (they parse, ids are
unique). The model runs only with `SOURCING_LIVE_EVAL=1`.

## What is graded

Deterministic (fails the test):
- every `must_call` tool was called, no `must_not_call` tool was called;
- at most `max_questions` questions were asked;
- no must-have criterion in a fitment rubric is about age, pay or notice (later checks).

Judged (advice only, with `SOURCING_EVAL_JUDGE=1`): the `plan_assertions` and the
`judge` lines, graded from the trace. Read the traces in the output folder
before you trust a verdict.

Live quality (ad-hoc + `SOURCING_EVAL_LIVE_BACKEND=1`): harness reads
`get_outreach_tab` and reports title/location/fitment heuristics plus a
`fitmentScore`-ordered shortlist. Soft advice — read the markdown before trusting it.

## Scenario file

`scenarios/<id>.scenario.md`: YAML front matter (`expect`, `judge`), then
`## Setup`, `## User says` (the requirement, verbatim), `## Scripted replies`
(what the user answers when asked), `## Parsed fields` and a
`## Constraint map` that says which evidence level settles each constraint.
`source_line` is the line in `elaborate_requirements.txt`.

The first ten come from that file. `hard-age-cap-naukri-vs-linkedin` is
synthetic. `oncology-mumbai-sales-reps` covers company-first + enrichment +
shortlist for the Mumbai oncology sales-rep prompt.

## Known limits

- Stub counts are fixed (40 pass, 120 unknown, 120 fail). Never read yields from
  a stub run; the skill says to measure them with a probe on real data.
- Live mode yields are real — spend money and write the project tabs.
- Naukri and the extension are not simulated.
- Tool schemas are one-line hints, so a model may pass arguments the real tool
  would reject.
- A scenario that does not finish in 30 steps or 240 seconds records an error.
  The volume scenario (5,000 rows) did not finish in the first runs; read its trace.
