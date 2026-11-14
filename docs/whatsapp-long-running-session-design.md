# WhatsApp agent — long-running session design

> **Parent:** [whatsapp-arxena-channel-plan.md](whatsapp-arxena-channel-plan.md),
> [whatsapp-agent-implementation-plan.md](whatsapp-agent-implementation-plan.md).
> **Status:** design only, nothing implemented. Supersedes T3.5 (delivery port) and closes the
> gap T3.1 left open (session lifetime).
>
> This document is the *what and why* for making the WhatsApp lane a single continuous session
> instead of a per-message request.

---

## 0. The problem, precisely

The data model is already a long session: one `agentChatThread` per phone, kept in
`userWorkspace.whatsappActiveThreadId` and recreated when it dangles
(`whatsapp-agent.service.ts:250`). The transcript, turns, parts and usage all live in Postgres.

What is *not* long-lived is the turn. Four concrete defects:

| # | Defect | Evidence |
| --- | --- | --- |
| 1 | The reply waiter is bounded at 4 minutes, then answers "try again" | `REPLY_TIMEOUT_MS = 240_000` (`whatsapp-agent.service.ts:22`), poll loop `:309-357` |
| 2 | The completion event is published and discarded — nothing server-side consumes it | `message-persisted` at `stream-agent-chat.job.ts:551` and `agent-chat-streaming.service.ts:630`; publisher `agent-chat-event-publisher.service.ts:49` is Redis → GraphQL only |
| 3 | Inbound runs on the webhook request thread with in-process dedupe | `void this.whatsappAgentService.handleInbound(...)` (`whatsapp-webhook.controller.ts:200`); `seenWamids: Map` (`whatsapp-agent.service.ts:54`) |
| 4 | The context cliff is terminal — a too-long thread can never continue | `chat-execution.service.ts:462` throws `CONTEXT_WINDOW_EXCEEDED`; `message-pruning.service.ts:23` only strips reasoning and old tool calls |

Defect 1 is why a 6-minute sourcing run fails. Defect 2 is why nothing can be delivered after the
waiter dies. Defect 3 is why a deploy mid-turn loses a message with no retry. Defect 4 is why a
thread that survives for months eventually stops answering forever.

---

## 1. Invariants

1. **The thread is the session.** No per-turn process, no in-memory conversation state. Anything
   the session needs must be readable from `core.agentChatThread` + `agentMessage`.
2. **Delivery is idempotent and reconciled.** The `message-persisted` event is a *latency
   optimization*, never the source of truth. A restart, a missed event, or a duplicate event must
   converge to exactly one outbound message per assistant message.
3. **Inbound is durable before it is acknowledged.** A 200 from the webhook means "queued", not
   "handled".
4. **No silent turn.** Every terminal state produces exactly one user-visible sentence. This is
   already invariant 5 of the implementation plan and this design must not weaken it.
5. **`ai-chat` never imports WhatsApp.** Delivery goes through a port owned by `ai-chat`, or
   through a Redis channel that `ai-chat` already publishes to. No WhatsApp code in the engine.
6. **Web behaviour is unchanged.** Web chat still streams over GraphQL; the delivery port's
   default implementation stays a no-op.

---

## 2. Target architecture

```
POST /webhook
  verify signature → SET wa:wamid:{id} NX EX 7d → 200 → enqueue whatsapp-agent-inbound
                                                                │
                                                                ▼
                                        WhatsappAgentInboundJob  (new queue, own worker)
                                          resolve phone → userWorkspace → thread
                                          command parse (/new, /session, /cancel)
                                          pending-question policy
                                                                │
                                                                ▼
                                        SendAgentChatMessageService  (T0.1, shared with web)
                                                                │
                                                                ▼
                                        aiStreamQueue → StreamAgentChatJob   (unchanged)
                                                                │
                            ┌───────────────────────────────────┴──────────────────┐
                            ▼                                                      ▼
              message-persisted (Redis pubsub)                     agentChatThread row
                            │                                              │
                            ▼                                              │
              fast path: wake the thread's deliverer                       │
                            └──────────────┬───────────────────────────────┘
                                           ▼
                              WhatsappDeliveryService
                                reconcile(threadId): assistant messages newer than
                                wa:delivered:{threadId} → send → advance pointer
```

Two delivery triggers, one send path:

- **Fast path** — a Redis subscription per active thread wakes the deliverer on
  `message-persisted`. Latency only.
- **Reconcile** — on inbound, on job start, and on a periodic sweep: query assistant messages
  newer than the delivered pointer. Correctness. Catches restarts, missed events, and the
  queued-message flush at `agent-chat-streaming.service.ts:630`.

Because reconcile runs on every inbound anyway, the fast path can be lost entirely without
correctness loss — which is what makes this robust rather than fragile.

---

## 3. Work items

### W1 — Durable inbound queue (fixes defect 3)

New queue `whatsappAgentInboundQueue` in `message-queue.constants.ts` + a worker entry in
`message-queue-worker-config.constant.ts` (concurrency 1, `lockDuration: 30_000`,
`maxStalledCount: 1` — the job is short and enqueueing, not streaming).

`WhatsappAgentInboundJob` receives the minimal payload (`wamid`, `phoneNumberId`, `from`, `text`,
`messageType`) and calls the existing `WhatsappAgentService.handleInbound`. Controller keeps
signature verification, dedupe, and `sendStatus(200)`; the `void handleInbound` call at
`whatsapp-webhook.controller.ts:200` is replaced by an enqueue.

Job id is the wamid, so a Meta redelivery that slips past the Redis NX is collapsed by BullMQ.

**Acceptance:** kill the worker mid-turn → restart → the message is processed. Replay a webhook
body → one job, one reply. Request path does no DB work beyond the dedupe write.

### W2 — Redis dedupe (fixes defect 3)

Replace `seenWamids: Map` (`whatsapp-agent.service.ts:54-57`, `:465-484`) with
`SET wa:wamid:{id} NX EX 604800`. Duplicate → drop silently and return. No new dependency: the
`redis-client` module is already in the `whatsapp-agent` module graph via `AiChatModule`.

**Acceptance:** two workers see the same wamid → one job. Dedupe survives a process restart.

### W3 — Delivery port (fixes defects 1 and 2)

`ai-chat/services/agent-chat-delivery.port.ts`, injected with a no-op default:

```ts
export abstract class AgentChatDeliveryPort {
  onMessagePersisted(_input: {
    threadId: string;
    workspaceId: string;
    messageId: string;
  }): Promise<void> {}
}
```

Called from `stream-agent-chat.job.ts` immediately after the `message-persisted` publish, and from
`agent-chat-streaming.service.ts:630` for the queued flush. Failures are logged, never thrown —
delivery must not fail a completed turn.

The WhatsApp implementation is `WhatsappDeliveryService.reconcile({ threadId, workspaceId })`.
This is strictly better than subscribing to Redis inside the job: it runs in the worker that
already holds the thread context, and it is naturally idempotent.

**Acceptance:** a turn that finishes after the old 4-minute deadline still delivers. A job retry
delivers once.

### W4 — Reconciliation + delivered pointer (makes W3 safe)

`wa:delivered:{threadId}` holds the last delivered assistant `messageId` (or its `createdAt`).
`reconcile()`:

1. Read the pointer. Absent → nothing to catch up; set it to the thread's newest assistant message
   without sending (a brand-new thread has no history to replay).
2. Load assistant messages for the thread created after the pointer, ordered by `createdAt`.
   **Do not reuse `getMessagesForThread`** (`agent-chat.service.ts:358`) — it orders by
   `processedAt` with nulls last, which is not chronological for our purpose. Add a small
   `findAssistantMessagesAfter({ threadId, workspaceId, after })`.
3. For each, send with `wa:out:{messageId}` `SET NX` as the idempotency gate, then advance the
   pointer.
4. Skip messages whose text is empty and that carry no pending question (the "no text" case the
   job already logs at `stream-agent-chat.job.ts:696`).

`reconcile()` is called: on every inbound before streaming, when a delivery job is woken, and by a
1-minute sweep over threads with `activeStreamId IS NULL` whose last assistant message is newer than
the pointer. The sweep is what makes a crashed worker self-heal without a redeploy.

**Acceptance:** truncate `wa:out:*` mid-flight → no duplicate send. Stop the worker after
`message-persisted` → the sweep delivers within one minute.

### W5 — Rolling summary (fixes defect 4)

Two columns on `core.agentChatThread` (decision: no new table, matching the parent plan's stance):

```ts
@Column({ type: 'text', nullable: true })
summary: string | null;

@Column({ type: 'uuid', nullable: true })
summarizedThroughMessageId: string | null;
```

Plus a fast instance command (`database:migrate:generate --name whatsapp-thread-summary --type fast`)
and `@WasIntroducedInUpgrade` pointing at it, per repo convention.

Where it runs: `chat-execution.service.ts`, before `convertToModelMessages`, not inside
`MessagePruningService` — pruning is a pure message-array transform and should stay that way.

```
if conversationSizeTokens > 0.6 * contextWindowTokens:
    unsummarized = messages after summarizedThroughMessageId
    if unsummarized.length > N:
        summary = generateText(cheap model, previous summary + unsummarized transcript)
        persist summary + summarizedThroughMessageId = last summarized message id
```

Then replace the summarized prefix with one system message and run the existing prune. With a
summary in place, `isStillOverLimit` becomes unreachable in practice; keep the throw as the last
resort rather than removing it.

Cost and latency: one extra cheap-model call per ~40% of a context window consumed. Trigger at 60%
so the call happens well before the 90% prune threshold, and never on the same turn as a user
reply that already pruned.

**Acceptance:** a thread driven past two context windows still answers. `summary` is null for every
thread under threshold (no writes on the common path). The transcript in `agentMessage` is never
deleted — the summary is an addition, not a replacement.

### W6 — Session ergonomics

- `channel` column on `agentChatThread` (`'WEB' | 'WHATSAPP'`, default `'WEB'`) — specified in the
  parent plan §1.4 and still absent from the entity. Needed for `/new` scoping and a sidebar badge.
- `/new` — `createThread()` + repoint `whatsappActiveThreadId`. Distinct from `/session`, which the
  parent plan defined; `/new` is the long-running-session name for the same operation.
- Typing indicator + mark-read before the first token.
- Bump `CODE_INTERPRETER_SESSION_MAX_AGE_MS` for WhatsApp threads so sandbox files survive between
  messages — otherwise "the CSV I made earlier" is a lie across a 20-minute gap.

---

## 4. Failure modes

| Failure | Today | After |
| --- | --- | --- |
| Turn exceeds 4 minutes | "try again" | delivered whenever it finishes |
| Deploy mid-turn | message consumed, no reply | job re-runs, reconciled |
| Duplicate webhook | process-local dedupe only | Redis NX + job id |
| Worker dies after persist | reply lost | sweep delivers within 1 min |
| Event published twice | n/a (nothing consumes) | `wa:out:{messageId}` NX |
| Thread grows past window | permanent `CONTEXT_WINDOW_EXCEEDED` | rolling summary, session continues |
| User sends 3 messages fast | queued (works) | unchanged |
| Quiet >24h, then a finished job | cannot deliver | held until next inbound, or a Utility template |

The last row is the only one code cannot fix. It is an approval lead time, not an implementation
detail — decide before building anything that runs after the user goes quiet.

---

## 5. Sequencing and size

| Step | Work | Size | Depends on |
| --- | --- | --- | --- |
| 1 | W3 + W4 (port, reconcile, pointer, sweep) | 2–3 d | T0.1 (`SendAgentChatMessageService`) |
| 2 | W1 + W2 (queue, Redis dedupe) | 1–2 d | — |
| 3 | W5 (summary columns, migration, summarizer) | 2–3 d | — |
| 4 | W6 (channel column, `/new`, presence) | 1–2 d | W5's migration can share a release |

Steps 1 and 2 are independent. Step 1 alone removes the 4-minute cliff, which is the user-visible
bug. Step 3 is the only piece that is new logic rather than rewiring.

---

## 6. Tests

Non-trivial logic leaves a runnable check behind:

- `whatsapp-delivery.service.spec.ts` — reconcile sends once for one assistant message; a second
  reconcile sends nothing; an out-of-order `createdAt` is respected; empty-text messages are skipped.
- `agent-chat-delivery.port.spec.ts` — the no-op default is used when WhatsApp is absent; a throwing
  implementation does not fail the stream job.
- `message-summary.service.spec.ts` — under threshold writes nothing; over threshold summarizes once
  and advances the pointer; a second call over the same messages is a no-op.
- Integration: kill the worker after `message-persisted`, run the sweep, assert one outbound call.

---

## 7. Out of scope

- Interactive buttons/lists and templates (parent plan §8 deferred).
- Voice-note and image handling (parent plan §5.6).
- A general cross-channel memory service. The summary is per-thread and deliberately dumb; if
  cross-thread recall is ever wanted it is a separate feature with its own store, not a widening of
  this one.
- Any second WhatsApp provider (Unipile, Baileys).

---

## 8. Open questions

1. **Summary model.** Reuse `workspace.smartModel`, or pin a cheap model? Default: pin cheap, since
   summarization is not a reasoning task and should not bill at chat rates.
2. **Sweep interval and cost.** 1 minute over threads with a stale pointer. If the query is
   expensive at scale, add a partial index on `agentMessage (threadId, createdAt) WHERE role =
   'assistant'`.
3. **Delivered pointer storage.** Redis is fast but evictable; a column on `agentChatThread` is
   durable and makes the sweep a pure SQL comparison. Default: Redis first, promote to a column if
   eviction is ever observed.
4. **`/session` vs `/new`.** Two names for one operation is a smell. Default: ship `/new`, keep
   `/session` as the documented alias only if the parent plan's wording has already shipped to users.
