# Company-to-people list building: Phase 1 audit and Phase 2-4 plan

Oct 29, 2026. Companion to `LIST_BUILDING_AGENT_GAP_SPEC.md` (the gap spec) and
`SOURCING_SKILLS.md`. Three parts:

1. What Phase 1 shipped, checked against the code and against live runs.
2. What the live runs exposed, and the fixes that landed today.
3. The plan for Phase 2 (described segments), Phase 3 (exec search) and Phase 4
   (LinkedIn and Harvest as picked sources), plus the cross-cutting work that
   blocks all three.

## 1. Phase 1: is it done?

Phase 1 was "uploaded domains + one role, sales, no LinkedIn". Commits
`4d4768c05f` (implementation) and `d0d81bc31f` (live-check fixes). Checked
against the gap spec section 9:

| Phase 1 item | State | Where |
| --- | --- | --- |
| Plan on the brief (`persona`, `targetType`, `roles`, `ladder`, `thresholds`, `sources`, `capsUsd.perPair`, `confidential`) | Done | `sourcing-ledger.util.ts` (`SourcingBrief`), `get-sourcing-ledger-tool.ts` |
| Pair state on the company row, terminal states `found` / `none_found` / `ambiguous` / `unresolvable` / `excluded`, rung, sources, cost | Done | `find-people-by-company.types.ts`, `outreach-people-found.util.ts` |
| People carry `confidence`, `freshness`, `evidence` | Done | `find-people-confidence.util.ts`, `find-people-cascade.service.ts` |
| Cascade without LinkedIn: workspace cache → Bright Data → Google/SERP → company site | Done | `find-people-cascade.service.ts` |
| Ladder rungs 1-4 with size-aware owner pass | Done (tuned today) | `role-title-matching.util.ts`, cascade owner pass |
| Confidence stops at medium, stale → `unverified` | Done | `find-people-confidence.util.ts` |
| `$0.10` per-pair ceiling across sources | Done | `FindPeoplePlan.perPairUsd` |
| `pilotSize: 10`, then a background run over 25 companies with progress and cancel | Done | `find-people-run.service.ts`, `process-find-people-chunk.job.ts` |
| Uploaded companies resolved on import (`matchConfidence`, alternates, `unresolvable`) | Done | `outreach-spreadsheet-company-resolution.util.ts` |
| Source guard: a search tool for a source the user did not pick refuses | Done | `sourcing-source-guard.util.ts` |
| `get_sourcing_ledger` pair stats and coverage line | Done | `computePairFunnel` |
| `get_outreach_tab` `filter`, `fields`, `groupBy` | Done | `query-outreach-tab-rows.util.ts` |
| Ledger backed up to S3, TTL refreshed on read | Done | `sourcing-ledger.service.ts` |
| Evals: uploaded-domain briefs, pair metrics in the quality report | Done | `__tests__/sourcing-eval/quality.ts`, scenarios |

**Gaps found in the code** (small, all fixed today):

- The compact `learn_tools` entry lost every nested shape when the schema spilled,
  so the model guessed `brief: "<prose>"` and `persona: "sales_prospect"` and looped
  on validation errors. Fixed by rendering an `inputShape` per tool.
- `get_sourcing_ledger` `brief` rejected prose and near-miss enums; `roles` had to be
  an array. Now normalised (`normalizeSourcingBriefDraft`).
- `ask_questions` failed the whole call when one option had no `label`, which ended
  the turn. Now repaired (label from description, caps enforced).
- `find_people_by_company` had no way to express a person criterion ("payments or
  lending experience"), so the one thing the user asked for was never checked. Now
  `criteria` is judged per person and returned as `criteriaUnknown`.
- The owner pass kept a founder/CEO at a small company even when they did not run the
  requested function (a "Chief Product Officer" for a VP Engineering search).
- Company rows merged only on an exact domain, so "propelld" and "Propelld" (one with
  a domain, one without) became two companies, and "Pice®" kept its trademark.
- `get_sourcing_ledger` required `projectId` although the tool context carries it; the
  model dropped it and the call failed. It now defaults to the context and the error
  says to pass it.
- `sourcing` routing sent "VP Engineering at fintech startups in Bangalore" to the
  `people` section (a population search) instead of company-first, and the
  `playbook-company-first` route did not load `requirements`, so the data-source
  question never ran.
- The skill told the agent to start with `search_companies_index` even when the index
  is switched off in the workspace; it wasted steps hunting a tool that is not there.

## 2. What the live runs showed

Run 1, the prompt from the brief: "Give me VP Engineering from fintech startups in
Bangalore with payments or lending platform experience", through the real chat
(GraphQL API, real worker, real tools).

| Stage | Result |
| --- | --- |
| Route | Company-first + for-sales after the routing fix (before it: population) |
| Plan questions | 3-4 in one batch (sources, size/stage, budget). The source question now lists only sources whose tool is in the catalog |
| Companies | Bright Data estimate → fetch 229 → 53 flagged payments/lending fintech → 44 kept after dropping 0-6 employee shells |
| Confirmation | Short table + counts, one question; no 100-row dump |
| Pilot | 10 companies, $0.016; asked a role-reading question when the pilot found no titled VP |
| Remaining | Background run over 34 companies, ~3 minutes, progress read with `runId` |
| Pairs | 43 pairs: 23 found, 5 ambiguous, 15 none found, 0 unresolvable; $0.352; sources Google 42 / Bright Data 43 |
| People | 52 written, with confidence, evidence, rung |
| Criteria | `criteriaUnknown` on most snapshot matches; the agent moved to profile fetch to settle the must-have |

Known problems at that point (all addressed or scheduled below):

- The agent still asked "purpose" (sales vs recruiting) in some runs, and sometimes a
  target count for a company-first run. The skill now defaults to sales and forbids a
  row-target question for company-first runs.
- The pilot kept owners (CEO, Co-Founder) for a VP Engineering role. The owner pass now
  requires the title, experience or about line to show the function.
- The company list has no `location` column, so geography could only be filtered from
  `otherFields`; the agent fell back to a Bright Data relevance flag. Phase 2 adds the
  column and the cheap filters.
- `find_people_by_company` returned 15.9 kB for 10 companies and spilled. Slimmed to
  name/title/company/URL/sources/confidence/one evidence link, rejections capped at 3.

## 2b. The four query shapes, run live

Each prompt went through the real chat API (GraphQL `sendChatMessage`), the real
worker and the real tools, on a fresh project. Answers to `ask_questions` were
given automatically (the recommended option, minus LinkedIn and Harvest).

| # | Prompt | What happened | Verdict |
| --- | --- | --- | --- |
| 1 | VP Engineering, fintech startups, Bangalore, payments/lending experience | 229 companies → 53 flagged payments/lending → 44 kept; pilot 10 then a 34-company background run; 43 pairs: 23 found / 5 ambiguous / 15 none found; 52 people; 18 passed the payments/lending column; $0.81 | Works end to end. Two iterations were needed: routing to company-first, and the data-source question |
| 2 | Plant heads, chemical manufacturers, Gujarat, continuous process | Sliced by city (Surat, Bharuch, Vapi, Rajkot, Ankleshwar): 443 companies, $0.89; pilot found Plant Head / Plant Manager / Works Manager at 8 of 10; the 396-company run was cancelled after 24 pairs (throughput, see below) | Planning and pilot good; company quality weak (traders and services firms passed), title quality weak (MD/CEO/Director kept for plant head) |
| 3 | COO, ₹800 Cr auto components, Pune, Motherson/Bharat Forge/Sona Comstar type, ₹500 Cr+ P&L | Read as exec search with a peer set, not a list of the three named companies; asked a revenue floor, a candidate location and a title reading; 968 companies fetched | Interpretation is right. Blocked at the revenue column: the web-search AI column fails in this environment |
| 4 | Supply chain directors, large retail chains, India, omnichannel | Curated 34 large chains from knowledge (no company spend); pilot 8 of 10 found; 24 more run; 65 people written; criteria included omnichannel | List quality good; the report was not produced in the same turn (the model announced it, then stopped) |

### What blocked or degraded these runs

1. **Web-search AI columns fail.** `preview_ai_column` first failed with
   `Unsupported value: 'temperature' does not support 0 with this model`, then
   with `No answer from the filter model` on every row. The design call hardcodes
   `gpt-6-luna` (`filter-description-processor.service.ts`), which this workspace's
   OpenAI key does not answer. The temperature fallback landed today; the model
   routing still needs to use the workspace's configured design model.
   This blocks a revenue gate, and Phase 2's filter and calibration.
2. **A curated company list never reaches the Companies tab.** When the agent types
   the companies into `find_people_by_company` (job 4), there are no company rows,
   so the pair state has nowhere to live and the ledger cannot produce a coverage
   line. The tool should upsert the companies it is given, or the playbook should
   require writing the list first.
3. **Run progress reads zero while a chunk runs.** `done` and `updatedAt` are only
   saved at chunk boundaries, and `CHUNKED_RUN_STALL_AFTER_MS` is 2 minutes, so a
   25-company chunk that takes longer looks stalled and the caller sees nothing.
4. **Rung-3 noise.** The judge calls a Chief Product Officer or a General Ledger
   Manager "related" to a VP of Engineering, and those rows were kept. Fixed today:
   a related role must still be about the requested function.
5. **Company fitment was skipped.** Bright Data's own relevance flag is not a
   "chemical manufacturer, not a trader" check. Skill line added.
6. **Browsing context project id is not always in the prompt.** Some turns asked
   which project to use although the browsing context carried it. Worth checking in
   the browser; the agent's fallback (ask) is correct but costs a turn.

## 3. Phase 2: described segments

Goal: a company list built from a description ("fintech startups in Bangalore",
"chemical manufacturers in Gujarat"), filtered cheaply, calibrated with the user and
frozen before any people spend.

### 2.1 Stage A: lenses and one pool

- **Lens tag on every company search.** `search_bright_data_business` (and the index
  when on) take `lens: { kind, label }` and write `lensIds[]` on the row with status
  `candidate`. Kinds: `description`, `industry_codes`, `product`, `directory`,
  `look_alike`, `supply_chain`, `seed_expansion`, `peer`, `upload`, `revenue_band`.
  Files: `search-bright-data-business-tool.ts`, `upsert-outreach-target-companies-tool.ts`,
  `outreach-companies-cache.service.ts` (`OutreachEphemeralCompany.lensIds`).
- **Lens stats** in `get_sourcing_ledger`: per lens candidates, unique, qualified,
  sampled precision, cost. Needs a `lens` field on the list search metadata that
  `computeSourcingFunnel` already reads.
- **Merge** keeps every `lensId` and now also merges by normalised name across a
  domain/no-domain pair (done today).

### 2.2 Company status pipeline

- `OutreachEphemeralCompany.status`: `candidate` → `enriched` → `filtered` / `review`
  → `confirmed` / `rejected`, with `statusReason` and `listVersion`.
- The Companies tab shows `status` as a column and `get_outreach_tab` can filter and
  group on it (the filter compiler already handles any column).
- `People found` stays a view of the pair state.

### 2.3 Cheap filters first, unknown apart

- **Geography column.** Add `location` to `OutreachEphemeralCompany`, populate it from
  Bright Data (`headquarters_city`, `headquarters_country_code`,
  `headquarters_location`) and the upload mapper, show it as a Companies column and
  make `readCellText` read it. This is the one hard filter every Indian query needs.
- `filter_companies` in code (`outreach-company-filter.util.ts`): geography, entity
  type, size band and segment mismatch from fields already on the row. Hard criteria
  fail only on evidence; unknown → `review`.
- Turnover as a structured value: `{ value, currency, fiscalYear, source, estimated }`
  in the enrichment column spec (`outreach-ai-column*.service.ts`).

### 2.4 Calibration and freeze

- `calibrate` step through `ask_questions`: ~10 mixed companies (likely yes,
  borderline, near-threshold reject), accept/reject with a reason, reasons written to
  the brief, rubric updated, re-filter.
- Freeze: `status: confirmed` on kept rows, `listVersion` bumped; later additions pass
  the same gate.
- Skew check and stability stop from lens stats (`aggregate` on sub-segment, region,
  size band).

### 2.5 Probes, freshness, budget

- `probe` recipe in `query-planning` (count from the ludicrous estimate or the index
  hit count; exists via `google_serp_search`; `fresh` via a `freshness` field on
  results).
- `budget_guard` service: per-run caps per source, per-company ceiling, LinkedIn per
  run and per day; every paid tool asks first, the model only reads
  (`get_sourcing_ledger.budgets`).
- Cost estimate at the plan checkpoint: companies × cascade depth × per-source rate.

### 2.6 Sales export

- `outreach_list export` with `projectId`, `tab` and `persona`: sheet and CRM-ready
  CSV, contact columns with provenance, excluded rows apart, coverage line first.
- Contact enrichment for the sales sheet (`enrich-contact.service.ts`), CRM dedupe on
  LinkedIn URL and name+company at write time.

### Phase 2 acceptance

- Five described-segment briefs (Indian mid-market, where the market's labels are
  messy): each reaches a frozen list with a calibration note and no unknown bucket
  hidden in the confirmed rows.
- Every company on the frozen list has a `status` and a reason; the coverage line is
  pair-based.
- Geography and size filters run from the row, not from `otherFields`.
- Lens stats show which lens added the unique companies, and the stability stop fires.
- Cost per qualified company is reported and inside the run cap.

## 4. Phase 3: exec search

- **JD → rubric.** Extend `parse_job_description` / `job_brief_understanding`
  (`job-description.schema.ts`) with must/nice/non-requirement per line and its source
  sentence, observable signals, reporting line, team size, hiring company off-limits,
  a 10-15 peer profile, exclusions, unobservable traits apart, confidence per field,
  chunking for long threads. Add the `jd-to-rubrics` skill part and the JD card through
  `ask_questions`.
- **Peer sets** enter Stage A as the `peer` lens.
- **Tiers** strong / possible / stretch from fitment, rung and freshness; exec search
  defaults to `ladder.maxRung: 2` and `targetType: candidate_pool` with more people per
  company (`maxPeoplePerCompany` from the plan).
- **Off-limits lists** (companies and people) in the plan, enforced in the People write
  path and the export, with an `excluded` terminal state.
- **Exec-search export**: one row per candidate, grouped by company, tier then fit,
  each row linked to its evidence.

### Phase 3 acceptance

- A pasted JD produces a JD card, a person rubric, a company rubric and a peer set,
  all quoted in the final report.
- A client's off-limits company shows as `excluded`, never silently missing.
- Tiers are reproducible from fitment + rung + freshness (no model judgement in the
  tier).

## 5. Phase 4: LinkedIn and Harvest as user-picked sources

- Harvest and own-LinkedIn steps in the cascade, after Google and the company site,
  only when picked in the plan (`sourceStrategy.linkedinMode`).
- **Slow mode**: count continuation pages against a new `searchPagePerDay` window,
  jitter 20-60 s between pages, a 5-10 minute pause every 10 pages, `maxPages: 5` per
  call, stop on any warning/429, LinkedIn steps only inside the background job.
- `account-rate-limit` and `linkedin-search.service.ts` already hold the windows; the
  gap is counting continuations and exposing the remaining budget in the ledger.
- Residual queue: pairs `ambiguous` / `none_found` for reasons the cascade cannot fix,
  handled one at a time with evidence; verifier sample writes precision to the ledger.

### Phase 4 acceptance

- The same run with LinkedIn picked adds people at companies Bright Data and Google
  miss, at a known cost, inside the daily limits, and never in a burst.
- The ledger shows remaining daily LinkedIn budget; the model cannot raise it.
- A LinkedIn warning pauses the run and tells the user.

## 6. Cross-cutting work (do first, all phases depend on it)

1. **Title taxonomy availability.** `TitleExpansionService` talks to arxena-site
   (`ARXENA_SITE_URL`, currently `http://localhost:5050`) for function/grade classes,
   curated titles and boolean queries. When it is down, rung 2 and size-aware seniority
   degrade. Today a curated fallback covers the common Indian families
   (`title-family-fallback.util.ts`); Phase 2 should add a health check and a ledger
   warning, and the infra should keep the site on the same lifecycle as the server.
2. **Skill text rendered from live provider flags.** The provider maps already strip
   switched-off sources; the prose still names the index first. Make every source
   mention a rendered fact (`{{source: default companies}}`) or a marker, so a
   workspace with the index off never reads about it.
3. **Tool learnability.** Keep the `inputShape` contract close to the real schemas
   (nested objects, enums, arrays of objects) and add a test that a spilled
   `learn_tools` result still teaches every required argument of the sourcing tools.
4. **Ledger `call` events.** Each paid step appends one event (tool, source, query,
   hypothesis, results, new unique, cost), as the gap spec section 5.1 says; today only
   `brief`, `score`, `profile_fetch`, `stop` and `checkpoint` exist.
5. **Golden set.** Company × role scenarios for the four query shapes in this
   evaluation (role at startups, plant heads in a state, P&L COO in a revenue band,
   supply chain in retail), with terminal-state rate, high-confidence precision and
   cost per resolved company.
6. **Driver for live checks.** `tmp/agent-runs/drive.mjs` runs a prompt through the real
   chat API, answers `ask_questions` from rules and writes a transcript; keep it for
   every future phase check.

## 7. Order of work

1. **Fix the two blockers from the live runs.** The AI column design/answer model
   must use the workspace's configured model (job 3 cannot gate on revenue until
   then), and `find_people_by_company` must upsert a curated company list so pair
   state and the coverage line always have rows (job 4).
2. **Cross-cutting 1-3** (taxonomy, source rendering, learnability): they decide
   whether any prompt behaves the same in another workspace.
3. **Run progress** (2b.3): save `done`/`updatedAt` per company inside a chunk and
   raise the stall window; a 400-company run must show progress and survive.
4. **Phase 2.3 geography column and cheap filters**, then **2.1 lens tags** and
   **2.2 status**: every Indian list query starts with a location and a segment,
   and the company fitment column (already in the skill) becomes a code filter.
5. **Phase 2.4 calibration and freeze**, **2.5 budget guard**.
6. **Phase 2.6 export**, then **Phase 3** (JD, peers, tiers, off-limits).
7. **Phase 4** LinkedIn/Harvest behind the plan's source choice.

## 7b. Second pass: model routing, speed, and run health

Done after the four live runs, on the findings above.

**Models use the workspace's fast model.** `AI_MODELS_DEFAULT_FAST`
(`openrouter/deepseek/deepseek-v4-flash-0731`) now drives the AI column design
call (`filter-description-processor.service.ts`) and the web-search column alias;
`gpt-6-luna` is no longer hardcoded. OpenRouter slugs go to the OpenRouter client
and are priced from the `openrouter` registry entry (`metered-llm.service.ts`).
The SERP query writer had a 40-token cap, which a reasoning model spent on
thinking and returned null with `finish_reason: length`; it is 400 now, and the
revenue preview answers (Varroc: ₹8,890 Cr) instead of failing every row.

**`find_people_by_company` runs its stages in parallel.**

- The brand and legal-name Bright Data searches run together (each inside its
  share of the pair's cap), behind one global slot equal to the company
  concurrency, so a company is one round trip instead of two and the paid calls
  in flight do not double.
- Jev judging has one shared window (`JEV_CONCURRENCY`, default 12) across all
  companies: 50 companies × 4 batches was opening hundreds of connections and
  the endpoint throttled them; the window keeps the pipe full without the
  retry storm.
- Google queries were already parallel per company (with its own global window),
  and the judge batches were already pooled; both now share the same limits.
- A variant that fails no longer loses the other, and every variant failing is
  still a `source_error` for the pair.

**A typed company list now has rows.** `find_people_by_company` merges the
companies it is given onto the Companies tab before any lookup
(`ensureCompanyRows`), so every pair has a row id, the state writes land, and
the ledger's coverage line works for a curated list (the retail run had none).

**Source order is Bright Data first, and the report now says so.**
`lookupCompany` runs the workspace cache, then Bright Data people, and asks
Google only when no Bright Data person reaches the plan's confidence
(`confidentEnough`). What made it look SERP-led was the bookkeeping:
`sourcesUsed` recorded that a step *ran*, so a Google call that found nobody
still counted. It is now split — `sourcesUsed` is the sources that put a kept
person on the row, `sourcesAttempted` is the steps that ran — and the ledger's
`bySource` counts the former. `FIND_ROLE_GOOGLE_TRIGGER=no_person` makes the
gate stricter: Google is asked only when Bright Data put nobody forward at all
(default keeps the confidence rule and the recall it buys at small companies).

**Source capabilities are now a registry and a tool.** The skill says "ask
which sources", but until now nothing connected the user's words to a filter a
source actually has. Added:

- `sourcing-source-capabilities.constant.ts`: per source, per entity, the
  searchable fields with their kind and allowed values, the fields it does not
  have with the nearest stand-in, and the fields a row returns. The values come
  from the real schemas (Sales Navigator headcount bands and
  `annual_revenue` in `linkedin-search-request.type.ts`, Harvest's
  `companyHeadcount` / `annualRevenue "min-max;USD"` / `currentCompanies` ids or
  URLs in `McpToolSchemas.ts`, Bright Data's field registry).
- `{{sources: capabilities companies|people}}` renders a four-line field table
  into the `companies` and `people` parts, so the model sees which picked source
  can filter on what before it asks.
- `get_source_capabilities({ sources, entity, want, term, rawQuery })`, a
  zero-cost action tool, returns the slice plus ready-to-send questions: the
  exact employee bands, the revenue ranges, and the LinkedIn industry labels that
  match the user's segment (read from `fragments/linkedin-industries.md`, so
  there is one copy of the labels). `rawQuery` returns a `rangeHint` for numbers
  in the request ("₹800 Cr" -> 800 crore).
- `ask_questions` questions now carry `allowFreeText` and `freeTextHint`, so the
  exact requirement can be typed next to the options.
- Source hand-offs (Bright Data company `linkedinUrl` -> Harvest
  `currentCompanies`, industry label -> Sales Navigator `industryIds`, domain ->
  company-site read, person URL -> profile fetch) are declared once and returned
  by the tool; the Harvest step in Phase 4 fills them in code.

Verified live: Bright Data only -> `annualRevenue` comes back as not searchable
with `nearest: employees`; adding Harvest -> `annualRevenue` is searchable on
Harvest and the question is a revenue range; "retail stores" -> the exact labels
`Food and Beverage Retail`, `Online and Mail Order Retail`, `Retail Apparel and
Fashion`, `Retail Appliances, Electrical, and Electronic Equipment`.

**A row now knows what it can be scored on.** The capability map says what a
source can be asked for; this says what came back, per row, and what the
cheapest next step is:

- `sourcing-result-fields.constant.ts`: per source x entity x level, the fields
  returned and the scoring dimensions they answer (a SERP row answers identity
  and evidence, with role only partial; a Bright Data profile adds role, tenure,
  location, skills; a company web step adds revenue).
- `row-coverage.util.ts`: reads the fields a row actually holds (`title`,
  `companyName`, `locationName`, `otherFields.profile`, `industry`, `employees`,
  revenue columns) and returns `answered`, `partial`, `blind` per dimension.
- `enrichment-plan.util.ts`: maps each rubric criterion to a dimension from its
  words (a "P&L" criterion is person evidence, "revenue" is the employer's), then
  plans only the steps that settle an open must-have, inside the budget. A
  criterion no picked source can settle is returned as `unsettleable` with a
  reason; a thin profile is reported as "the profile on the row does not show X",
  not as a missing step.
- `get_scoring_plan({ projectId, tab, criteria })`, free: counts by level, the
  steps with row counts and cost, the unsettleable must-haves, and a three-row
  sample. It is in every learn_tools list and the scoring skill calls it before
  `fetch_profiles` or any AI column.

Live on the fintech project: 52 people, 45 already at profile, 7 needing a
profile fetch ($0.14), 17 whose profile does not show the payments criterion.
Live on the auto-components project: 500 of 968 companies need one company web
column for revenue, $15 estimated — surfaced before spending, which is the point.

**Where the time still goes.** Eight fresh companies take about 2 minutes
end to end, and the first result lands after ~75 s: the tail is a company whose
Bright Data search returns little, so it runs the whole Google phase against a
60 s per-query attempt timeout and a 150 s company deadline (both set in `.env`).
Aggregate throughput is better because 25-50 companies run at once, but a small
call is as slow as its worst company. Recommended env values for a faster local
run (a server restart is needed; `.env` is read at boot):
`FIND_ROLE_SERP_ATTEMPT_TIMEOUT_MS=20000`, `FIND_ROLE_COMPANY_DEADLINE_MS=60000`,
`FIND_ROLE_SERP_HEDGE_DELAY_MS=1500`. The zero hedge delay in the current `.env`
also fired a second SERP attempt beside every healthy query; the code now
floors it at 750 ms.

**Run progress is real.** The chunk job saves `done`, `byState`, `written` and
spend every 5 companies (`onOutcome` on `processCompanies`) instead of only at
chunk boundaries, and the stall window moved from 2 to 6 minutes. A 400-company
run now shows progress while it runs.

## 8. What changed today

Code:

- `build-compact-learn-tools-entry.util.ts`: a spilled `learn_tools` result now
  carries `inputShape` (nested keys, enums, array item shapes, defaults).
- `get-sourcing-ledger-tool.ts`: `brief` accepts prose or a near-miss object
  (`normalizeSourcingBriefDraft`), `roles` may be a string, `persona`/`requestType`
  aliases are mapped, and `projectId` defaults to the tool context.
- `ask-questions.tool.ts`: a missing option label is filled from the description,
  and over-long batches are repaired instead of failing the turn.
- `find-people-cascade.service.ts` / `bright-data-person-fit-filter.service.ts`:
  `criteria` judged per person (`match` / `unknown` / `mismatch`), mismatches
  rejected, unknowns kept as `criteriaUnknown`; the owner pass and rung-3 keeps now
  require the person to run the requested function; the result payload was slimmed.
- `title-family-fallback.util.ts` (new): curated rung-2 equivalents for the Indian
  role families (plant, engineering, operations, supply chain, HR, finance, sales)
  used when the taxonomy service is unreachable.
- `upsert-outreach-target-companies-tool.ts`: merges one company seen with and
  without a domain, and strips ®/™ from names.
- `ai-filter-engine.service.ts` / `filter-description-processor.service.ts`: retry
  without a fixed temperature when the provider rejects it.

Skills:

- Company-first routing for "a role plus a company attribute", and the
  `playbook-company-first` route now loads `requirements` (the data-source question).
- Only sources whose tool is in the catalog are offered or named.
- Sales is the default persona; a company-first run is never asked for a row target.
- The Indian title ladder (plant, engineering, COO, supply chain) and the
  small-company rule.
- Person criteria are passed to `find_people_by_company`; anything unsettled is one
  AI column before the report.
- A company fitment column before people spend when the segment can be faked.
- Confirm a list with counts and at most 10 names, never by paging rows.

Tests: 308 pass across the touched suites (`find-people*`, `title-family-fallback`,
`sourcing-ledger`, `ask-questions`, `build-compact-learn-tools-entry`,
`upsert-outreach-target-companies`, `skill-library`, `skill-content-integrity`).
