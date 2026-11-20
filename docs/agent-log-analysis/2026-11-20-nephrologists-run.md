# Nephrologists run — agent decision trace

Source log: iterm2 capture, 19 Nov 2026 15:53 → 20 Nov 11:25, `[AI_CHAT]` turns only.
Digest: `digest.md` (this folder) · structured: `digest.json`.
12 turns, all one user request ("top nephrologists in Mumbai") re-asked, all
`browsingContext=outreachCommand`, thread per turn (each message = new thread).

## Verdict

The agent behaved correctly every time it got a coherent toolset: turn 1 and
turn 12 both do the right thing immediately — `load_skills(["sourcing"])` with
the `people` section, then learned tool schemas, then executed. Everything
between those two turns is a **configuration defect**, not model error: the
prompt and the injected browsing-context instruction told the model to call
`load_skills`, while `activeTools` contained only `ask_questions` (8 turns) or
`ask_questions, get_tool_catalog` (2 turns). The model, unable to learn anything,
fell back to asking the user — 4 consecutive turns of that, then 33 steps of
catalog archaeology in turn 11 — before turn 12 got the full ladder back.

Run cost: 1,637,408 tokens / $0.0529. Roughly 60 % of it was spent learning
tools that were not in the toolset.

## Per-turn trace

| turn | activeTools | steps | learn calls | outcome | waste class |
| --- | --- | --- | --- | --- | --- |
| 1 | 6 tools incl. `load_skills` | 2 | 1 | asked user (count) | none — correct intake |
| 2 | `ask_questions` | 2 | 1 | failed | tool not active, instructed |
| 3 | `ask_questions` | 2 | 1 | failed | same |
| 4 | `ask_questions` | 2 | 1 | failed | same |
| 5 | `ask_questions` | 1 | 0 | asked user | ask loop, plan-without-learn |
| 6 | `ask_questions` | 1 | 0 | asked user | ask loop |
| 7 | `ask_questions` | 1 | 2 | asked user | ask loop, split into 2 questions |
| 8 | `ask_questions` | 1 | 0 | asked user | ask loop ("skill check" ask) |
| 9 | `ask_questions` | 2 | 1 | failed | tool not active |
| 10 | `ask_questions, get_tool_catalog` | 30 | 29 | asked user | catalog thrash |
| 11 | `ask_questions, get_tool_catalog` | 33 | 36 | failed (empty questions) | catalog thrash → schema failure |
| 12 | 5 tools incl. `load_skills`, `execute_tool` | 16 | 17 | asked user (cleanup choice) | worked; one broad-query detour |

## Decision walkthrough

### Turn 1 — the happy path (control group)

- **Understood**: "find/fetch/search people (target titles, MD/CEO, personas) for
  this campaign" → read `projectId` and active tab `people` from browsing context,
  so it did not ask which project.
- **Learning rung**: `load_skills(["sourcing"], sections:["people"])` — 26,657 chars
  back, 29 available sections, and it loaded exactly one. This is the designed
  behaviour: skill body + only the requested section.
- **Then**: `ask_questions` with target count + meaning of "top" in one batch,
  per the skill's intake gate ("with no target count, ask … before any paid
  fetch"). Correct: no spend before the question.
- **Stop**: `askedQuestions=true`. Two steps, 9.4 s. Nothing to fix here.

### Turns 2–4, 9 — instructed tool that is not active

Reasoning is decisive and correct in each:

> "First step, according to the instructions, is to load the necessary skill:
> `sourcing`" → `load_skills {"skills": ["sourcing"]}`

and the log records:

```
[AI_CHAT] repairToolCall tool=load_skills error=Model tried to call unavailable
tool 'load_skills'. Available tools: ask_questions.
```

Two distinct failure shapes:

1. **Wrong argument key** (`skills` instead of `skillNames`) — the model guessed
   the schema because it could not learn it. It is being punished twice: no tool,
   and no `learn_tools` to discover the right args.
2. **Turn 9 ends in a real stream failure** — after the repair, step 2 asks the
   user a scoped question, and the turn dies on the same unavailable-tool error,
   so even the fallback answer never reached the user.

Fix location: tool-set selection / prompt injection, not the model.

### Turns 5–8 — the ask loop

No failed call, no learn call, one step each. The model still wants to load the
skill, cannot, and degrades into asking the user for permission or advice:

- turn 5: "Sourcing skill — confirm the skill/approach you want me to use"
- turn 6: "Confirm skill — I'm about to load the `sourcing` skill"
- turn 7: two separate `ask_questions` calls in one step (scope + count)
- turn 8: "Skill check — do you want me to use the sourcing skill"

This is the failure mode that costs users trust rather than tokens: it looks
like the assistant is stalling. Fingerprint: consecutive turns with
`askedQuestions=true`, 1 step, 0 learn calls, and reasoning that names a tool it
does not have.

### Turns 10–11 — catalog thrash (the expensive meander)

`get_tool_catalog` is present, `load_skills` / `learn_tools` / `execute_tool` are
not. The model does the only thing it can — searches the catalog for the missing
mechanism, 65 times across two turns:

- turn 10: `"sourcing"` → `"find companies people search"` → `"find"` →
  `categories:["ACTION"]` → `categories:["ARXENA"]` → `"skill load"` →
  `"learn_tools execute_tool"` → …
- turn 11: `"find people"`, `"skills"`, `"load"`, `"skills load_skills"`,
  `server:"unipile"`, `"ask_questions"`, `"project"`, then `"search_people_api"`
  with `limit:1` at steps 19, 20, 21, 24, 26 — same query, shrinking limit,
  no new state.

The reasoning is explicit about the trap:

> "Those are meta-tools not in the catalog. Let me just use learn_tools. Actually
> I should call learn_tools as a tool. Let me try."

It knows the mechanism, cannot invoke it, and keeps searching for it in a catalog
that by definition does not list meta-tools. Turn 10 burned 660k input tokens;
turn 11 burned 354k plus 36 learn calls that were really discover calls. The
prompt growing to a `toolUsageFooter` telling it "first call `learn_tools(…)`"
while `learn_tools` is absent is the root cause, and the model is reasoning
correctly from a false premise.

Turn 11 also ends in `StreamAgentChatJob failed: Value: {"questions":[]}` — an
invalid `ask_questions` payload, i.e. a schema failure on top of the tool failure.

### Turn 12 — recovery, then the job actually done

Full ladder restored: `ask_questions, get_tool_catalog, learn_tools,
execute_tool, load_skills`.

1. `load_skills(["sourcing"], ["people"])` — same as turn 1.
2. `learn_tools(["search_bright_data_business","get_outreach_tab"], aspects
   ["description","schema"])` — note `aspects`: it learned two tools' schemas
   instead of probing.
3. Ran a **Bright Data estimate first**, then read the tab, found 0 new rows,
   correctly applied the skill's source order and moved to LinkedIn.
4. `generate_linkedin_query_set` → broad keyword search → **noticed the
   precision problem itself** ("matched 42k — includes any physician/medicine"),
   then `search_linkedin_parameters(parameterType: JOB_TITLE)` → role-based
   search → 113 nephrologists, 61 new, exhausted via `search_linkedin_continue`.
5. Read `get_sourcing_ledger` for the funnel, then asked the user how to clean up
   the ~85 low-precision rows.

The only real meander here is the broad keyword pass that wrote ~85 non-nephrologist
rows to the user's tab. The model caught it, self-reported it, and asked before
acting — but the rows were already written. That is a skill-guidance gap
(precision-first query construction), not a reasoning gap.

## Meanders, classified

| # | Class | Evidence | Cost | Fix lives in |
| --- | --- | --- | --- | --- |
| 1 | Tool not active but instructed | `repairToolCall tool=load_skills … Available tools: ask_questions` ×4; `activeTools count=1` ×8 turns | 4 dead turns, ~35k tokens | tool-set selection: if the prompt/skill/browsing-context names `load_skills`, it must be in `activeTools` |
| 2 | Ask loop | turns 5–8, `askedQuestions=true`, 0 learn calls, reasoning quotes the missing tool | 4 turns, $0.0017 | intake rule ("ask once, up front") cannot be honoured without the tool to read the intake rules |
| 3 | Catalog thrash | turns 10–11, 65 `get_tool_catalog` calls incl. `limit:1` repeats of `search_people_api` | 1.01M input tokens, $0.0275 | never expose `get_tool_catalog` without `learn_tools`/`execute_tool`; a catalog-only toolset is a dead end |
| 4 | Schema guessing | `{"skills":[…]}` vs `{"skillNames":[…]}`; turn 11 `{"questions":[]}` | 2 repaired calls, 1 stream failure | args are unlearnable when `learn_tools` is absent |
| 5 | Skill reload | `sourcing` loaded twice in turn 12 (`people`, later `src-linkedin`) — legitimate section top-up, not a bug | ~45k chars | none; note it only so it is not mistaken for waste |
| 6 | Context bloat | turn 12 input 3,112 → 45,546 (×14.6); turn 10 → 660k total | $0.018 in one turn | trim tool results; section loading is already the right lever |
| 7 | Precision detour | turn 12 step 7 broad keyword search wrote ~85 rows, self-corrected at step 8 | ~85 noisy rows | sourcing skill: require JOB_TITLE/role filter for title-population searches |

## Prompt / toolset inconsistencies to fix

1. `activeTools=[ask_questions]` while the browsing-context instruction says
   "1. load_skills(["sourcing"]) with sections: ["people"]". Reproduced in
   turns 2, 3, 4, 9.
2. `activeTools=[ask_questions, get_tool_catalog]` while `toolUsageFooter` /
   core prompt says "First call `learn_tools({toolNames: […]})`". Reproduced in
   turns 10, 11.
3. `toolCatalogSection` advertises 646 tools and `skillCatalogSection` 21
   skills in **every** turn, including the ones where nothing is callable. The
   catalog is not a promise the model can act on.
4. `systemPromptLength` drops 11,035 → 3,618 → 3,693 → 3,620 across turns while
   the run continues: the prompt path changes between turns, which is consistent
   with the degraded toolset but is not signalled to the model.

Cheapest guard: at turn start, assert `activeTools ⊇ {tools named in the
injected context section}` and either inject them or strip the instruction.

## What worked (protect these)

- Turn 1 / turn 12 step 1: section-scoped `load_skills` — 26.6 KB, one section,
  exactly as designed.
- `learn_tools` with `aspects:["description","schema"]` for several tools at once.
- Estimate-before-spend on Bright Data, and the source-order fallback when it
  returned 0 new rows.
- Self-correction on the broad query, and asking before destructive cleanup.
- Ledger read before reporting — the final summary distinguishes new rows from
  tab totals.

## Sources for this trace

- `digest.md` turn sections 1, 2–4, 5–8, 10, 11, 12 (call args and reasoning quotes).
- `recent_log.txt` markers: `[AI_CHAT] activeTools count=… names=[…]`,
  `[AI_CHAT] repairToolCall …`, `StreamAgentChatJob … failed: …`,
  `[AI_CHAT] catalogs …`, `[AI_CHAT_TOKENS] step #N`.
