# Nephrologists run 2 — agent decision trace

Source log: `new-log-neph.txt`, 20 Nov 2026 (~98 KB), one `[AI_CHAT]` turn.
Digest: `digest.md` · structured: `digest.json` (both in this folder; raw-log copy kept).
Thread `d2ce9313-04b5-464d-b6eb-6e56f52fc893`.

## Verdict

Clean turn. The toolset was correct this time (`ask_questions,
get_tool_catalog, learn_tools, execute_tool, load_skills` — 5 tools, no repairs,
no failures, 0 meander signals), and the agent followed the intended flow end to
end: load one skill section → read the browsing context → apply the skill's
intake gate → ask the user one batched question set → stop before any spend.

No tool-call meander. The only cost is a **reasoning** one: 1,305 reasoning
tokens (73 % of output tokens) spent re-reading the same intake rules and
arguing with itself about whether to run an estimate before asking. That is a
prompt-cost issue, not a behaviour issue — the answer it reached was right.

Run cost: 24,900 tokens, $0.00236, 9.8 s, 2 steps. Compare run 1 turn 1
(18,504 tokens, $0.00216, same shape): the batched ask now carries a third
question (budget) and grew the prompt, but stayed 2 steps.

## Turn 1 — what happened

| step | latency | tool | result |
| --- | --- | --- | --- |
| 1 | 1,362 ms | `load_skills {"skillNames":["sourcing"],"sections":["people"]}` | tool-result, 26,841 chars, succeeded |
| 2 | 8,440 ms | `ask_questions` (3 questions) | tool-result, 2,154 chars, succeeded |

`stopWhen hitMaxSteps=false askedQuestions=true` → the turn ends awaiting the
user's answer, which is the design for a population search with no target count.

### Understanding

Correct and grounded in the injected context, not guessed:

> "This is a population: a title (nephrologist) in a city (Mumbai). The project
> already exists: ‘Nephrologists in Mumbai’ (projectId given). The active tab is
> people."

It also correctly classified the request shape — population search, not
people-at-named-companies — so it never opened the "top hospitals" path.

### Learning flow

The intended ladder, entered at the right rung:

1. `load_skills` with **one** section (`people`) — 26,841 chars returned out of
   the skill's 29 available sections. Section-scoped loading is the token lever
   the skill was designed around, and it was used.
2. It then deferred tool-schema learning (`learn_tools`) until after intake —
   correct, because the next move depends on the user's answer.

No `get_tool_catalog` probing at all. Contrast run 1 turns 10–11, which made 65
catalog calls because `learn_tools`/`execute_tool` were missing; here the ladder
was intact and the model did not wander.

### The decision it actually reasoned about

The interesting part is step 2's reasoning: it debates three rules against each
other and resolves them correctly.

- Intake gate: "With no target count, ask for it with `ask_questions` before any
  paid fetch."
- Whether the Bright Data **estimate** counts as a paid fetch (it samples slices
  and writes probe rows, "a few cents").
- Whether "top" is ambiguous enough to ask, weighing the skill's own threshold
  ("two readings fetching more than ~2× the records or the cost").

It considered deciding "top" silently ("the skill says decide silently: title
synonyms, slicing") and then chose to ask anyway, because senior-only vs all
practising nephrologists can differ by more than 2×. That is the skill's own
rule applied, not an over-ask. It arrived at the correct reading:

> "'Ambiguous → Dipstick (query-planning), then ask with what it showed.' Hmm,
> this is getting complex. Let me keep it simple and follow the most specific
> rule: population search with no target count → ask for target count before
> paid fetch."

### What it asked

One batch, three questions, recommended options marked, free text allowed
everywhere — matching the "ask once, up front" rule that run 1 turns 5–8 broke
across four separate turns:

| header | question | options | recommended |
| --- | --- | --- | --- |
| How many | land on the People tab | ~25 / ~50 / ~100 / Everyone in Mumbai | ~25 |
| "Top" means | how to read "top" for scoring | Senior / senior-most only · All practising · Reputed / well-known | Senior |
| Budget cap | Bright Data bills ~$0.002 per record | $1 / $2 / $5 / $10 | $2 |

It also stated the plan before the answer arrived, so the user is not asked
blindly: population search, Bright Data people (ludicrous), writing to the
"Nephrologists in Mumbai" People tab.

One design observation: the budget question converts record count into dollars
using the skill's rate, which is the right unit for the user — but the count
question and the budget question overlap. Answering "~100" already fixes the
budget under that rate; the cap only binds for "Everyone in Mumbai". Worth
noticing, not a defect.

## Meanders

None in the tool flow. Signals block is empty.

The one soft finding is reasoning volume: step 2 emitted 1,305 reasoning tokens
for a two-question decision, including a politely circular debate about whether
the estimate is a "fetch". The log shows the loop verbatim:

> "Actually, let me reconsider — do I need to ask before estimate? … The estimate
> is a paid call … Let me just ask."

Three separate restarts of the same branch before committing. Cost ~$0.0005 and
~7 s of the 9.8 s turn. Class: **prompt ambiguity**, not model error — the skill
text never says whether an estimate counts against "before any paid fetch". One
sentence in the sourcing skill ("the estimate is a paid call; ask before it")
removes the loop.

## Prompt / toolset consistency

Clean for the first time across all three logs reviewed:

- `activeTools` = 5 tools, all five named by the prompt path are present.
- 0 `repairToolCall`, 0 `toolResult … succeeded=false`, 0 `StreamAgentChatJob
  failed`.
- `systemPromptLength` 3,618 with `toolUsageFooter` — same prompt path as run 1
  turns 10–12, and here the toolset matched it, so the footer's instructions
  (`learn_tools` → `execute_tool`) are actionable.

This turn is the control that proves run 1's 10 bad turns were a tool-set
regression: same prompt, same skill, same model, and the behaviour is correct
the moment `load_skills`/`learn_tools`/`execute_tool` are in `activeTools`.

## What to protect

- Section-scoped `load_skills` (one of 29 sections, 26.8 KB).
- Batched intake: 3 questions, 1 step, before any spend.
- Deferring `learn_tools` until after intake.
- Stating the plan in the same message as the questions.

## Compare with run 1

| | run 1 (12 turns) | run 2 (1 turn) |
| --- | --- | --- |
| activeTools at start | 6, then degraded to 1–2 | 5, intact |
| repairs / failures | 4 repairs, 4 stream failures | 0 / 0 |
| catalog calls | 65 | 0 |
| ask behaviour | 4 consecutive single-question turns | 1 turn, 3 questions |
| tokens / cost | 1.64M / $0.053 | 24.9k / $0.0024 |

## Sources

- `digest.md` step 1 and step 2 blocks (reasoning quote, tool args, results).
- `recent_log.txt` markers: `[AI_CHAT] activeTools count=5 names=[…]`,
  `[AI_CHAT] stopWhen … askedQuestions=true`, `[AI_CHAT_TURN_USAGE] …`
  (no `repairToolCall`, no `failed:` lines present).
