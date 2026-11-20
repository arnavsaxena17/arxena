# Agent log analysis

Decision traces of the AI chat agent, produced with
[`.cursor/skills/analyze-agent-log`](../../.cursor/skills/analyze-agent-log/SKILL.md).

Read the report first — it explains *why* the agent did what it did. The digest
is the raw per-turn timeline it was built from.

| run | report | digest | finding |
| --- | --- | --- | --- |
| 2026-11-20 nephrologists | [report](2026-11-20-nephrologists-run.md) | [digest](2026-11-20-nephrologists-run-digest.md) | 9 of 12 turns ran without `load_skills`/`learn_tools` in `activeTools` while the prompt told the model to call them; 1.64M tokens, $0.053 |
| 2026-11-20 nephrologists run 2 | [report](2026-11-20-nephrologists-run-2.md) | [digest](2026-11-20-nephrologists-run-2-digest.md) | toolset intact, 0 repairs; clean 2-step intake with one batched 3-question ask; 24.9k tokens, $0.0024 — the control case for run 1 |
| 2026-11-20 nephrologists run 3 | [report](2026-11-20-nephrologists-run-3.md) | [digest](2026-11-20-nephrologists-run-3-digest.md) | 3 turns, 0 repairs, job done: 12/12 hospital pairs, 27 new rows, $0.0116. Self-corrected away from the project's Companies tab and flagged 2 wrong-entity matches |

## Regenerate

```bash
python3 .cursor/skills/analyze-agent-log/scripts/chat_log_digest.py <log> \
  --json tmp/agent-runs/<run>-digest.json > tmp/agent-runs/<run>-digest.md
```

Then write the report beside it using the §5 template in the skill. Move both
here once reviewed; raw logs and JSON stay in `tmp/agent-runs/` (gitignored).
