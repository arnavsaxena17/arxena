# Sourcing skills

The `sourcing` skill is the only entry point for finding people and companies. It is one head file plus parts, all in
`src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/contents/`.

## Vocabulary

Search returns snapshots. Profile fetch turns a snapshot's LinkedIn URL into the full profile. Enrichment adds outside or derived data (web facts, distance, AI columns). Scoring is fitment: pass, fail or unknown per criterion, against a threshold set in code. The definitions live in the head file (`sourcing.md`) and `fragments/fitment-rules.md`.

## Files

| File | Section | Loaded |
| --- | --- | --- |
| `sourcing.md` | head | always: vocabulary, funnel, destinations, source order, result lists, write contract |
| `sourcing-people.md`, `-companies.md`, `-people-by-company.md` | search types; `people` also holds the job title search (which sources filter the current title) | by route |
| `sourcing-industry-search.md`, `-industry-labels.md` | industry searches: label mapping, source order, kinds of search; the full LinkedIn V2 label list (`fragments/linkedin-industries.md`) | `industry-search` by route and with company-first; `industry-labels` on demand |
| `sourcing-playbook-scored-list.md`, `-playbook-company-first.md`, `-playbook-shortfall.md` | playbooks (the first two bring the shortfall one) | by route |
| `sourcing-scoring.md` | scoring: fitment, worthiness, climb rules, approvals | with scored list / inbound |
| `sourcing-for-recruiting.md`, `-for-sales.md` | purpose: candidates for a role, or prospects. Each brings `rubrics` and its admission playbook | by purpose |
| `sourcing-rubrics.md` | rubric archetypes (`title-led`, `company-led`, `skill-led`, `scale-led`, `candidate-led`) and how weights turn into a score | with a purpose |
| `sourcing-query-planning.md` | queries, variants, probe, then scale; large lists of about 1,000 rows or more (brings shortfall / title synonyms) | by route, for large lists and probes |
| `sourcing-playbook-recruiting-admission.md`, `-sales-admission.md` | what puts someone on the core list (the People tab) | with a purpose |
| `sourcing-inbound-applicants.md` | applicants to a posting (no tool reads them yet) | by route |
| `sourcing-src-naukri.md` | Naukri Resdex and Hiring through the Chrome extension | when named |
| `sourcing-src-<source>.md` | one per source | people and companies bring Bright Data; the rest only when named or as a fallback |
| `fragments/profile-reading.md`, `title-seniority.md`, `fitment-rules.md`, `evidence-ladder.md`, `later-checks.md`, `worthiness-gates.md`, `bright-data-ludicrous-budget.md`, `admission-shared.md`, `boolean-title-strings.md` | shared text | included in the sections above and readable from server prompts with `getSkillFragment(name)` |

Front matter on `sourcing.md` lists `parts` (order and names), `requires` (a section brings others) and `defaultSections` (used when `load_skills` gets no `sections`). A part `x` is the file `sourcing-x.md`.

## Rules the tests enforce

- Every part named in `parts` has a file; every name in `requires` and `defaultSections` is a part.
- Each route's bundle has a token budget (`skill-library.spec.ts`); the whole skill has one (`skill-content-integrity.spec.ts`).
- Tools named in backticks must exist. Do not backtick a tool that is not built yet.
- Provider markers (`<!-- search-...:start -->`) keep working wherever they sit in the skill.

## Adding a source

Create `sourcing-src-<name>.md`, add `src-<name>` to `parts`, add a row to **Source order** in the head, and put any provider marker comments around its text.

## Purpose, evidence and approvals

- **Purpose.** The head asks the agent to decide recruiting or sales from the project and the request, and to load `for-recruiting` or `for-sales`. The core list is the People tab in both.
- **Later checks.** Pay, notice, age, willingness and proof are not on profiles. The head says to list them in the brief and never score them: an unknown must-have fails a row at the profile stage, so scoring them would fail every row.
- **Age.** Ignored unless the user states a hard cap more than once. Then only Naukri's native filter is used. LinkedIn is never filtered on age, because the only proxy (first-job or education year) drops people who leave those dates out.
- **Evidence levels.** Snapshot, full profile, CV (`fragments/evidence-ladder.md`). Only `snapshot` and `profile` exist as fitment stages; Naukri and CV rows are scored as `profile`. A CV stage would need a code change in `fitment-score.util.ts` and is not built.
- **Approvals by effect.** Reads, fetches and enrichment inside the caps approved once need no yes. Going past a cap, sending a CV, a profile or a shortlist outside the project, messaging, enrolling, saving to the CRM and deleting do (`sourcing-scoring.md`).
- **Naukri.** Ask AI cannot start a crawl: the extension bridge tools (`resdex_crawl` and the others in `extension-bridge-tools.ts`) are not in `ARXENA_TOOL_CATALOG`. The skill tells the user what to run; the uploaded rows reach the People tab through `/candidate-sourcing/upload-profiles`.

## Evals

`src/engine/metadata-modules/ai/ai-chat/__tests__/sourcing-eval/` holds scenario files (a requirement, scripted user replies, expected tool calls and a constraint map), a runner that gives the real skill text and a real model stubbed tools, and a live spec gated by `SOURCING_LIVE_EVAL=1`. It tests what the agent chooses, not what the sources return, so tool results are fixed stubs. See its `README.md`.

## Open items

Facts only the team has; the drafts are in the files, please correct and extend:

- `src-linkedin`: Unipile schema, result types, endpoints, guardrails, costs, the 1,000-result cap and how to slice queries, rate limits.
- `src-harvest`: Sales Navigator and People API fields; which are snapshot fields and which need a profile fetch.
- `src-serp`: query patterns that work, cost.
- Title / profile knowledge lives in `fragments/title-seniority.md` (via shortfall) and `fragments/profile-reading.md` + `worthiness-gates.md` (via scoring). Add industry guidance as a new part when needed (`know-industry-<x>`).
- Per source: which fields can be filtered, which come on the snapshot, which only on the full profile.
- `src-naukri`: limits, the Resdex filters the extension sets (only titles and companies were seen in `deliverResdexQuery`), and whether the extension tools should be exposed to chat.
- `inbound-applicants`: Unipile Classic job-posting and applicant endpoints are unverified and no tool reads them.
- Rubric archetype names are a proposal.
- Measured yields per stage: they depend on the exact query wording, so the skill measures them with a probe instead of stating them.

## Fitment scoring

`preview_ai_column` takes `fitment: { stage, criteria, minimumScore? }`. The model gives pass, fail or unknown per criterion; `scoreFitment` (`candidate-sourcing/services/fitment/`) computes `fitmentScore`, `fitmentOutcome` and `fitmentReason`. The bar is `SOURCING_FITMENT_THRESHOLD` (default 0.5; `0.6`, `60` and `60%` all work). A request may raise it, never lower it. Callers: the AI column, Bright Data ludicrous relevance filtering (`probabilityThreshold` on the filter spec), and the person fit filter used by `find_people_by_company` and Bright Data people search. `CandidateJudgeService` has no caller (orphan).

## Profile fetch

`fetch_profiles` fetches the full profile of every person on the People tab who needs one (default: fitment outcome pass or unknown, has a LinkedIn URL, no profile yet). Bright Data in parallel batches of 20 (4 at once), then Harvest for the misses; about a minute per call, resumable (`remaining`). The result is one `profile` value per row: `source`, `fetchedAt`, `fieldsPresent` and compact headline, about, experience, education, followers, connections, photo, location. `find_people_by_company` stores the same value for people Bright Data returned with a profile, so they are not fetched twice.

## Asking the user

The head of `sourcing` sorts every open point into look it up, decide and say so, or ask. The `requirements` section (loaded when the target, the criteria or the destination is missing) holds the brief and one block per kind of request: population, named role at named companies, company list, scored list, look-alikes, expand or refresh. The traps and the questions in each block are drafts; correct them with what you know. Why it is built this way: in 45 real `ask_questions` calls, a third were "run this column for all N rows?" and users said yes 82% of the time they answered; only the ambiguity and recovery questions drew typed answers.

Money is the one thing a column run needs approval for, and it is enforced in code. `preview_ai_column` returns `needsApproval` and `autoRunLimitUsd`; under the limit the agent runs without asking, over it `run_ai_column` refuses (`cost_approval_required`) until it gets `approvedCostUsd`. The limit is `AI_COLUMN_AUTO_RUN_MAX_USD` (default 5; 0 means always ask). A run limited by `rowLimit` is priced by its rows. A column whose engine reports no cost (Jev) never blocks. The UI's own run button is not affected.

The agreed brief is written once with `get_sourcing_ledger({ projectId, brief })` and comes back with every later call, so the shortfall report can quote it.

## Coverage

The brief carries `coverage: "best_effort" | "exhaustive"`, `universe {kind, count}` and, for population runs, `queries [{source, query, slice, entity}]`. `capsUsd.run` is the total the run may spend; `budgetRunId` is server-set and identifies its spend window (`newRun: true` starts a new one). `find_people_by_company` refuses an exhaustive run without a run cap, looks up only the companies the remaining cap covers and returns `deferredByBudget` for the rest. `get_sourcing_ledger` returns the run's `budget` and a `coverage` object: pair-based for company x role runs, query-based for population runs (`frontier.attempted / unattemptedQueries`). A planned query counts only when a list with its source and text is attached to the project; index and Wikidata lists are stored as `other`, so the frontier aliases them. LinkedIn and Sales Navigator list metadata carries facet ids, not the natural-language query, so a planned LinkedIn query may show as unattempted: plan one query per LinkedIn source or read that list as unplanned. The list meta now keeps `newUnique` and `alreadyKnown`, and the ledger reports the run's cross-query duplicate share. The run cap covers searches, the per-company lookup and AI column runs; `fetch_profiles` still uses its call-level limit. Spend lives in the outreach cache, so a Redis flush resets the counter while the cap remains.

## Keeping the context small

Every model step re-reads the whole conversation, so steps are the cost.

- `run_ai_column` waits for the run (`waitSeconds`, default 150, max 240) and `get_ai_column_run_status` waits too (default 120). The skill says to check at most once a minute. Real chats averaged 10 to 50 polls per run before this.
- `search_linkedin_continue` takes `maxPages` (up to 50) and `maxRows` (default 1000) and follows the cursor on the server. The result carries `autoContinue` (pages, rows, why it stopped) and the cursor to carry on from. A failing page keeps the pages already read.
- Rows stay out of the chat: `get_outreach_tab` `summarize` and a 10-row sample at most; no `code_interpreter` or `extract_json_paths` on the tab.
- Find writes: pass `projectId` on the search so the tab is written. A project is required; there is no attach.

## When there are not enough results

Policy is `sourcing-playbook-shortfall.md` (order of moves, when to stop, report). Each `src-*` section has a "Limits and exhaustion" part: Bright Data and LinkedIn are filled in; the others say the cap is not documented and to treat an all-duplicates batch as exhausted. Please fill those in.

The evidence is `get_sourcing_ledger({ projectId, target?, stoppedBecause? })`: searches behind the project's attached lists (source, query, rows, duplicates, spend), the scoring runs and profile fetches the server recorded (kept 30 days in the outreach cache, latest 100 events), the funnel now (qualified = passed on the full profile, awaiting a profile) and the shortfall with what the pipeline can still add. Passing `stoppedBecause` writes a stop event. A search shows up once its list is attached to the project.

The numbers in the playbook (5% of the target for a flat round, two flat rounds or five in all, 80% duplicates) are first guesses to tune.

## Other bars

Three env variables, one per kind of yes/no, because a wrong answer costs differently: `SOURCING_FITMENT_THRESHOLD` (a missed fit loses a person), `SOURCING_FAKE_PROFILE_THRESHOLD` (a wrong "fake" only moves a row down) and `SOURCING_SAME_PERSON_THRESHOLD` (a wrong "same person" merges two real people and deletes one; raise it first). All default to 0.5.

## Not built yet

- Distance enrichment.
- Ledger entries for searches whose list is not attached to the project. Bright Data fetches that write straight to a tab may be among them; I did not check.
- `ask_questions` over MCP (text fallback) and the CORE trim of sourcing text.
- Generating the Source order table from config.
