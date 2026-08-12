# Plan: External-Channel Human Approval for Workflows

## Goal
Let a workflow **"Human Approval" step** pause a run, push the pending entry + Approve/Reject
controls to the user over **WhatsApp Official (Cloud)**, **WhatsApp Unipile**, **Telegram**, and
**Slack**, and have the decision written back into the workflow run (resuming it) — instead of
only being answerable inside the Twenty UI form.

## Current state (verified in repo)
- **Human form step** = the existing **Form workflow action**:
  - Server: `packages/twenty-server/src/modules/workflow/workflow-executor/workflow-actions/form/form.workflow-action.ts`
  - Settings type: `.../form/types/workflow-form-action-settings.type.ts`
  - Front step: `packages/twenty-front/src/modules/workflow/workflow-steps/workflow-actions/form-action/`
  - Run page renders the pending form; on submit the run resumes.
- **Messaging channels already present** (`packages/twenty-server/src/engine/core-modules/arx-chat/utils/messaging-channel.util.ts`):
  - `WHATSAPP_OFFICIAL` → `FacebookWhatsappChatApi` (`services/whatsapp-api/facebook-whatsapp/`), `MetaWhatsappController`, `whatsapp-webhook.controller` ✅ usable
  - `WHATSAPP_UNIPILE` → `WhatsappUnipileRequestService` / `SendWhatsappMessageTool` ✅ usable
  - **Slack: does not exist** — build from scratch
  - **Telegram: does not exist** — build from scratch
- Workflow message actions exist for Unipile WhatsApp/LinkedIn and email, but **no Slack/Telegram**
  workflow action yet.

## Design overview
```
[Human Approval step] --pauses run--> [pending decision record]
        |
        +---> ApprovalNotifierService --> sends entry + Approve/Reject links
        |        to each configured channel (WA Official / WA Unipile / Telegram / Slack)
        |
[User taps Approve/Reject on phone]
        |
        +---> channel webhook (Meta webhook / Telegram webhook / Slack interaction)
        |        --> DecisionIngestionController (auth via decisionToken)
        |        --> writes decision into workflow run step log
        +---> resumes run (REUSE form-resume internals)
```
The existing Form action's **pause + persist + resume** machinery is the template. The new
"Human Approval" action differs only in *how the decision is collected* (external channel + link
instead of an in-UI form) and *what it sends* (a compact Approve/Reject card, not free-form fields).

---

## Part 1 — Server: `Human Approval` workflow action (pause + persist)
Mirror `form.workflow-action.ts`.

**New files** (under `packages/twenty-server/src/modules/workflow/workflow-executor/workflow-actions/human-approval/`):
- `human-approval.workflow-action.ts` — extends the same base as `form.workflow-action.ts`.
  On execute:
  1. Mark step status `PENDING_DECISION` (new enum value beside the form's pending state).
  2. Persist a `WorkflowRunStepApproval` row: `{ runId, stepId, workspaceId, status:'PENDING',
     decisionToken (random URL-safe 32 bytes), payload (the entry/summary to show),
     channels: string[], createdAt }`.
  3. Build the decision deep-link:
     `https://<SERVER_BASE_URL>/workflow-approval/<decisionToken>?decision=approve|reject`
     (a minimal hosted page OR accept the token via the API directly from channel webhooks).
  4. Call `ApprovalNotifierService.notify(payload, channels, decisionToken)`.
  5. Return control so the executor parks the run (same mechanism the Form action uses to wait).
- `types/workflow-human-approval-settings.type.ts` — `{ messageTemplate: string, channels:
  MessagingChannelValue[] }` (reuse `MessagingChannelValue` from arx-chat util).
- `guards/is-workflow-human-approval-action.guard.ts` — mirror `is-workflow-form-action.guard.ts`.
- Register in `workflow-executor.module.ts` + the action registry (where `Form` is registered).

**Reuse:** the run-resume path. Read `form.workflow-action.ts` + `workflow-run-step-log.workspace-service`
to copy exactly how a pending step is stored and later resumed. Do NOT invent a new pause mechanism.

## Part 2 — Server: `ApprovalNotifierService`
**New:** `packages/twenty-server/src/engine/core-modules/arx-chat/services/workflow-approval/approval-notifier.service.ts`
- `notify(entry, channels, decisionToken)` loops configured channels and dispatches:
  - **WHATSAPP_OFFICIAL**: use `FacebookWhatsappChatApi` / `WhatsappTemplateMessages`
    (`services/whatsapp-api/facebook-whatsapp/`) to send a template/interactive message with two
    quick-reply buttons → deep links `...?decision=approve` / `...?decision=reject`.
  - **WHATSAPP_UNIPILE**: use `SendWhatsappMessageTool` (already wired) — send text with the two links
    (Unipile has no native buttons; links are fine).
  - **TELEGRAM**: new `TelegramMessagingService` (see Part 4) — `sendMessage` with inline
    keyboard buttons (callback_data = decisionToken+decision).
  - **SLACK**: new `SlackMessagingService` (see Part 4) — `chat.postMessage` with Approve/Reject
    Block Kit buttons (action_id carries decisionToken+decision).
- Accept a `RecipientResolver` (workspace setting: which phone/telegram chat/slack channel receives
  approvals). Store recipient per channel in workspace settings (new `WorkflowApprovalSettings` entity).

## Part 3 — Server: decision ingestion + resume
**New:** `packages/twenty-server/src/engine/core-modules/arx-chat/controllers/workflow-approval.controller.ts`
- `POST /workflow-approval/decide` body `{ decisionToken, decision: 'approve'|'reject' }`
  (also `GET /workflow-approval/:token?decision=...` for the simplest link-click fallback).
  - Validate token, load `WorkflowRunStepApproval`, ensure status PENDING.
  - Persist decision into the **workflow run step log** in the SAME shape the Form action writes on
    submit (so the executor resume logic is identical).
  - Mark step `COMPLETED` with output `{ decision, decidedAt }`.
  - **Resume the run** by invoking the same function the form-submit path uses to continue execution.
- Channel webhooks map inbound to this endpoint:
  - **WhatsApp Official**: handle in existing `whatsapp-webhook.controller` (or a new
    `meta-whatsapp-approval.controller`) — parse button reply / link click → call decide.
  - **Telegram**: new `telegram-webhook.controller` — `callback_query` → decide.
  - **Slack**: new `slack-interactions.controller` — `block_actions` → decide.

## Part 4 — Server: Slack + Telegram channels (build from scratch)
**Telegram:**
- `services/telegram/telegram-messaging.service.ts` — wraps Telegram Bot API
  (`sendMessage` with `reply_markup.inline_keyboard`). Config: `TELEGRAM_BOT_TOKEN` (env) +
  webhook registration (`setWebhook`).
- `controllers/telegram-webhook.controller.ts` — `POST /telegram-webhook` → verify secret,
  handle `callback_query` → approval decide. Register webhook via `setWebhook` on startup/settings save.

**Slack:**
- `services/slack/slack-messaging.service.ts` — wraps Slack Web API (`chat.postMessage` with
  Block Kit Approve/Reject buttons) + Incoming Webhook fallback. Config: `SLACK_BOT_TOKEN` +
  `SLACK_SIGNING_SECRET`.
- `controllers/slack-interactions.controller.ts` — `POST /slack/interactions` (Slack validates
  via signing secret) → `block_actions` → approval decide.

Add `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `TELEGRAM_BOT_TOKEN` to `.env.example`
(server) and the arx-chat module wiring.

## Part 5 — Front: UI
**Builder config (new Human Approval step):**
- `packages/twenty-front/src/modules/workflow/workflow-steps/workflow-actions/human-approval/`
  mirror `form-action/` (field config component, settings type, icon). Fields: message template +
  channel multi-select (`WHATSAPP_OFFICIAL`, `WHATSAPP_UNIPILE`, `TELEGRAM`, `SLACK`).
- Register the step in the workflow step catalog (where `Form` is listed).

**Channel connection settings:**
- New settings panel under workspace settings → "Workflow Approvals": configure
  - WhatsApp Official: already connected via arx-chat (reuse).
  - WhatsApp Unipile: already connected.
  - Telegram: bot token + recipient chat id.
  - Slack: bot token + channel / incoming webhook.
  - Default approver recipient per channel.

**Run page (feedback only):**
- On the workflow run page, when a step is `PENDING_DECISION`, show: "Awaiting approval — notified
  via WhatsApp / Telegram / Slack" (chips), plus keep the existing in-UI Approve/Reject buttons as a
  fallback (they hit the same `decide` endpoint). No new heavy UI needed; extend the existing pending
  state component.

---

## Build order (recommended)
1. **Server Human Approval action + pause/persist** (reuse form internals). Verify by pausing a run
   via curl and confirming the `WorkflowRunStepApproval` row + run stays parked.
2. **Decision endpoint + resume** (curl: approve → run resumes, decision recorded).
3. **ApprovalNotifier + WhatsApp Official** (zero new provider — `FacebookWhatsappChatApi` exists).
   End-to-end proof: workflow pauses → WA message with links → tap → run resumes.
4. **WhatsApp Unipile** notifier (reuse `SendWhatsappMessageTool`).
5. **Slack** channel (service + webhook + button).
6. **Telegram** channel (service + webhook + inline keyboard).
7. **Front UI**: approval step config + channel settings + run-page chips.

## Verification checklist (each step)
- [ ] Run pauses and stays parked (no silent completion).
- [ ] Decision token is unguessable and single-use (PENDING→COMPLETED, reject replays).
- [ ] Approve/Reject both resume the run with correct output.
- [ ] Each channel actually delivers the message (check logs / provider dashboard).
- [ ] In-UI fallback Approve/Reject still works.
- [ ] No PII leakage in the deep-link/decision payload beyond what's needed to decide.

## Notes / risks
- Reuse the Form action's resume path exactly — do not build a second pause mechanism.
- WhatsApp Official template messages need pre-approved templates in Meta; for dev, use the
  interactive/button message type or a simple text+links message to avoid template approval lag.
- Slack/Telegram require their own bot infra (tokens, webhook URLs, public ingress) — budget for
  that; it's the bulk of the new work vs WhatsApp which is already wired.
- Keep the decision endpoint idempotent and token-scoped to a single workspace run step.
