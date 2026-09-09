# Plan: Split the `Draft sales reply` agent in Outreach — Candidate Sequencer

> **Status: built.** Where the implementation diverged from this plan:
>
> - The validator is a **native** logic function (`validate-inbound-signals`, dispatched from
>   `OutreachLogicFunctionNativeExecutor` to the pure
>   `validateOutreachInboundSignals` util) rather than sandboxed source. Native keeps the rules
>   unit-testable and avoids a sandbox round trip on every inbound reply.
> - `hasReferral` means "at least one grounded contact"; it does not require a grounded name,
>   because recipients often share a number without repeating the person's name.
> - `shouldNotRespond` is injected into the drafter as `Asked to stop`, which keeps the existing
>   `#DONTRESPOND#` sentinel gate as the single skip path instead of adding a second branch.
> - Re-seeding ships as `2.25.0` workspace command `1785600000101`, scoped with a new
>   `onlyGraphNames` argument so it rewrites only the two graphs carrying the REPLIED branch.
> - The extractor runs on `AUTO_SELECT_FAST_MODEL_ID`; the drafter stays on the smart model.

## Goal
Replace the single 11-key `AI_AGENT` node in the REPLIED branch with **extract → validate → draft**:
a small extraction agent that emits only *verifiable* signals, a deterministic logic function that
resolves and sanitises them, and the existing reply agent narrowed to copywriting. Routing branches
read validated fields instead of raw model output.

## Current state (verified in repo)

The REPLIED branch (`repliedBranchSteps()` in
`packages/twenty-server/src/engine/workspace-manager/standard-objects-prefill-data/data/outreach-workflow-graphs.ts`)
runs one `AI_AGENT` step, `IDS.draftReply` / "Draft sales reply":

- Prompt: `buildOutreachSalesChatDraftPrompt` in
  `src/engine/core-modules/outreach-command/prompts/outreach-inbound-reply-next-step.prompt.ts`
  — ~35 instruction lines mixing sentinel rules, referral rules, channel rules, slot rules,
  and five stage playbooks.
- Step output schema: `OUTREACH_WF_AI_REPLY_OUTPUT` (11 string keys) in
  `outreach-workflow-graph-helpers.ts`.
- Enforced schema: `REPLY_SCHEMA` on the `gtm-outreach-reply` agent row, written by `upsertAgents`
  in `prefill-outreach-workflows.util.ts` (`responseFormat: { type: 'json', schema }`).

Downstream, four side effects branch on **emptiness of individual keys** of that one blob, all
routed through the `IDS.approveReply` form (10 `extraFields` mirroring the draft step):

| Key | Gate | Side effect |
| --- | --- | --- |
| `replyChannel` | `Reply on last inbound channel` MULTI_IF_ELSE | send on LinkedIn / WhatsApp / email |
| `prospectEmail` | `Send details by email?` IS_NOT_EMPTY | `Email details to prospect` |
| `referralEmail` / `referralPhone` | `Referred someone else?` IS_NOT_EMPTY | `Create referred candidate` + email/WhatsApp them |
| `startsAt` | `Meeting time filled?` IS_NOT_EMPTY | `Create calendar invite` |

Nothing between the model and those steps checks that a `referralEmail` appears in the transcript or
that `startsAt` matches an injected slot. The `IS_NOT_EMPTY`-as-control-flow convention is already
known to be brittle — see `SCHEMA_KEY_FALLBACKS` in
`src/modules/workflow/workflow-executor/workflow-actions/ai-agent/utils/build-outreach-mock-ai-agent-result.util.ts`.

Two further facts that shape the design:

- **Each `AI_AGENT` step already costs two model calls** when the agent has
  `responseFormat.type === 'json'`: `AgentAsyncExecutorService.executeAgent` runs `generateText`,
  then a second `OUTPUT_GENERATOR` pass to conform to the schema. Adding agents is not free →
  cap at two agents.
- **Intent classification already lives outside the workflow.** `OutreachInboundReplyClassifierService`
  stamps `outreachConversationStage`, which the draft prompt reads back in. The new extractor must
  *not* re-classify intent — entities only.

## Design overview

```
Load inbound messages  ──►  Get calendar availability
                                     │
                          ┌──────────▼───────────┐
                          │ Extract inbound      │  AI_AGENT (cheap model, small schema)
                          │ signals              │  slot INDEX, channel-switch flag, contacts
                          └──────────┬───────────┘
                          ┌──────────▼───────────┐
                          │ Validate extraction  │  LOGIC_FUNCTION (no LLM, deterministic)
                          │                      │  index → ISO, drop unquoted contacts
                          └──────────┬───────────┘
                          ┌──────────▼───────────┐
                          │ Draft reply          │  AI_AGENT (strong model, copy only)
                          └──────────┬───────────┘
                                     ▼
                          Approve / edit reply (form)  ──►  existing branches
```

Sequential, not parallel: the drafter needs the validated extraction to know cases like "named
someone but gave no contact → ask for contact details".

## Part 1 — `Extract inbound signals` (new agent + step)

New step `IDS.extractSignals`, new agent token `OUTREACH_WF_AGENT_EXTRACT`. Schema (all required,
`additionalProperties: false`):

```json
{
  "acceptedSlotIndex": -1,
  "requestedChannelSwitch": "NONE",
  "prospectEmail": "",
  "referralName": "",
  "referralEmail": "",
  "referralPhone": "",
  "shouldNotRespond": false
}
```

Two deliberate representation changes:

- **`acceptedSlotIndex` (integer index into the injected slots) replaces `startsAt`/`endsAt`.**
  An index is either in range or it isn't, which deletes the whole "never invent times from
  tomorrow / second half / next week" paragraph from the prompt and makes the output checkable.
- **`requestedChannelSwitch` (`NONE | LINKEDIN | WHATSAPP | EMAIL`) replaces `replyChannel`.**
  The current channel is already known from `{{findChats.first.channel}}`; the model only needs to
  say whether they explicitly asked to move.

`shouldNotRespond` replaces the `#DONTRESPOND#` sentinel-in-prose convention for the extractor's
half of the decision. The sentinel stays in the drafter (the `Skip send if #DONTRESPOND#` IF_ELSE
reads `editedBody`, so the form contract does not change).

New prompt builder `buildOutreachInboundSignalExtractionPrompt` beside the existing ones. It gets
the transcript, the injected slots (numbered), and the last inbound channel — not the stage
playbooks, not the tone rules.

## Part 2 — `Validate extraction` (LOGIC_FUNCTION, no LLM)

New step `IDS.validateSignals`, new logic function `validate-inbound-signals`. Outputs:

```json
{
  "startsAt": "", "endsAt": "",
  "replyChannel": "LINKEDIN",
  "prospectEmail": "",
  "referralName": "", "referralEmail": "", "referralPhone": "",
  "hasReferral": false, "shouldNotRespond": false
}
```

Rules (each one is a unit test):

1. `acceptedSlotIndex` in `[0, slots.length)` → copy that slot's `startsAt`/`endsAt`; otherwise both empty.
2. `referralEmail` / `referralPhone` / `prospectEmail` are blanked unless the literal string occurs
   in the transcript (normalised for spacing and phone punctuation). This is the step that stops a
   hallucinated address from creating a candidate record and emailing a stranger.
3. `replyChannel` = last inbound channel, overridden only when `requestedChannelSwitch !== 'NONE'`;
   always one of the three uppercase values.
4. `hasReferral` = a referral name plus at least one surviving contact.

**Implementation route:** name it *outside* `OUTREACH_NATIVE_LOGIC_FUNCTION_NAMES`, so
`LogicFunctionExecutorService` builds and runs the real `sourceHandlerCode` in the sandbox — no
native service, no Nest wiring, no `outreach-logic-function-native.executor.ts` change. Pure string
logic with no I/O is exactly what that path is for.

*Risk:* it depends on the sandbox build pipeline (`buildOneFromSource`) working in every
environment. If that turns out to be unreliable here, fall back to the native path: add the name to
`OUTREACH_NATIVE_LOGIC_FUNCTION_NAMES`, a stub in `outreach-logic-function-native-handlers.const.ts`,
a small service, and a branch in the native executor. Decide this before writing the step.

## Part 3 — `Draft reply` (narrow the existing agent)

Keep `IDS.draftReply` and the `gtm-outreach-reply` agent, but narrow `REPLY_SCHEMA` and
`OUTREACH_WF_AI_REPLY_OUTPUT` to copy only:

```json
{ "message": "", "emailSubject": "", "emailBody": "", "referralMessage": "" }
```

`buildOutreachSalesChatDraftPrompt` loses the channel paragraph, the slot paragraph, and the
referral-extraction lines; it keeps tone, the stage playbooks, the `#DONTRESPOND#` rule, and gains
injected validated facts ("A slot is confirmed: …", "They referred X with no contact details").

## Part 4 — Rewire the graph

In `repliedBranchSteps()`:

- `IDS.calendar.nextStepIds` → `[IDS.extractSignals]`; then `extractSignals` → `validateSignals`
  → `draftReply` → `approveReply`.
- `IDS.approveReply` `extraFields`: `startsAt`, `endsAt`, `prospectEmail`, `referralName`,
  `referralEmail`, `referralPhone`, `replyChannel` repoint from `{{draftReply.*}}` to
  `{{validateSignals.*}}`; `emailSubject`, `emailBody`, `referralMessage` stay on `{{draftReply.*}}`.
  Field ids and names are unchanged, so the form and the branches keep their contract.
- Branch `stepOutputKey`s keep reading `{{approveReply.*}}` — **no branch changes at all**, which is
  what keeps this refactor contained.
- Add `extractSignals` / `validateSignals` to the `IDS` map and `__LF_validate-inbound-signals__` to
  `LF_TOKEN_TO_ID_KEY`.

## Part 5 — Prefill and seeding

- `outreach-workflow-graph-helpers.ts`: add `OUTREACH_WF_AGENT_EXTRACT`; add
  `OUTREACH_WF_AI_EXTRACT_OUTPUT` and `OUTREACH_WF_VALIDATED_SIGNALS_OUTPUT`; narrow
  `OUTREACH_WF_AI_REPLY_OUTPUT`.
- `prefill-outreach-workflows.util.ts`: add `extractSignals` to `getOutreachAgentIds`, add the agent
  row with `EXTRACT_SCHEMA` and a cheap `modelId`, add the token to `replacements`.
  **Refactor first:** the `resolved[...]` nested ternary in `upsertAgents` maps agent name → key by
  hand and does not survive a fourth agent — replace it with a `key` on each definition.
- `prefill-outreach-logic-functions.util.ts`: id in `getOutreachLogicFunctionIds`, definition with
  input/output schema and real `sourceHandlerCode`, plus a sample-output const.
- **New workspace command** `@RegisteredWorkspaceCommand('2.26.0', …)` re-seeding the graph. The
  2.25 command (`2-25-workspace-command-1785600000098-seed-outreach-candidate-sequencer.command.ts`)
  is committed and must not be edited. Note it seeded with `replaceExistingDrafts: false`, so the
  new command needs `true` (or a targeted delete) or the reshaped graph will be skipped.

## Part 6 — Tests and the mock path

- `build-outreach-mock-ai-agent-result.util.ts` — `resolveDraftKind` matches the literal step name
  `'draft sales reply'` and otherwise falls through to `'opener'`, so the new extractor step would
  be silently mocked as a LinkedIn opener under `IS_OUTREACH_MOCK_UNIPILE_ENABLED`. Add an
  `'extract'` kind, and drop the `replyChannel` entry from `SCHEMA_KEY_FALLBACKS` once the reply
  schema no longer carries it.
- Existing specs to update: `data/__tests__/outreach-workflow-graphs.spec.ts`,
  `ai-agent/utils/__tests__/build-outreach-mock-ai-agent-result.util.spec.ts`,
  `core-modules/workflow/services/__tests__/workflow-ai-agent-test-context.service.spec.ts`.
- New spec for the validator's four rules — out-of-range index, contact not in transcript,
  channel switch honoured/ignored, `hasReferral`.
- New spec asserting the reshaped REPLIED branch: every `{{stepId.key}}` template in the form and
  the branches resolves against some upstream step's declared output schema. This is the check that
  would have caught the fat-blob coupling in the first place.

## Sequencing

1. Part 2 validator + its spec, wired between the *existing* agent and the form (rules 2–4 only,
   no index resolution yet). Lands the safety win with the smallest diff and is independently
   shippable.
2. Parts 1 + 3 + 4 — extractor agent, slot index, narrowed drafter, rewire.
3. Part 5 re-seed command, Part 6 test sweep.

## Open questions

- Which model for the extractor? Cheapest that holds a 7-key schema; needs a `modelId` decision.
- Does `emailSubject` belong to the drafter (copy) or the validator (it gates nothing but is reused
  by `Email referred person`)? Currently proposed as drafter output.
- Should `shouldNotRespond` from the extractor hard-skip the drafter (an IF_ELSE before
  `draftReply`, saving two model calls on opt-outs) rather than relying on the drafter to emit the
  sentinel?
