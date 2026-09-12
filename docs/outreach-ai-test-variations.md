# Outreach AI test variations

Scenario catalog + DeepSeek-first live eval for Candidate Sequencer AI nodes.

## Quick commands

```bash
# Offline contracts (CI-safe)
cd packages/twenty-server && npx jest outreach-ai-scenario-catalog.spec \
  --config=jest.config.mjs

# Live must suite on DeepSeek V4 Flash 0731
cd packages/twenty-server && \
  OUTREACH_AI_LIVE_LLM=1 \
  OUTREACH_AI_LIVE_MODEL=openrouter/deepseek/deepseek-v4-flash-0731 \
  npx jest outreach-ai-scenario.live.spec --config=jest.config.mjs --runInBand

# All priorities
OUTREACH_AI_LIVE_LLM=1 OUTREACH_AI_LIVE_PRIORITY=all \
  npx jest outreach-ai-scenario.live.spec --config=jest.config.mjs --runInBand

# Escalate failing scenarios up the ladder
OUTREACH_AI_LIVE_LLM=1 OUTREACH_AI_LIVE_ESCALATE=1 \
  npx jest outreach-ai-scenario.live.spec --config=jest.config.mjs --runInBand
```

Requires `OPENROUTER_API_KEY` in `packages/twenty-server/.env`.

Report: `tmp/outreach-ai-live-eval-report.json` (or `tmp-outreach-ai-live-eval-report.json` under `packages/twenty-server`).

## Model ladder

1. `openrouter/deepseek/deepseek-v4-flash-0731` (default)
2. `openai/gpt-4o-mini`
3. `openai/gpt-4.1`
4. `anthropic/claude-sonnet-4-6`

Tune prompts for DeepSeek first. Escalate a node kind only after 1–2 prompt iterations still fail hard extract/qualify cases.

## Corpus

Curated slices from Unipile dumps (`naresh-positive-sn-chats.json`, `naresh-negative-sn-chats.json`, `25-chats.json`), folded via `foldUnipileChatMessagesToTranscript` (`us:` / `them:`, oldest→newest).

Manual Test-tab (workflow `5e886f7e-cd4b-5e6f-9fc6-a87da42be703`): pick a REPLIED candidate whose transcript matches a scenario; credits/writes are real.

## Scenario matrix

| Id | Priority | Node | Source | Stage / note |
| --- | --- | --- | --- | --- |
| extract-book-slot-explicit | must | Extract | synthetic | slot index 0 |
| extract-relative-time-sanil | must | Extract | sanil-suthar | relative → -1 |
| extract-vague-time-pulkit | must | Extract | pulkitlive | vague → -1 |
| extract-channel-email-gaurav | must | Extract | gaurav-zatakia | EMAIL + address |
| extract-channel-switch-whatsapp-kamallath | must | Extract | kamallath | WHATSAPP |
| extract-referral-ashlyn-with-contact | must | Extract | ashlyn-antony | referral + contact |
| extract-referral-rajesh-no-contact | must | Extract | rajesh-gupta-recyclekaro | name only |
| extract-snooze-kunal-june | must | Extract | kunal-sikchi | not opt-out |
| extract-opt-out | must | Extract | synthetic | shouldNotRespond |
| draft-reply-intent-kunal-clarify | must | Draft reply | kunal | INTENT |
| draft-reply-follow-up-meeting-pulkit | must | Draft reply | pulkit | FOLLOW_UP_MEETING |
| draft-reply-meeting-booked-sunil | must | Draft reply | sunil | MEETING_BOOKED |
| draft-reply-details-email-gaurav | must | Draft reply | gaurav | email body |
| draft-reply-referral-ask-contact-rajesh | must | Draft reply | rajesh | ask contact |
| draft-reply-snoozed-kunal-june | must | Draft reply | kunal | SNOOZED |
| draft-reply-opt-out | must | Draft reply | synthetic | `#DONTRESPOND#` |
| first-message-cold / with-slots | must | First LI message | synthetic | opener |
| qualify-go-true / false | must | Qualify | synthetic | ICP gate |
| connection-note-cold / referral | pass | Connection note | — | ≤280 |
| post-reply-fu1/fu2 | pass | Post-reply FU | pulkit silence | |
| accepted-fu1/2/3 | pass | Accepted FU | negative silence | |
| fallback-email-ignored | low | Fallback email | silence | |
| meeting-reminder / no-show / reschedule | low | Meeting | sunil chase | |

## Tune log

| Date | Scenario | Failure | Change |
| --- | --- | --- | --- |
| 2026-09-11 | extract-book-slot-sanil | DeepSeek correctly returned -1 for "2:30 tomorrow" | Split into `extract-relative-time-sanil` (-1) + `extract-book-slot-explicit`; clarified extract prompt that relative times never map to slots |
| 2026-09-11 | extract-referral-ashlyn | Phone country-code / prospectEmail leak of referral email | National-10 phone compare; prompt: prospectEmail is recipient-only; soft-accept referral email leak |
| 2026-09-11 | extract-snooze-kunal | Earlier email turn polluted extract | Truncate snooze fixture to last exchange only |
| 2026-09-11 | draft-reply-* | Omitted empty emailSubject/emailBody | Prompt requires all four keys with `""`; Zod defaults empty strings |
| 2026-09-11 | qualify-go-* | Structured output schema mismatch on DeepSeek | Live qualify scores `go` only; text-JSON fallback if `generateObject` fails |
| 2026-09-11 | extract-channel-switch-whatsapp-kamallath | WHATSAPP ok but dropped own email | Prompt: still copy prospectEmail when they share email alongside WhatsApp ask |
| 2026-09-11 | must + pass + low | DeepSeek 0731 full catalog | All scenarios passed after tune — no model escalation required |

## Code map

- Catalog: `prompts/fixtures/outreach-ai-scenario-catalog.ts`
- Live runner: `prompts/fixtures/run-outreach-ai-live-eval.ts`
- Transcripts: `prompts/fixtures/transcripts/outreach-ai-naresh-transcripts.ts`
- Offline: `prompts/__tests__/outreach-ai-scenario-catalog.spec.ts`
- Live: `prompts/__tests__/outreach-ai-scenario.live.spec.ts`
