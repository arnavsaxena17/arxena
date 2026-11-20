---
name: analyze-agent-log
description: >-
  Turn a long Twenty/Arxena AI-chat server log into a decision trace: how the
  agent learned skills, which tools it called and in what order, what it
  understood, why it chose each step given the available skills, tools and
  prompts, what results it got, and where it meandered. Use when asked to
  review, explain, debug, or summarize agent behaviour from `[AI_CHAT]` logs
  (iterm2 dumps in ~/Sync, server logs, bug reports).
---

# Analyze an agent log

The raw log is mostly noise: Nest boot lines, cron ticks, BullMQ chatter, and
multi-MB step dumps of reasoning + tool JSON. Never read it linearly.

Goal of the output: explain the agent's **decision path**, not just list calls.
Every claim about *why* points at evidence — a reasoning quote, a prompt section,
or a tool result in the log.

## 1. Digest first

```bash
python3 .cursor/skills/analyze-agent-log/scripts/chat_log_digest.py <log> \
  --reasoning-chars 400 > /tmp/digest.md
```

- Always pass `--pid` when the log interleaves several Nest processes (a restart
  reuses the file; turns from two servers will interleave).
- Output: per-turn overview table (steps, tool calls, learn calls, tokens, cost,
  outcome) + per-turn timeline of reasoning → call → result → said, plus a
  **Signals** block (repaired tool calls, tool errors, stream failures, repeated
  identical calls, skill reloads, context growth).
- `--turn N` digs into one turn (numbering counts only the turns that survived
  `--pid`). `--reasoning-chars 0` gives full reasoning — use it on the 1–3 turns
  that matter (a "learn loop" turn, a failure turn, the turn that actually did
  the work). `--json` for programmatic follow-up.

The header line gives the run total (tokens, cost, longest ask-only streak).
Read the table before diving: a run where most turns end `asked user` with 1
step and no learn calls is an intake failure, not a tooling failure.

If the runnable check fails after you touch the script:

```bash
python3 .cursor/skills/analyze-agent-log/scripts/self_check.py
```

## 2. What the log actually contains

| Marker | Meaning |
| --- | --- |
| `[AI_CHAT] start …threadId turnId modelId browsingContext` | turn boundary; one user message = one turn |
| `[AI_CHAT] catalogs tools=… skills=… arxena=… external_mcp=… skillNames=[…]` | the **catalog** — everything discoverable, not everything usable |
| `[AI_CHAT] preloadedTools / directTools / coreTools / activeTools names=[…]` | the **actual toolset** the model got. `activeTools` is the ground truth |
| `[SYSTEM_PROMPT_BUILDER] contextSection / toolCatalogSection / skillCatalogSection / fullPrompt` | prompt composition; compare sections across turns to see what the prompt told it to do |
| `[AI_CHAT] promptReady systemPromptLength=…` | prompt size; sudden drops = different prompt path (degraded mode) |
| `[AI_CHAT_STEP] #N output` | reasoning, text, tool-call args, tool-result, error for step N |
| `[AI_CHAT_STEP] #N finishReason=… toolNames=[…] contentPartTypes=[…]` | one line per step; `contentPartTypes` already reveals `tool-error` |
| `[AI_CHAT_TOKENS] step #N … inputTokens(fullContext)=…` | context growth per step; the real cost driver |
| `[AI_CHAT] repairToolCall tool=… error=Model tried to call unavailable tool …` | **prompt/catalog mismatch**: the model was told to use a tool it did not have |
| `[AI_CHAT] toolResult … succeeded=false` | failed tool |
| `[AI_CHAT] stopWhen hitMaxSteps=… askedQuestions=…` + `stream completed steps=` | why the turn ended |
| `[AI_CHAT_TURN_USAGE] … costInDollars=… turnLatencyMs=…` | per-turn economics |
| `[ToolRegistryService] ▶ tool (workspace …)` | the tool actually executed server-side (downstream of `execute_tool`) |
| `StreamAgentChatJob … failed: …` | turn died |

The gap between **catalog** (646 tools, 21 skills) and **activeTools** (often
2–6) is the single most useful thing in the log. Most meanders start there.

## 3. Reconstruct the decision path

For each turn worth explaining, answer in this order. Skip a turn only after
checking its Signals block is empty.

1. **What did it understand?** Quote the first reasoning block. Note whether it
   read the browsing context (projectId, active tab) or guessed.
2. **How did it try to learn?** The learning ladder is `load_skills` (skills) →
   `learn_tools` (schemas) → `get_tool_catalog` (discovery) → `execute_tool`.
   Record which rung it entered and whether that rung existed in `activeTools`.
3. **Was the prompt consistent with the toolset?** If the prompt (or an injected
   browsing-context instruction) names a tool that is not in `activeTools`, that
   is a configuration bug, not model error. Say so.
4. **Why this call next?** Tie each call to a rule quoted from the skill/prompt
   text in the tool result, or to the previous result. If there is no such link,
   label it as the model's own inference.
5. **What did it learn from the result?** The step after a result is the payoff:
   did it adjust, retry, or ignore? `get_tool_catalog` loops that never change
   query strategy are a classic unattended signal.
6. **Why did it stop?** `askedQuestions` / `hitMaxSteps` / failure / completion.

## 4. Name the meander

Meanders are not "the model being dumb" — classify the cause, because the fix
differs. Recurring classes:

| Class | Fingerprint in log | Where the fix lives |
| --- | --- | --- |
| Tool not active but instructed | `repairToolCall … unavailable tool 'X'`, `activeTools` missing X while prompt mentions X | prompt/skill text vs. tool-set selection |
| Catalog thrash | many `get_tool_catalog` with slightly different queries, no new tool learned | prompt guidance + catalog search quality |
| Schema guessing | same tool retried with different arg keys (`skills` vs `skillNames`) | tool schema + skill examples |
| Ask loop | consecutive turns all ending `askedQuestions=true`, each asking a narrower variant of the same question | intake rules in the prompt ("ask once, up front") |
| Skill reload | same skill loaded 2+ times in a turn | context compaction / skill retention |
| Context bloat | `inputTokens` grows ×N inside one turn | result trimming, section loading |
| Plan-without-learn | long reasoning, one call, then ask | skill not found → model fell back to asking |

State cost and latency per turn from the digest table; a turn that spends
600k input tokens to ask one question is a finding, not a footnote.

## 5. Report shape

```markdown
# <run> — agent decision trace

## Verdict (3 lines)
What the agent did overall, whether it succeeded, and the single biggest cause
of wasted work.

## Per-turn trace
| turn | asked | learned | called | outcome | waste |

## Decision walkthrough (the 2–3 turns that matter)
For each: intent → understanding (quote) → learning rung → calls with why →
results → self-correction (or not) → stop reason.

## Meanders
Each with: class, fingerprint line quoted from the log, what it cost
(steps/tokens/$), and the change that removes it.

## Prompt/tool inconsistencies
Prompt says X, activeTools had Y. Cite both lines.

## What worked
Keep it: the paths that behaved as designed, so fixes don't break them.
```

## 6. Rules

- Reasoning text is the agent's own narrative, not proof. Label it "the model
  believed …" and check the tool result before agreeing.
- Never infer a missing tool call as model error without checking `activeTools`
  and `repairToolCall` first. Most "wrong tool" reports are configuration.
- Quote line-level evidence (`turn 4 step 1`) for every meander claim.
- One turn = one user message. Do not merge turns across threadIds.
- Costs: `costInDollars` is per turn; sum turns for a run total, never average.
