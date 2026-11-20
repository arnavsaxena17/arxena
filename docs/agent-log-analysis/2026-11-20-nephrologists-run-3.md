# Nephrologists run 3 — agent decision trace

Source log: `full_run_log.txt` (1.87 MB, 20 Nov 2026), one thread
`39c39571-180c-4876-b33d-3514f8afbc75`, three user messages.
Digest: `2026-11-20-nephrologists-run-3-digest.md`. Raw copy and
`digest.json` stay in `tmp/agent-runs/nephrologists-run-3/`.

## Verdict

**The best run of the three, and the first that actually completes the job.**
Toolset intact all three turns, 0 repairs, 0 failed tools, 0 stream failures,
and — for the first time — the agent reasons itself *out* of a wrong path
mid-turn (rejects the project's Companies tab at step 4 of turn 3) instead of
following a rule off a cliff.

3 turns · 9 tool calls · 261,695 tokens · $0.0116 · 163 s. Turn 3 is 81 % of the
tokens and 90 % of the wall time, 212k of it re-reading a 39.8k-char tool
schema set on every step.

The run is also the cleanest demonstration of the intake gate working: two short
turns of questioning, then one long execution turn that asks nothing further.

## Per-turn trace

| turn | activeTools | steps | calls | outcome | notes |
| --- | --- | --- | --- | --- | --- |
| 1 | 5 (full ladder) | 2 | `load_skills(people)`, `ask_questions` ×2 | asked user | clarification of "top" + count, one batch |
| 2 | 5 | 2 | `load_skills(people-by-company)`, `ask_questions` ×1 | asked user | hospital-set confirmation, 12 named |
| 3 | 5 | 9 | `learn_tools`, `get_sourcing_ledger`, `get_outreach_tab` ×2, `find_people_by_company`, `learn_tools`, `code_interpreter` ×2 | **completed** | 27 new rows, 12/12 pairs |

## Decision walkthrough

### Turn 1 — 2 steps, asks two questions instead of one batch rule

`load_skills(["sourcing"], ["people"])` → 26,376 chars → `ask_questions` with
**two** questions: meaning of "top" and list size.

Understanding is correct and grounded: population search (title + city), Bright
Data people, `projectId` read from browsing context so no "which project" ask.

The reasoning shows it applying the skill's ask threshold correctly rather than
over-asking:

> "ambiguous between 'a ranked shortlist of a few' vs 'all nephrologists in
> Mumbai'. Two readings fetch very different amounts. The guidance: ask when two
> readings would fetch more than ~2× the records."

Worth noticing: the skill says put **every question in one batch**. Turn 1 has
only 2 and turn 2 follows, so the total is 3 questions across 2 turns — not
violating the *content* rule, but it does cost an extra round trip that a single
batch ("what does top mean, how many, and which hospitals count") could have
avoided. The reason it split is visible: it only discovered the hospital-set
dimension *after* the user chose "At top hospitals".

900 reasoning tokens went on deciding whether the measure overlaps with the
count: *"Actually Q1 and Q2 overlap. Let me instead ask Q1 = meaning of 'top'
… Q2 = how many."* Same ambiguity as run 2 (`question` - the skill never says
whether an "estimate"/dipstick counts as a paid fetch), roughly the same cost.

### Turn 2 — correct section switch, one confirmation

User picked "At top hospitals" + ~25. The agent reclassifies without hesitation:

> "This is people-by-company: a role at a known set of top hospitals in Mumbai.
> Per skill: 'A role at companies named … ('top hospitals in Mumbai': name ≤12,
> confirm, never search)' → people-by-company section."

It loads only `people-by-company` (18,550 chars), names exactly 12 hospitals,
and asks one confirmation question with the list in the option description.
Perfect adherence: name ≤12, confirm, never search.

Small inconsistency: the plan line says **rung 2** (equivalents like
Interventional Nephrologist), but the brief it later writes says "Title rung 2"
while the final report claims **"Every pair resolved at rung 1"**. The tool's
actual rungUsed won over the planned ladder — correct outcomes, but the plan
line and the result line use "rung" for two different things, which is exactly
the kind of drift that makes ledgers hard to trust.

### Turn 3 — the interesting turn

**Step 1 — learn before acting.** One `learn_tools` call for four tools with
`aspects:["description","schema"]` (39,822 chars). It also reasons about a
schema gap in advance: *"find_people_by_company takes an explicit companies
list… I don't have ids. Probably name is enough."* That is schema-driven
planning, not guessing.

**Step 2 — write the brief before the lookup.** `get_sourcing_ledger` with a
full `brief` object (requestType, target 25, criteria, geography, caps,
coverage, universe list of 12, assumptions, ladder maxRung 2). This is the
skill's "record it with `get_sourcing_ledger` `brief`, then run" clause, done
before spending.

**Steps 3–4 — the self-correction worth studying.** The ledger reveals the
project already holds 278 rows and 10 company × role pairs. The agent checks the
Companies tab (24 rows) and finds them irrelevant:

> "The Companies tab has 24 companies, but they're a mixed bag — mostly not the
> 12 named hospitals (bookurdoc, Heylth USA, Pride Hotels, Tata Digital, Ginger
> Hotels, SBI General…). So `fromProject` is NOT appropriate."

It then passes the 12 hospitals explicitly, with domains and alternate names it
supplied from its own knowledge — unreliably: one of those guesses
(`Fortis S.L. Raheja Hospital Mahim` → `fortishealthcare.com`) resolved to the
**wrong entity** (Fortis Mulund), and `Apollo Hospitals Navi Mumbai` resolved to
**Apollo Hospitals Mumbai**. It caught both afterwards and flagged them
unprompted:

> "Fortis — I asked for S.L. Raheja (Mahim), but the tool matched Fortis
> Hospital Mulund instead (3 people)."

That is the run's best behaviour: acting on a plausible-but-unverified input,
then auditing the result against it. 2 of 12 entities (17 %) mis-resolved.

**Step 4 latency: 126.4 s** of the turn's 147.6 s — the single paid lookup. All
the agent's own steps are 1.2–3.9 s.

**Steps 5–6 — noticing a reporting tool cannot answer.** `get_outreach_tab`
sorted alphabetically returns the whole tab (278 rows), not the 27 new ones.
It notices immediately (*"the sample is sorted by company name alphabetically, so
it shows the whole tab, not just my 27 new rows"*) and pivots.

**Steps 7–8 — code interpreter over the spilled payload.** The lookup result
spilled to a file; the agent learns `code_interpreter` (2,618 chars), parses the
spilled JSON (`fpc.json` → `result.companies[*].people`), and prints a compact
table. Two interpreter calls: the first dumped raw JSON (its own reasoning on
step 8: *"Print compactly instead of full JSON"*), the second produced the clean
rows. The only genuine waste in the run: ~1.7k tokens and two round trips to
reach a formatting decision it could have made first.

**Step 9 — reports and stops.** Only turn with `finishReason=stop`. Final message
covers coverage line, new-vs-existing rows, spend, a per-hospital highlights
table, the two entity mismatches, and a three-way offer (dedupe / export / save)
held until the user chooses — exactly the skill's "do neither without a yes".

## Meanders

| # | Class | Evidence | Cost | Fix lives in |
| --- | --- | --- | --- | --- |
| 1 | Schema re-read per step | `learn_tools` 39,822 chars at step 1; input grows 13,622 → 29,119 across 9 steps | 212k input tokens, $0.0079 (81 % of run) | prompt cache already covers 88 % of it (cacheReadTokens 27,520 at step 9) — remaining lever is trimming the 4-tool schema dump |
| 2 | Unverified entity metadata | 2/12 hospitals resolved to the wrong branch (Fortis Mulund, Apollo Mumbai) | ~6 rows written to the wrong company | `find_people_by_company` should return the resolved company identity next to the input, so mismatches are machine-detectable rather than self-reported |
| 3 | Reporting by sampling the whole tab | steps 5–6: alphabetic sample of 278 rows to show 27 new ones | 2 tool calls, 4.7k chars | `get_outreach_tab` needs a "rows from this run/job" filter; it is a first-class need and currently worked around with the interpreter |
| 4 | Interpreter formatting round trip | step 7 printed raw JSON, step 8 reprinted compactly | 1.7k tokens, ~4 s | none in the agent — it self-corrected in one step |
| 5 | Intake split across two turns | turn 1 asks 2 questions, turn 2 asks the 3rd (hospital set) | one extra round trip | sourcing skill: when "top" may mean at-named-companies, ask the company-set question in the *same* batch |
| 6 | Rung vocabulary drift | plan line "rung 2", report claims "rung 1", brief says maxRung 2 | none functional; trust cost | ledger/report should read `rungUsed` from the result, not restate the plan |

## Prompt / toolset consistency

Clean for the second consecutive run:

- `activeTools` = `ask_questions, get_tool_catalog, learn_tools, execute_tool,
  load_skills` in all 3 turns.
- 0 `repairToolCall`, 0 `succeeded=false`, 0 `StreamAgentChatJob failed`.
- `systemPromptLength=3618`, sections `availableToolsSection,
  arxenaCatalogSection, toolUsageFooter, final prompt` — the same path as run 1
  turns 10–12 and run 2. With the ladder present, the footer's instructions are
  actionable; without it, run 1 thrashed 65 catalog calls on the identical text.
- `pruning` never triggered; context peaked at 29,119 of 1,048,576 tokens.

The difference between run 1 and runs 2–3 is one config value, not anything the
model did.

## What worked — protect these

- `learn_tools` for 4 tools in one call, with `aspects`, before any execute.
- `get_sourcing_ledger` **with** `brief` before spending.
- Reading the tab to decide `fromProject` vs explicit list — and rejecting the
  tab's mixed contents.
- Catching and reporting the wrong-entity resolution without being asked.
- Offering dedupe / export / save as a choice instead of doing any of them.
- One-line plan statements before each spend ("Writing the brief, then running
  the lookup").

## Compare the three runs

| | run 1 (12 turns) | run 2 (1 turn) | run 3 (3 turns) |
| --- | --- | --- | --- |
| toolset | degraded to 1–2 tools | intact | intact |
| repairs / failures | 4 / 4 | 0 / 0 | 0 / 0 |
| catalog calls | 65 | 0 | 0 |
| ask behaviour | 4 single-question turns | 1 turn, 3 questions | 2 turns, 3 questions |
| outcome | never delivered | intake only | **27 new rows, job done** |
| tokens / cost | 1.64M / $0.053 | 24.9k / $0.0024 | 262k / $0.0116 |

## Sources

- `2026-11-20-nephrologists-run-3-digest.md` (per-step reasoning, calls, results).
- `recent_log.txt` markers: `[AI_CHAT] activeTools count=5 names=[…]`,
  `[AI_CHAT_TOKENS] step #N`, `[ToolRegistryService] ▶ …` (5 executions, 2 of
  them `code_interpreter`), `stopWhen askedQuestions=true` ×2 and
  `finishReason=stop` ×1, no `repairToolCall` / `failed:` lines.
- Sourcing skill intake rules: `skill-metadata/contents/sourcing.md` lines 75, 84,
  86–95.
