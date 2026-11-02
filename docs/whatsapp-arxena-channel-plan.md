# WhatsApp channel for Ask AI — design

> **Status:** agreed 2026-11-02. One global number, invite-only, zero new tables.
> **Implementation:** [whatsapp-agent-implementation-plan.md](whatsapp-agent-implementation-plan.md).
>
> This document is the *what and why*. Provider details, task breakdown, tests and rollout live in
> the implementation plan.

---

## 0. Decisions

| Decision | Value |
| --- | --- |
| Number | One live global Arxena number (`+1 515-316-3273`) + one warm standby (§6.3) |
| Wake word | None. Every message in the chat goes to the agent |
| Thread | Continuous. One chat = one ongoing relationship |
| Sessions | `/session` = a new, **blank** Ask AI thread; the WhatsApp chat stays one chat |
| Phone ↔ workspace | One connected phone maps to exactly one workspace |
| Onboarding | **Invite-first.** Approval *is* the invitation (§4) |
| Invite delivery | The person texts us, we reply with the existing invite link |
| Templates | None in v1 — nothing is business-initiated |
| Engine | Same `streamAgentChat`, same `aiStreamQueue` worker, same `ToolRegistryService` tools |
| `/session` from web | Yes — same store, `channel = 'WHATSAPP'` is creatable and visible in the sidebar |
| `_chatMessage` mirror | No |
| Quota | Per-workspace daily quota on the shared number, enforced before the model call (§6.2) |

---

## 1. Schema decisions

The first draft proposed three new tables (`workspaceWhatsappNumber`, `whatsappConversation`,
`whatsappConversationSession`). None survive contact with the existing models.

### 1.1 No per-workspace number table

With one global number, the number is platform config, not tenant data:

```
WHATSAPP_AGENT_NUMBERS               // JSON list, one entry per number (§6.3)
WHATSAPP_AGENT_APP_SECRET            // X-Hub-Signature-256 (§5.1)
WHATSAPP_AGENT_VERIFY_TOKEN          // replaces the literal '12345'
WHATSAPP_AGENT_GRAPH_VERSION         // replaces the hardcoded v18.0 / v21.0 mix
```

The existing `workspace.facebook_whatsapp_*` columns stay exactly as they are — they describe the
**outreach** numbers, a different thing. No collision, no migration.

Routing: replace the substring match at `incoming-messages.ts:991-997` with exact equality, and check
the platform number **first**:

```
phone_number_id ∈ WHATSAPP_AGENT_NUMBERS.ids  → agent lane (controller, §5.1)
else                                          → existing outreach lookup (exact match)
```

The first branch must run before `IncomingWhatsappMessages` is constructed, or every agent message
pays for a full-workspace scan (§5.1).

### 1.2 The phone lives on `userWorkspace`

The only fact missing today is **"which workspace does this phone belong to"**:

```ts
// core.userWorkspace additions
whatsappPhoneE164: string | null       // partial unique where not null — one phone, one workspace
whatsappAgentNumberId: string | null   // which of our numbers this chat uses (§6.3)
whatsappActiveThreadId: string | null  // the "current" Ask AI thread for this chat
whatsappConnectedAt: Date | null
whatsappLastInboundAt: Date | null     // drives the 24h window check (§6.1)
whatsappStatus: 'ACTIVE' | 'PAUSED' | 'BLOCKED'
```

`userWorkspace` already uses this partial-unique pattern (`IDX_USER_WORKSPACE_USER_ID_WORKSPACE_ID_UNIQUE`
with `where: '"deletedAt" IS NULL'`), so this is conventional. A user in two workspaces has two rows;
the phone is set on exactly one — the "one phone → one workspace" rule enforced by the database:

```sql
CREATE UNIQUE INDEX ... ON core."userWorkspace" ("whatsappPhoneE164")
  WHERE "whatsappPhoneE164" IS NOT NULL AND "deletedAt" IS NULL
```

Pre-onboarding state does **not** live here — it is the pending invite (§4.2).

**Not to be confused with `workspaceMember.phoneNumber`.** Onboarding's `CreateProfile` step already
collects a phone, but it is a custom `TEXT` field on the `workspaceMember` standard object
(`fields-data.ts:281-292`), saved through the standard record mutation
(`CreateProfile.tsx:184-204`). It is user-editable profile data in the workspace schema: no
uniqueness, no verification, and raw text (only client-side validation). It is therefore used for
**prefill and display only** — the invite dialog defaults to it, and Members shows both numbers when
they disagree. `whatsappPhoneE164` remains the single verified routing key.

### 1.3 A session *is* an `agentChatThread`

| Command | Implementation |
| --- | --- |
| `/session` | `agentChatService.createThread()` (`agent-chat.service.ts:80`) → set `whatsappActiveThreadId` |
| `/session 2` | set the pointer to the 2nd thread **in `/session list` order** |
| `/session list` | `getThreadsForUser()` (`agent-chat.service.ts:135`) filtered to `channel = 'WHATSAPP'` |
| `/session name Q3` | `agentChatService.updateThreadTitle()` (behind the `renameChatThread` mutation, resolver `:400`) |

> `createChatThread()` and `renameChatThread()` are **resolver mutations** (`agent-chat.resolver.ts:144`
> and `:400`). The service methods are `createThread` and `updateThreadTitle` — a channel calls the
> service, never a resolver.

No ordinal column, no `closedAt`, no session table. The only new state is the pointer.

Two consequences:

- **Ordinals follow the list order.** `getThreadsForUser` ranks by `lastMessageAt`, so "thread 2" means
  the second row the user sees, not the second created.
- **The pointer can dangle.** Archiving or deleting a thread from web leaves it pointing at nothing.
  Resolve on every inbound: gone or `deletedAt` → create a fresh one instead of throwing.

### 1.4 One column on the thread

```ts
channel: 'WEB' | 'WHATSAPP'   // default 'WEB'
```

Needed for the `/session list` scope, a sidebar badge, and a channel branch in the delivery hook.
Requires `@WasIntroducedInUpgrade` + a fast instance command, per repo convention.

**Not a default filter.** WhatsApp threads are visible in the web sidebar and creatable there, so a
`WHERE channel = 'WEB'` in `getThreadsForUser` would hide exactly the threads that decision is about.
The filter is a UI affordance; the default is *all*.

### 1.5 `_chatMessage` is display, not source of truth — and is not mirrored

- **`_chatMessage`** (`fields-data.ts:259-737`) is a message log keyed to `person`, `project`,
  `candidate`, `workspaceMember`. History lives in `messageObj`, a `RAW_JSON` array read back as "the
  conversation" by taking the newest row's array (`filter-candidates.ts:167-177`). No thread id, no
  tool calls, no parts, no usage, no pending-question state.
- **`_assistantThread`** (`objects-data.ts:192`) is a legacy `RAW_JSON` thread for the candidate-search
  assistant. Different system, same gap.

`agentChatThread` is the engine's source of truth, and these conversations are seen in the Ask AI
thread list. No mirror, in v1 or after.

---

## 2. Architecture

```
GET/POST /webhook   (one Meta app, one callback URL)
   │
   ├─ verify X-Hub-Signature-256 (rawBody)      ← absent today (§5.1)
   ├─ dedupe on wamid (Redis SETNX)             ← absent on this lane
   ├─ 200 immediately                           ← today: after GraphQL + class construction
   └─ enqueue whatsapp-agent-inbound
            │
            ▼
   phone_number_id ∈ WHATSAPP_AGENT_NUMBERS ?
            │
       yes  ▼                                    no ──► existing outreach pipeline (untouched)
   sender = value.messages[0].from
            │
            ▼
   userWorkspace.whatsappPhoneE164 = sender ?
            │
       yes  ▼                                    no ──► one canned reply (§4.4)
   SendAgentChatMessageService                      no write, no model
            │
            ▼
   aiStreamQueue → StreamAgentChatJob   (same worker as web)
            │
            ├─ message-persisted ─► AgentChatDeliveryPort ─► WhatsApp send (idempotent)
            └─ credits-exhausted ─► one human sentence, never silence
```

Everything below `SendAgentChatMessageService` is the web's own path. That is the "layer across
workspaces" — a thin adapter, not a second engine.

Onboarding is a separate, web-native path (§4): text → canned reply with an **existing invite link** →
the normal workspace-invite acceptance → the phone binds as part of acceptance.

---

## 3. Footprint

| Where | Change |
| --- | --- |
| `core.agentChatThread` | `channel` (1 column) |
| `core.userWorkspace` | 6 columns + partial unique index (§1.2) |
| `core.appToken` | `context.phoneE164` (jsonb — type-only change) + expression index (§4.2) |
| config | `WHATSAPP_AGENT_*` group (§1.1) |
| **new tables** | **none** |
| upgrade commands | one fast instance command for the columns/indexes |

---

## 4. Onboarding: invite-first, and approval *is* the invite

### 4.1 The flow

```
Admin: Settings → Members → Invite   [email] [phone] [role]
   └─ createWorkspaceInvitation() + context.phoneE164        (existing table, one field)

Person: texts +1 515… from that phone
   └─ we look up the pending invite by phone, reply (in-window, free-form) with its link
        │
        ▼
   /invite/<workspaceInviteHash>?inviteToken=…&email=…      (existing page, unchanged)
        → sign in / sign up with Google
        → workspace invite acceptance (existing flow, unchanged)
        → phone binds to the new userWorkspace  (§4.3)
```

There is no approval step because there is nobody to approve: the admin decides by inviting. One
screen, one action, no queue, no statuses.

The admin tells the person to text the number out-of-band — they are already in contact, which is why
they are inviting them. If a "copy invite link" button is ever added to Members, the admin can also
send the link by hand; that is an enhancement, not the v1 path.

### 4.2 The invite link already exists

`sendInvitations` already builds the link we need — `buildWorkspaceURL({ pathname:
getAppPath(AppPath.Invite, …), searchParams: { inviteToken, email } })`
(`workspace-invitation.service.ts:315-330`). We reuse it verbatim, which means **no new page and no new
token**: the invite token is 32 random bytes, single-use, expiring (`INVITATION_TOKEN_EXPIRES_IN`), and
**email-bound** — `validatePersonalInvitation` refuses any login email other than `context.email`
(`workspace-invitation.service.ts:59-90`). A forwarded link is therefore harmless: only the invited
Google account can accept it.

Two additions only:

1. `AppTokenEntity.context.phoneE164?: string`. The context type is closed at
   `app-token.entity.ts:82`, so this is a TypeScript change, not a migration.
2. An expression index so an inbound phone can find its pending invite:
   `CREATE INDEX … ON core."appToken" ((context->>'phoneE164')) WHERE type = 'INVITATION_TOKEN'`.

`createWorkspaceInvitation(email, workspace, roleId)` (`:158`) is unchanged apart from threading the
optional phone through to `generateInvitationToken` (`:420`).

### 4.3 Acceptance binds the phone

Acceptance happens in two places, and both must bind:

- **New user / sign-up with invite:** `signInUpWithPersonalInvitation`
  (`sign-in-up.service.ts:200-275`), after `signInUpOnExistingWorkspace`.
- **Existing user joining:** `checkAccessAndUseInvitationOrThrow` (`auth.service.ts:113-147`) silently
  accepts a pending invitation when the user logs into a workspace they are not yet a member of. This
  one is easy to miss and is the path most invited colleagues will take.

One helper, called from both, before the invitation is invalidated:

```ts
bindPhoneFromInvitation({ invitation, userId, workspaceId })
```

- No `context.phoneE164` → no-op (ordinary web invites).
- Same phone already on this row → no-op (idempotent).
- Phone on another row → leave the invite unconsumed, surface a plain error: *"that number is already
  connected to another workspace"*. Do not silently steal it.
- Otherwise, in one transaction: clear the phone on the user's other `userWorkspace` rows, set
  `whatsappPhoneE164`, `whatsappAgentNumberId` (the live number), `whatsappConnectedAt`,
  `whatsappStatus = ACTIVE`.
- Normalise to E.164 on write — `libphonenumber-js` is already a frontend dependency, and the invite
  value is unvalidated text until this point.
- If the member's profile number (`workspaceMember.phoneNumber`) differs from the connected number,
  show both in Members rather than silently overwriting the profile.

No connect page, no confirmation step, no second token.

### 4.4 Unknown phone

One deterministic reply, rate-limited (one per phone per 24h), **no database writes**:

> Arxena is invite-only. Ask your admin to invite this number — they'll need the email you sign in with.

Nothing is recorded, so there is no queue to drain and no PII to retain.

### 4.5 Edge cases

| Case | Handling |
| --- | --- |
| Phone already connected elsewhere | Acceptance fails with "already connected — `/disconnect` first"; invite stays usable |
| Text from a different number than invited | Falls to the unknown branch; the admin fixes the phone on the pending invite and it works on the next text |
| Link forwarded | Harmless: acceptance requires the invited email |
| Invite expired | Admin resends (`resendWorkspaceInvitation` already exists) |
| Person never texts | Invite sits pending until expiry; visible in Members |
| Known member, wrong phone on `workspaceMember` | Acceptance is authoritative. Never auto-bind on phone match alone |
| User leaves the workspace | `userWorkspace` soft-deleted → phone freed by the partial index; threads cascade |

---

## 5. Request path

### 5.1 Webhook: verify, dedupe, ack, dispatch — in that order

Today: no signature check, verify token is the literal `'12345'`
(`whatsapp-webhook.controller.ts:104`), handling runs synchronously, and the 2,021-line
`IncomingWhatsappMessages` is constructed at `:210` *after* the handler has already done work.

```
1. verifySignature(req.rawBody, req.headers['x-hub-signature-256'])      // HMAC-SHA256, timing-safe
2. if (wamid && !redis.set(`wa:wamid:${wamid}`, NX, EX 7d)) return 200  // Meta retries
3. res.sendStatus(200)
4. enqueue whatsapp-agent-inbound { body }                                // minimal payload
```

`rawBody: true` is already enabled (`main.ts:41`), with a working pattern in
`billing-webhook.controller.ts:67`. Reject unsigned requests with 401 **before** enqueueing, or a
leaked URL is a free agent endpoint.

Dispatch happens here, by `phone_number_id`, before `IncomingWhatsappMessages` exists. That skips both
the class and `executeQueryAcrossWorkspaces` — a scan of every workspace per inbound message
(`incoming-messages.ts:1415-1425`).

Dedupe key is the wamid (`messages[0].id`), not the payload hash: Meta redelivers identical bodies.

### 5.2 Pending questions must be answered, not queued

The resolver **queues** text while a question is pending and returns `queued: true`
(`agent-chat.resolver.ts:216-236`); answering is a separate mutation, `answerAgentChatQuestion`
(`:314`). Copying the queue behaviour onto WhatsApp would mean: the user replies "1", the message
queues behind a question that never gets answered, and the thread sits silent forever.

Policy, injected by the caller so web keeps queueing:

| Caller | Pending question + user text |
| --- | --- |
| WEB | Queue (current behaviour — the UI shows the question card) |
| WHATSAPP | Resolve the pending part with `findPendingQuestionPart` (`utils/find-pending-question-part.util.ts`) and answer it |

Mapping a text reply onto `AgentChatQuestionAnswerInput` — `{ questionIndex, selectedOptionIndices, freeText? }`:

- Single question, reply matches an option (index or label) → `selectedOptionIndices: [i]`.
- Single question, anything else → `freeText`. The API accepts free text, so don't refuse a typed
  answer just because it isn't an option.
- Several questions in one call → ask them **one at a time**, numbered, and accumulate answers until
  every `questionIndex` is covered.
- `/cancel` needs a new, small service method: answering clears the pointer with a **conditional**
  update (`agent-chat.service.ts:597-609`), so a cancel is a plain clear plus a stream cancel. Without
  it, a stuck question is unrecoverable from the chat.
- A stale answer (question already resolved) fails that conditional claim with `QUESTION_NOT_PENDING` —
  reply "that one's already answered" instead of surfacing an error.

### 5.3 The guard lives in the resolver — extract it

`agent-chat.resolver.ts:173-181` runs `validateModelAvailability` + `assertHasAvailableCreditsOrThrow`
**before** `streamAgentChat`. Neither the streaming service nor `StreamAgentChatJob` checks credits
up-front — the job only learns `hasNoMoreAvailableCredits` mid-stream (`stream-agent-chat.job.ts:370-388`,
cutoff at `:539`). The resolver (`:237`) is the **only** caller of `streamAgentChat`, so this is one
seam, not five.

```ts
// engine/metadata-modules/ai/ai-chat/services/send-agent-chat-message.service.ts   (NEW)
send({ workspace, userWorkspaceId, threadId, text, messageId, fileAttachments, pendingQuestionPolicy }) {
  // 1. validateModelAvailability(modelId ?? workspace.smartModel, workspace)
  // 2. assertHasAvailableCreditsOrThrow(workspace.id, modelId)
  // 3. thread lookup + ownership + reapDeadStream (resolver :204-215)
  // 4. pendingQuestionMessageId → QUEUE | ANSWER per policy (§5.2)
  // 5. activeStreamId → queueMessage ; else streamAgentChat
}
```

Both resolver mutations (`sendChatMessage` `:155`, `answerAgentChatQuestion` `:314`) call it. Nothing
else may.

Tools need no adaptor: `chat-execution.service.ts:173-207` builds the actor context from
`userWorkspaceId` and the member's `roleId`, so WhatsApp inherits the member's permissions and approval
rules for free. That is also why §7.5 (phone possession) matters.

### 5.4 Limits

- **Per phone:** 30 messages/hour, then one "slow down" reply. A WhatsApp chat is an easy place to
  leave a loop running.
- **Per workspace:** the daily quota in §6.2, checked before the model call.
- **Per turn:** unchanged from web.

### 5.5 Formatting, and why questions are numbered text

`formatForWhatsApp`: headings → bold lines, tables → `label: value` lines, keep numbered lists, chunk
at ≤4096 chars on paragraph boundaries, no markdown links without a URL line.

`ask_questions` → **numbered text in v1**. The tool allows 2–4 options per question and up to 4
questions per call (`ask-questions.tool.ts:29-52`), so render each question with numbered options and
ask multi-question calls one at a time.

Reply buttons and lists are deferred: the Graph client has no interactive send at all
(`facebook-whatsapp-api.ts` has text, attachment, template, utility — nothing interactive), and inbound
only parses button payloads for workflow forms. That is new code in both directions plus a template
review.

`stream-error` / `credits-exhausted` → one human sentence. Never silence.

### 5.6 Media: voice notes are not optional

On WhatsApp, voice is a primary input. The building blocks already exist for outreach:
`handleAudioMessage` (`facebook-whatsapp-api.ts:723`) downloads and transcribes via
`openai.audio.transcriptions` (`arx-chat-agent-utils.ts:110`).

- v1: audio → download → transcribe → feed as text (prefix `[voice note]`), plus one line
  acknowledging it was heard, not read.
- v1: images/documents → "I can't read those yet" (deterministic, no model call).
- v1.5: images → `fileAttachments` on `streamAgentChat`, which already accepts them.

### 5.7 Outbound delivery

`message-persisted` is published at `stream-agent-chat.job.ts:547-554`, and again for the next queued
message at `agent-chat-streaming.service.ts:630` — both must be delivered.

- Publish is Redis → GraphQL subscription (`agent-chat-event-publisher.service.ts`), i.e. **client-only**.
  There is no server-side consumer to piggyback on. Add an explicit port:
  `AgentChatDeliveryPort.onMessagePersisted({ threadId, messageId })`, defined in `ai-chat`, implemented
  in the WhatsApp module, no-op default. The job imports the port, never WhatsApp.
- **Idempotency:** record the outbound `wamid` per `messageId` (Redis `wa:out:{messageId}`, 7d). A job
  retry must not send twice; Meta has no dedupe of its own.
- Check the window before sending (§6.1). On `131047` (re-engagement required), mark the thread and
  hold — never surface the error to the user.
- Mark the inbound as **read** and show a **typing indicator** before the first token. Cheap, and it is
  the difference between "agent" and "dead number".

---

## 6. Numbers, window, quota

### 6.1 The 24h window is a constraint on *us*

Nothing in v1 is business-initiated: the invite link is sent in reply to the person's own message. So
the window is not an onboarding problem. It constrains two things that remain:

- **Work that finishes after the window** — a sourcing job, a scheduled follow-up. The result cannot be
  delivered free-form; hold it until they write again, or use a template later.
- **Any future reminder** ("your invite is still waiting").

Keep the mechanics, because the first case is real:

- Every inbound sets `userWorkspace.whatsappLastInboundAt`.
- Outbound checks `now - lastInboundAt < 24h` **and** sends from `userWorkspace.whatsappAgentNumberId`.
- A user who texts number B while connected via number A has moved: update `whatsappAgentNumberId = B`
  on inbound, and reply from B.

### 6.2 Quota

Meta's limit is **unique users per rolling 24h per number** (1K → 10K → 100K), not messages, so the
quota is measured in distinct senders:

```
wa:quota:{workspaceId}:{yyyy-mm-dd}   SET of hashed senders, TTL 48h
wa:tier:{phoneNumberId}:{date}        SET of hashed senders (observability only)
```

- Default `WHATSAPP_AGENT_DAILY_UNIQUE_SENDERS_PER_WORKSPACE = 200`, configurable per plan later.
- Checked **before** the model call; over quota → one deterministic reply: *"This workspace has reached
  its WhatsApp limit for today."* No model, no credits.
- Alert at 80% of the number's tier, per number. The tier is the thing that degrades globally.

### 6.3 Two numbers

Config list, one entry per number:

```json
[{ "phoneNumberId": "…", "wabaId": "…", "token": "…", "label": "primary", "state": "live" },
 { "phoneNumberId": "…", "wabaId": "…", "token": "…", "label": "standby", "state": "standby" }]
```

- Inbound is accepted on both; replies always leave from the number that received the message.
- New connections are assigned the `live` number; `whatsappAgentNumberId` is written at connect.
- Rotation = flip `state` between entries. With env config that is a restart; if hot rotation matters,
  promote the list to a table then.
- **Warm-up is real work:** business verification, a few hundred real conversations, two weeks of green
  quality rating. Start warming the standby before you need it.

---

## 7. Risks

1. **Quality rating is per number and now shared by every tenant.** One abusive workspace degrades the
   channel for everyone; outreach numbers are unaffected (own rating). Same WABA is fine.
2. **One number = one blast radius.** A ban or rating collapse takes the channel down for all
   workspaces. Hence §6.3.
3. **Invite-first removes the free-LLM path, not the abuse path.** Uninvited strangers can still text:
   one canned reply per 24h, no writes, no model calls, plus a rate limit on the unknown branch.
4. **Per-tenant quota** (§6.2) — otherwise one workspace eats the daily tier.
5. **Phone possession is not identity.** A stolen unlocked phone inherits the member's tool access,
   because tools are built from the member's role (§5.3). Keep destructive writes behind the existing
   approval path; add a confirm step for irreversible actions.
6. **An invite link is a bearer credential whose only gate is the email binding.** Never issue an
   invite without `context.email`. If phone-only invites ever look tempting, acceptance first needs a
   possession proof — not a relaxed check.
7. **Retention.** These are personal conversations in `agentMessage`. Threads cascade with
   `userWorkspace`, but there is no retention window; decide one before the first enterprise customer
   asks. The unknown-phone branch deliberately writes nothing.
8. **Official Cloud API only.** The repo also has Unipile and Baileys/WhatsApp-Web lanes. Don't mix
   them into this channel — different delivery semantics, different ban risk.

---

## 8. Deferred and open

**Deferred — each has a trigger, so it is a decision, not a gap:**

| Deferred | Trigger | Shape |
| --- | --- | --- |
| Inbound request queue | "text us to get access" becomes marketing copy | one table, 4 columns, a Members tab |
| Reminder template | someone has to be nudged to connect | one Utility template + §6.1 window check |
| Interactive buttons | numbered text proves annoying | interactive send + inbound `button_reply` parsing |
| Copy invite link in Members | admins want to send it by hand | one button + clipboard |

**Open — small, with defaults:**

1. **Quota value per plan.** Default 200 unique senders/day/workspace.
2. **Images in v1 or v1.5.** Default v1.5.
3. **Hot number rotation vs restart.** Default restart.
4. **Retention window** for `agentMessage`. Default: inherit whatever web threads do.

---

## 9. History

| Draft | What it assumed | Why it changed |
| --- | --- | --- |
| v1 | Per-workspace numbers, unauthenticated counterparty lane, wake word | Numbers are platform state; wake word unnecessary |
| v2 | Self-serve signup inside WhatsApp, three new tables | Invite-first removes the abuse surface and the tables |
| v3 | Approval queue, request table, separate connect token | Approval *is* the invitation |
| v3.1 | — | Reuses the existing invite link; no connect page, no second token |
