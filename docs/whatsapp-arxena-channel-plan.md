# Plan v3.1: WhatsApp as the transport for Ask AI — one global number, invite-only

> **Status:** v3.1. Simplifies v3's onboarding: **approval is the invitation**, so the request table,
> the approver permission flag, the approval screen and the second connect token are all gone. Nothing
> is business-initiated in v1, so the template is deferred too. **Zero new tables.**
>
> **What changed v3 → v3.1:**
>
> - **Approval = invite.** No `whatsappAccessRequest`, no `WHATSAPP_ACCESS_APPROVER`, no queue screen.
>   The admin who decides is the admin who invites, in the Members screen they already use.
> - **One token, not two.** The invite token already is single-use, expiring and **email-bound**, so
>   it serves as the connect token. A forwarded link is harmless — only the invited Google account can
>   accept it. The phone rides on the invite (`context.phoneE164`) purely so connect knows what to bind.
> - **No template in v1.** Nothing is sent before the person acts: either the admin delivers the link
>   by hand, or we reply when that phone texts us. The 24h window stops being an onboarding constraint.
> - **Unknown phones get one canned line and no writes** (§4.4). If "text us to get access" ever
>   becomes marketing copy, the queue comes back then — deferred, not rejected (§9).
>
> **Carried from v3:** the engine seam (`SendAgentChatMessageService`), `channel` on the thread, the
> six `userWorkspace` columns, per-phone and per-workspace limits, the 24h window check, two numbers,
> numbered questions instead of interactive messages, voice notes, and the corrected citations.

---

## 0. Decisions locked

| Decision | Value |
| --- | --- |
| Number | One live global Arxena number (`+1 515-316-3273`) + one warm standby (§6.3) |
| Wake word | None. Every message in the chat goes to the agent |
| Thread | Continuous. One chat = one ongoing relationship |
| Sessions | `/session` = a new, **blank** Ask AI thread; the WhatsApp chat stays one chat |
| Phone ↔ workspace | One connected phone maps to exactly one workspace |
| **Onboarding** | **Invite-first only.** Approval *is* the invitation (§4) |
| **Invite delivery** | Admin copy-pastes the link, or we reply with it when that phone texts us |
| **Templates** | None in v1 — nothing is business-initiated |
| `/session` from web | Yes — same store, `channel = 'WHATSAPP'` is creatable and visible in the sidebar |
| `_chatMessage` mirror | No |
| **Quota** | Per-workspace daily quota on the shared number, enforced before the model call (§6.2) |
| Engine | Same `streamAgentChat`, same `aiStreamQueue` worker, same `ToolRegistryService` tools |

---

## 1. Answers to your four questions (from v2, corrected)

### 1.1 `workspaceWhatsappNumber` — dropped. You were right.

One global number is platform config, not tenant data:

```
WHATSAPP_AGENT_NUMBERS               // JSON list, one entry per number (§6.3)
WHATSAPP_AGENT_APP_SECRET            // X-Hub-Signature-256 (§5.1)
WHATSAPP_AGENT_VERIFY_TOKEN          // replaces the literal '12345'
WHATSAPP_AGENT_GRAPH_VERSION         // replaces the hardcoded v18.0 / v21.0 mix
```

Your existing `workspace.facebook_whatsapp_*` columns stay exactly as they are — they describe the
**outreach** numbers. No collision, no migration of those columns.

Routing change on that side: replace the substring match at `incoming-messages.ts:991-997` with
exact equality, and check the platform number **first**:

```
phone_number_id ∈ WHATSAPP_AGENT_NUMBERS.ids  → agent lane (controller, §5.1)
else                                          → existing outreach lookup (exact match)
```

The first branch must run before `IncomingWhatsappMessages` is constructed, or every agent message
pays for a full-workspace scan (§5.1).

### 1.2 `whatsappConversation` — collapsed into `userWorkspace`

The only thing that genuinely does not exist today is **"which workspace does this phone belong
to"**. It does not need a table:

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
with `where: '"deletedAt" IS NULL'`), so this is conventional, not a new concept. A user in two
workspaces has two rows; the phone is set on exactly one — the "one phone → one workspace" rule,
enforced by the database. Set it and null the user's other rows in one transaction.

Index: `unique, where: '"whatsappPhoneE164" IS NOT NULL AND "deletedAt" IS NULL'`.

Pre-onboarding state does **not** live here — it is the pending invite (§4.2).

### 1.3 `whatsappConversationSession` — dropped. A session *is* an `agentChatThread`.

| Command | Implementation |
| --- | --- |
| `/session` | `agentChatService.createThread()` (`agent-chat.service.ts:80`) → set `whatsappActiveThreadId` |
| `/session 2` | set the pointer to the 2nd thread **in `/session list` order** |
| `/session list` | `getThreadsForUser()` (`agent-chat.service.ts:135`) filtered to `channel = 'WHATSAPP'` |
| `/session name Q3` | `agentChatService.updateThreadTitle()` (behind the `renameChatThread` mutation, resolver `:400`) |

> **Correction to v2:** `createChatThread()` and `renameChatThread()` are **resolver mutations**
> (`agent-chat.resolver.ts:144` and `:400`), not service methods. The service methods are
> `createThread` and `updateThreadTitle`. A channel cannot call a resolver; it calls the service.

No ordinal column, no `closedAt`, no session table. The only new state is the pointer.

Two consequences worth building in:

- **Ordinals must follow the list order.** `getThreadsForUser` ranks by `lastMessageAt`, so
  "thread 2" means the second row the user sees, not the second created. Otherwise `/session 2`
  switches to a thread they cannot see.
- **The pointer can dangle.** Archiving or deleting a thread from web leaves `whatsappActiveThreadId`
  pointing at it. Resolve on every inbound: if the thread is gone or `deletedAt` is set, create a
  fresh one instead of throwing.

### 1.4 `agentChatThread` — one column.

```ts
channel: 'WEB' | 'WHATSAPP'   // default 'WEB'
```

Needed for the `/session list` scope, the sidebar badge, and a channel branch in the delivery hook.
Requires `@WasIntroducedInUpgrade` + a fast instance command, per repo convention.

**Do not make `channel` a default filter.** You decided WhatsApp threads are visible in the web
sidebar and creatable there; a `WHERE channel = 'WEB'` in `getThreadsForUser` would hide exactly the
threads that decision is about. Filter is a UI affordance, default is *all*.

### 1.5 `chatMessage` / `assistantThread` — display, not source of truth. And not mirrored.

Neither can drive the agent:

- **`_chatMessage`** (`fields-data.ts:259-737`) is a message log keyed to `person`, `project`,
  `candidate`, `workspaceMember`. History lives in `messageObj`, a `RAW_JSON` array read back as "the
  conversation" by taking the newest row's array (`filter-candidates.ts:167-177`). No thread id, no
  tool calls, no parts, no usage, no pending-question state.
- **`_assistantThread`** (`objects-data.ts:192`) is a legacy `RAW_JSON` thread for the candidate-search
  assistant. Different system, same gap.

`agentChatThread` is the engine's source of truth. **No mirror in v1 or after** — decided. The Ask AI
thread list is where these conversations are seen.

---

## 2. The architecture, in one picture

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
workspaces" you described.

The connect flow is a second, independent entry point (browser, not webhook):

```
/wa/connect?t=<inviteToken> → Google sign-in → email matches invite → confirm → phone bound
```

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

v3 carried a table for an approval queue. v3.1 removes the queue, so the table goes with it. The same
table comes back the day inbound requests become a real funnel, and §4.4 says what the trigger is —
until then it is deferred, not rejected.

---

## 4. Onboarding: invite-first, and approval *is* the invite

### 4.1 The whole flow

```
Admin: Settings → Members → Invite   [email] [phone] [role]
   └─ createWorkspaceInvitation() + context.phoneE164      (existing table, one field)
        │
        ├─ delivery A: the admin copies the link and sends it in their own WhatsApp
        └─ delivery B: that phone texts us → we reply with the link (in-window, free-form)
                          │
                          ▼
     https://app.arxena.com/wa/connect?t=<inviteToken>
        → Google sign-in; email must equal the invite email
        → "Connecting +1 515… to Acme" → confirm
        → phone bound, token consumed, agent greets in-chat
```

There is no separate approval step, because there is nobody to approve: the admin decides by
inviting. That is the whole simplification — one screen, one action, no queue, no statuses.

**Delivery A alone is enough to ship.** Delivery B is a ~20-line query and one canned reply; add it
when the "text us and get a link" moment feels worth it.

### 4.2 One token, not two

The invite token already has every property a connect token needs: 32 random bytes, single use, an
expiry (`INVITATION_TOKEN_EXPIRES_IN`), and it is **email-bound** — `validatePersonalInvitation`
refuses any login email other than `context.email` (`workspace-invitation.service.ts:59-90`). So:

- A forwarded link is harmless: only the invited Google account can accept it.
- No Redis connect token, no second secret, no cleanup job for abandoned links.
- The phone rides on the invite as `context.phoneE164`, which is what step 3 of §4.3 binds.

Two additions only:

- `AppTokenEntity.context` (closed type at `app-token.entity.ts:82`) gains `phoneE164?: string` — a
  TypeScript change, not a migration.
- An expression index so an inbound phone can find its pending invite:
  `CREATE INDEX ... ON core."appToken" ((context->>'phoneE164')) WHERE type = 'INVITATION_TOKEN'`.

On invite there is nothing to write: `createWorkspaceInvitation(email, workspace, roleId)`
(`workspace-invitation.service.ts:158`) already exists, and the phone is one extra argument threaded
into `generateInvitationToken` (`:420`).

### 4.3 The connect page

1. Show the phone from the invite — *"Connecting +1 515… to **Acme**"* — so nobody binds a number they
   do not hold.
2. Not signed in → the existing Google login. After login, **the email must match** the invite; a
   mismatch is a plain refusal, not a new account.
3. Confirm → write `whatsappPhoneE164`, `whatsappAgentNumberId`, `whatsappConnectedAt`,
   `whatsappStatus = ACTIVE`; null the phone on the user's other rows in the same transaction; consume
   the token.
4. Back to WhatsApp (in-window, free-form): *"You're connected to **Acme**. What do you want to work on?"*

0 workspaces → *"ask your admin to invite you"* and stop. No self-serve creation, which is the point.

### 4.4 Unknown phone

One deterministic reply, rate-limited (one per phone per 24h), **no database writes**:

> Arxena is invite-only. If an admin invited you, text from the number they invited, or ask them to
> send the link again.

Nothing is recorded, so there is no queue to drain and no PII to retain. If "text us to get access"
ever becomes marketing copy, add the request queue then — one table, four columns
(`phoneE164`, `note`, `status`, `createdAt`), one tab next to Members. The trigger is the marketing
copy, not the possibility.

### 4.5 Edge cases

| Case | Handling |
| --- | --- |
| Phone already connected elsewhere | Refuse: "already connected to another workspace — `/disconnect` first" |
| Text from a different number than invited | Falls to the unknown-phone branch; the admin fixes the phone on the pending invite (or re-invites) and it works on the next text |
| Link forwarded | Harmless: acceptance requires the invited email |
| Invite expired | Admin resends (`resendWorkspaceInvitation` already exists) |
| Person never texts, admin never sends the link | Invite sits pending until expiry; visible in Members |
| Known member, wrong phone on `workspaceMember` | Connector path is authoritative. Never auto-bind on phone match alone |
| User leaves the workspace | `userWorkspace` soft-deleted → phone freed by the partial index; threads cascade |

---

## 5. Request path

### 5.1 Webhook: verify, dedupe, ack, dispatch — in that order

Today: no signature check, verify token is the literal `'12345'`
(`whatsapp-webhook.controller.ts:104`), handling runs synchronously, and the 2,021-line
`IncomingWhatsappMessages` is constructed at `:210` *after* the handler has already done work.

```
1. verifySignature(req.rawBody, req.headers['x-hub-signature-256'])   // HMAC-SHA256, timing-safe
2. if (wamid && !redis.set(`wa:wamid:${wamid}`, NX, EX 7d)) return 200   // Meta retries
3. res.sendStatus(200)
4. enqueue whatsapp-agent-inbound { body }                            // minimal payload
```

`rawBody: true` is already enabled (`main.ts:41`), with a working pattern in
`billing-webhook.controller.ts:67`. Reject unsigned requests with 401 **before** enqueueing, or a
leaked URL is a free agent endpoint.

Dispatch happens here, by `phone_number_id`, before `IncomingWhatsappMessages` exists. That skips both
the class and `executeQueryAcrossWorkspaces` — a scan of every workspace per inbound message
(`incoming-messages.ts:1415-1425`).

Dedupe key is the wamid (`messages[0].id`), not the payload hash: Meta redelivers identical bodies.

### 5.2 The pending-question trap (v2 got this wrong)

v2 said: `if (pendingQuestionMessageId) → answerPendingQuestionAndResumeStream({answers:[text]})`.
The resolver does the opposite — when a question is pending it **queues** the text and returns
`queued: true` (`agent-chat.resolver.ts:216-236`); answering is a separate mutation,
`answerAgentChatQuestion` (`:314`). Copying v2 would mean: the user replies "1", the message queues
behind a question that never gets answered, and the thread sits silent forever.

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

### 5.3 Extract the guard, or hand out free LLM

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
`userWorkspaceId` and the member's `roleId`, so WhatsApp inherits the member's permissions and
approval rules for free. That is also why §7.5 (phone possession) matters.

### 5.4 Limits

- **Per phone:** 30 messages/hour, then one "slow down" reply. A WhatsApp chat is an easy
  place to leave a loop running.
- **Per workspace:** the daily quota in §6.2, checked before the model call.
- **Per turn:** unchanged from web.

### 5.5 Formatting, and why questions are numbered text

`formatForWhatsApp`: headings → bold lines, tables → `label: value` lines, keep numbered lists,
chunk at ≤4096 chars on paragraph boundaries, no markdown links without a URL line.

`ask_questions` → **numbered text in v1**. The tool allows 2–4 options per question and up to 4
questions per call (`ask-questions.tool.ts:29-52`), so render each question with numbered options and
ask multi-question calls one at a time. v2 promised reply buttons (max 3) and lists (max 10), but the
Graph client has no interactive send at all (`facebook-whatsapp-api.ts` has text, attachment, template,
utility — nothing interactive), and inbound only parses button payloads for workflow forms. That is
new code in both directions plus a template review. Ship numbered text, add buttons when the rest is
boring.

`stream-error` / `credits-exhausted` → one human sentence. Never silence.

### 5.6 Media: voice notes are not optional

On WhatsApp, voice is a primary input. The building blocks already exist for outreach:
`handleAudioMessage` (`facebook-whatsapp-api.ts:723`) downloads and transcribes via
`openai.audio.transcriptions` (`arx-chat-agent-utils.ts:110`).

- v1: audio → download → transcribe → feed as text (prefix `[voice note]`), plus one line in the reply
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

## 6. One number, then two

### 6.1 The 24h window is a constraint on *us*, not on onboarding

Nothing in v1 is business-initiated: the invite is carried by a human or sent in reply to the person's
own message. So the window is not an onboarding problem. It is a problem for two cases that remain:

- **Work that finishes after the window** — a sourcing job, a scheduled follow-up. The result cannot be
  delivered free-form; hold it until they write again, or use a template later.
- **Any future reminder** ("your invite is still waiting"). That is the first template need, and it is
  deferred with the queue (§9).

Keep the mechanics anyway, because case one is real:

- Every inbound sets `userWorkspace.whatsappLastInboundAt`.
- Outbound checks `now - lastInboundAt < 24h` **and** sends from
  `userWorkspace.whatsappAgentNumberId`.
- A user who texts number B while connected via number A has moved: update `whatsappAgentNumberId = B`
  on inbound, and reply from B.

### 6.2 Quota

Meta's limit is **unique users per rolling 24h per number** (1K → 10K → 100K), not messages. So the
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

Rules:

- Inbound is accepted on both; replies always leave from the number that received the message.
- New connections are assigned the `live` number; `whatsappAgentNumberId` is written at connect.
- Rotation = flip `state` between entries. With env config that is a restart; if hot rotation matters,
  promote the list to a table then, not now.
- **Warm-up is real work, not a spare tyre:** business verification, a few hundred real conversations,
  two weeks of green quality rating. Start warming the standby in phase 4, before you need it.

---

## 7. Risks

1. **Quality rating is per number and now shared by every tenant.** One abusive workspace degrades the
   channel for everyone; outreach numbers are unaffected (own rating). Same WABA is fine.
2. **One number = one blast radius.** Ban or rating collapse takes the channel down for all workspaces.
   Hence §6.3.
3. **Invite-first removes the free-LLM path, not the abuse path.** Uninvited strangers can still text:
   one canned reply per 24h, no writes, no model calls, plus a rate limit on the unknown branch.
4. **Per-tenant quota** (§6.2) — otherwise one workspace eats the daily tier.
5. **Phone possession is not identity.** A stolen unlocked phone inherits the member's tool access,
   because tools are built from the member's role (§5.3). Keep destructive writes behind the existing
   approval path; add a confirm step for irreversible actions.
6. **An invite link is a bearer credential, and its only gate is the email binding.** Never issue an
   invite without `context.email`. If phone-only invites ever look tempting, the connect page first
   needs a possession proof (a code typed into the web page from the phone) — not a relaxed check.
7. **Retention.** These are personal conversations in `agentMessage`. Threads cascade with
   `userWorkspace`, but there is no retention window; decide one before the first enterprise customer
   asks. The unknown-phone branch deliberately writes nothing, so it adds no PII.
8. **Official Cloud API only.** The repo also has Unipile and Baileys/WhatsApp-Web lanes. Don't mix
   them into this channel — different delivery semantics, different ban risk.

---

## 8. What to build

### Phase 0 — the seam (no WhatsApp code)

| File | Change |
| --- | --- |
| `ai-chat/services/send-agent-chat-message.service.ts` | NEW: validate → guard → pending-question policy → queue/stream |
| `ai-chat/resolvers/agent-chat.resolver.ts` | use it in `sendChatMessage` + `answerAgentChatQuestion` |
| `ai-chat/entities/agent-chat-thread.entity.ts` | `channel` + `@WasIntroducedInUpgrade` |
| `ai-chat/services/agent-chat.service.ts` | `createThread({ channel })`, `getThreadsForUser({ channel? })` |

Exit test: web behaves identically; a unit test proves the channel path cannot reach
`streamAgentChat` without passing the guard.

### Phase 1 — plumbing

`whatsapp-agent.module.ts`, signature service, controller rewrite (verify → dedupe → ack → dispatch),
verify token from config, signature unit tests with a real HMAC fixture, dedupe test with a redelivered
body. Reply "coming soon" to a known phone. No model calls.

### Phase 2 — invite + connect

`context.phoneE164` + expression index, phone field in the Members invite dialog, `/wa/connect` page
accepting the invite token, the four edits it makes on confirm, the canned unknown-phone reply,
`/disconnect`.

Exit test: admin invites → person texts → link → Google with the **right** email connects; the **wrong**
email is refused; a forwarded link is refused the same way; an expired invite resends.

### Phase 3 — the agent lane

`SendAgentChatMessageService` wired in, pending-question policy (`findPendingQuestionPart`),
`formatForWhatsApp`, delivery port + idempotency, `/session` `/help` `/whoami` `/disconnect`
`/workspace`, voice notes, error mapping.

Exit test: a 20-message conversation with a tool call, a question answered by "2", a queued message
while streaming, and a job retry that does not double-send.

### Phase 4 — scale

Quota counters + replies, second number in config, tier alerting, ingress rate limits, retention job.

### Tests that pin the contract

`formatForWhatsApp` (tables, chunk boundaries), command parser, invite acceptance (right email / wrong
email / expired / already used), unknown-phone branch (one reply, no writes), router (platform number /
unknown workspace number / connected / unknown phone / duplicate wamid), pending question policy
(option, free text, multi-question, queue), outbound idempotency.

---

## 9. Closed, deferred, open

**Closed:** self-serve (no) · approval (is the invitation) · invite delivery (human, or reply on first
text) · connect token (the invite token *is* it) · templates in v1 (none) · `/session` context (blank) ·
sidebar visibility (yes) · web creation of WhatsApp threads (yes) · `_chatMessage` mirror (no) · quota
(yes) · second number (yes).

**Deferred — each has a stated trigger, so it is a decision, not a gap:**

| Deferred | Build it when | Shape |
| --- | --- | --- |
| Inbound request queue | "text us to get access" becomes marketing copy | one table, 4 columns, a tab next to Members |
| Reminder template | someone has to be nudged to connect | one Utility template + the §6.1 window check |
| Interactive buttons | numbered text proves annoying | interactive send + inbound `button_reply` parsing |

**Still open — small, with defaults:**

1. **Quota value per plan.** Default 200 unique senders/day/workspace.
2. **Images in v1 or v1.5.** Default v1.5.
3. **Hot number rotation vs restart.** Default restart.
4. **Retention window** for `agentMessage` in WhatsApp threads. Default: inherit whatever web threads do.
