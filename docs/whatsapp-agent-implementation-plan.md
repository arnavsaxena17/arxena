# WhatsApp agent — implementation plan

> **Parent design:** [whatsapp-arxena-channel-plan.md](whatsapp-arxena-channel-plan.md).
> **Status:** ready to start at Phase 0. Phases 0–1 are independent of Meta credentials.
> **Total:** ~15–21 engineer-days, four shippable increments.

---

## 0. Scope

**In scope:** one global Cloud API number, invite-first onboarding, the agent lane on the existing
Ask AI engine, text + voice-note inbound, formatted outbound, quota, and a standby number.

**Out of scope, deliberately:** the outreach lane's behaviour (only its `phone_number_id` match becomes
exact), `_chatMessage` mirroring, interactive buttons/lists, inbound request queues, reminder
templates, images, and any second WhatsApp provider (Unipile, Baileys).

---

## 1. Invariants

These hold at every phase. A PR that breaks one is wrong, even if tests pass.

1. **Every model call passes the guard.** `streamAgentChat` is reachable only through
   `SendAgentChatMessageService`, which runs `validateModelAvailability` +
   `assertHasAvailableCreditsOrThrow` first. Enforced by a unit test, not by review.
2. **`ai-chat` never imports WhatsApp.** The delivery hook is a port (`AgentChatDeliveryPort`) whose
   default implementation is a no-op; WhatsApp implements it.
3. **The outreach lane is untouched.** Messages whose `phone_number_id` is not in
   `WHATSAPP_AGENT_NUMBERS` follow today's code path exactly, including the workspace scan.
4. **Webhook handling is bounded.** Verify → dedupe → 200 → enqueue. No GraphQL, no workspace scan, no
   class construction on the request thread.
5. **No silent failure.** Every terminal state (credits, window, unsupported media, provider error)
   produces exactly one user-visible sentence.
6. **Nothing is sent twice.** Outbound is keyed by `messageId`; inbound is keyed by `wamid`.

---

## 2. Pre-flight

| Item | Owner | Needed by | Notes |
| --- | --- | --- | --- |
| Meta app with `whatsapp_business_messaging` | platform | Phase 1 | Existing app can be reused |
| Test number + 2 recipient numbers | platform | Phase 1 | Meta gives one free test number per app |
| `WHATSAPP_AGENT_APP_SECRET`, `_VERIFY_TOKEN` | platform | Phase 1 | Secret from App settings → Basic |
| Live number `+1 515-316-3273` on the WABA | platform | Phase 2 | Already provisioned |
| Standby number, verified | platform | Phase 4 | Business verification takes days — start early |
| `IS_WHATSAPP_AGENT_ENABLED` feature flag | server | Phase 3 | Per-workspace, so pilot = one workspace |
| Staging environment with the Meta webhook pointed at it | platform | Phase 1 | Never point a test app at production |

---

## 3. Sequencing

| Phase | Deliverable | Depends on | Size |
| --- | --- | --- | --- |
| 0 | Guard seam + `channel` column, no WhatsApp code | — | 2–3 d |
| 1 | Signed, deduped, enqueued webhook; canned replies only | 0 (soft), pre-flight | 2–3 d |
| 2 | Invite with phone → text → link → accept → bound | 1 | 2–3 d |
| 3 | The agent lane itself | 2 | 6–8 d |
| 4 | Quota, standby number, alerting | 3 | 3–4 d |

Phases 0 and 1 can run in parallel if two people are on it; Phase 2 needs the inbound job from 1, and
Phase 3 needs the binding from 2.

---

## 4. Phase 0 — the seam

No WhatsApp code. This is the phase that prevents free LLM usage later, and it is shippable on its own.

| ID | Task | Files | Done when |
| --- | --- | --- | --- |
| T0.1 | Extract `SendAgentChatMessageService` | `ai-chat/services/send-agent-chat-message.service.ts` (new) | `send()` does validate → guard → thread lookup → `reapDeadStream` → pending-question policy → queue-or-stream, and returns the same shape the resolver returns today |
| T0.2 | Route `sendChatMessage` through it | `ai-chat/resolvers/agent-chat.resolver.ts:155` | Resolver shrinks to auth + DTO mapping; response identical |
| T0.3 | Route `answerAgentChatQuestion` through it | same file `:314` | `answer()` shares validate + guard, then calls `answerPendingQuestionAndResumeStream` |
| T0.4 | `channel` on the thread | `entities/agent-chat-thread.entity.ts`, upgrade command | Column defaults `'WEB'`; `@WasIntroducedInUpgrade` points at the generated command; `createThread({ channel })` and `getThreadsForUser({ channel? })` accept it; DTO exposes it |
| T0.5 | Pin the invariant | `send-agent-chat-message.service.spec.ts` | A test that mocks `assertHasAvailableCreditsOrThrow` to throw proves `streamAgentChat` is never called; a second test covers the queued path |

**Exit:** `npx nx typecheck twenty-server`, `npx nx test twenty-server --testPathPattern=ai-chat`, and
the existing web chat behaves identically (manual: send, queue while streaming, answer a question).

**Generate the migration:** `npx nx run twenty-server:database:migrate:generate --name whatsapp-agent-channel --type fast`.

---

## 5. Phase 1 — webhook plumbing

Ends with a real WhatsApp message reaching a job and a canned reply coming back. No model, no invite.

| ID | Task | Files | Done when |
| --- | --- | --- | --- |
| T1.1 | Config entries | `twenty-config/config-variables.ts` | `WHATSAPP_AGENT_NUMBERS`, `_APP_SECRET`, `_VERIFY_TOKEN`, `_GRAPH_VERSION` typed, documented, defaulted where safe |
| T1.2 | Signature service | `whatsapp-agent/services/whatsapp-signature.service.ts` | Constant-time compare over `rawBody`; unit tests with a real HMAC fixture, a tampered body, and a missing header |
| T1.3 | Controller rewrite | `arx-chat/controllers/whatsapp-webhook.controller.ts` | verify → dedupe → `sendStatus(200)` → enqueue; verify token from config; `'12345'` gone; **log-only mode** (`WHATSAPP_AGENT_SIGNATURE_ENFORCE=false`) for the first 24h so a wrong secret cannot silently break outreach |
| T1.4 | Dedupe | same | `SET wa:wamid:{id} NX EX 7d`; redelivered body returns 200 and enqueues nothing |
| T1.5 | Queue + job skeleton | `message-queue.constants.ts`, `whatsapp-agent/jobs/whatsapp-agent-inbound.job.ts`, module | Queue drains; job logs `{ wamid, phoneNumberId, workspaceId?, outcome }` |
| T1.6 | Router | `whatsapp-agent/services/whatsapp-inbound.router.ts` | `phone_number_id` in config → agent job; otherwise the existing `IncomingWhatsappMessages` path runs unchanged |
| T1.7 | Canned reply only | `whatsapp-agent/services/whatsapp-agent-outbound.service.ts` | Sends "this channel is being set up" so the loop is provably closed |

**Exit:** staging webhook receives a message from the Meta test number → 200 in under 100 ms → job runs
→ reply arrives. Unsigned request → 401. Duplicate wamid → one reply, not two. An outreach number's
message still reaches the old pipeline.

---

## 6. Phase 2 — invite and bind

| ID | Task | Files | Done when |
| --- | --- | --- | --- |
| T2.1 | `context.phoneE164` | `app-token/app-token.entity.ts:82`, upgrade command | Optional field on the closed context type; expression index created; existing invites unaffected |
| T2.2 | Invite carries a phone | `workspace-invitation/dtos/send-invitations.input.ts`, `workspace-invitation.service.ts:158`, `:420` | `sendInvitations(emails, roleId, phoneE164?)` validates E.164 and threads the phone into `generateInvitationToken` |
| T2.3 | Members UI | `twenty-front/src/modules/workspace-invitation/` (hook + mutation), `WorkspaceInviteTeam.tsx` | Optional "WhatsApp number" field; `graphql:generate` run; validation error shown inline |
| T2.4 | Inbound: invite lookup | `whatsapp-agent/services/whatsapp-connection.service.ts` | Pending invite for the sender → reply with the **existing** invite link (`buildWorkspaceURL` + `AppPath.Invite`, `workspace-invitation.service.ts:315-330`); none → canned invite-only line; one reply per phone per 24h |
| T2.5 | Bind on acceptance | `auth/services/sign-in-up.service.ts:200-275`, `auth/services/auth.service.ts:113-147` | `bindPhoneFromInvitation({ invitation, userId, workspaceId })` called before the invite is invalidated, from **both** paths; idempotent; phone-taken → plain error, invite still usable |
| T2.6 | Prefill from profile | `WorkspaceInviteTeam.tsx`, invite hook | Inviting an existing member defaults the WhatsApp number to `workspaceMember.phoneNumber`; an admin edit wins; empty profile leaves the field blank |
| T2.7 | Normalise + surface mismatch | `whatsapp-connection.service.ts`, Members member list | `bindPhoneFromInvitation` stores E.164 (`libphonenumber-js`); when the profile number differs from the connected one, Members shows both instead of overwriting the profile |
| T2.8 | `/disconnect` | command parser (stub) | Clears all six columns, keeps threads |

**Exit (manual, staging):** invite a test phone → text from it → receive the invite link → accept with
the invited Google account → `userWorkspace.whatsappPhoneE164` is set, in E.164, and
`whatsappAgentNumberId` is the live number. Wrong Google account is refused. Second acceptance of the
same invite is refused. A phone already bound elsewhere fails cleanly. An invite for an existing member
pre-fills that member's profile number.

---

## 7. Phase 3 — the agent lane

| ID | Task | Files | Done when |
| --- | --- | --- | --- |
| T3.1 | Connection resolution | `whatsapp-connection.service.ts` | Phone → `userWorkspace` + workspace + active thread; a dangling/archived `whatsappActiveThreadId` creates a fresh thread instead of throwing. **Session lifetime across turns is not covered here** — see [whatsapp-long-running-session-design.md](whatsapp-long-running-session-design.md) |
| T3.2 | Commands | `whatsapp-command.parser.ts` | `/session`, `/session N`, `/session list`, `/session name X`, `/help`, `/whoami`, `/disconnect`, `/workspace`, `/cancel` — all answered before any model call |
| T3.3 | Pending-question policy | `send-agent-chat-message.service.ts` | `findPendingQuestionPart` drives option/free-text mapping; multi-question asked sequentially; `/cancel` clears with a conditional update; `QUESTION_NOT_PENDING` mapped to a friendly line |
| T3.4 | Formatting | `utils/format-for-whatsapp.util.ts` | Tables → `label: value`; ≤4096 chars on paragraph boundaries; numbered questions; tests for each |
| T3.5 | Delivery port | `ai-chat/services/agent-chat-delivery.port.ts` + WhatsApp implementation | **Superseded by** [whatsapp-long-running-session-design.md](whatsapp-long-running-session-design.md) §3 W3–W4 (reconcile-based delivery, not event-only); both `message-persisted` publishes delivered (job `:547-554`, streaming `:630`); `wa:out:{messageId}` key makes retries idempotent |
| T3.6 | Window + errors | outbound service | `>24h` holds the send; `131047` holds silently; `131026` replies "couldn't deliver"; `stream-error` and `credits-exhausted` each produce one sentence |
| T3.7 | Media | `whatsapp-agent/services/whatsapp-media.service.ts` | Voice note → `handleAudioMessage` → transcribed text with `[voice note]` prefix; image/document → deterministic refusal |
| T3.8 | Presence | outbound service | Inbound marked read; typing indicator before the first token |
| T3.9 | Flag + limits | `feature-flag`, per-phone counter | Agent branch behind `IS_WHATSAPP_AGENT_ENABLED`; 30 messages/hour per phone with one "slow down" reply |

**Exit:** the manual script in §9 passes end to end. A job retry does not double-send. A killed worker
mid-stream leaves no thread stuck in `activeStreamId`.

---

## 8. Phase 4 — scale

| ID | Task | Done when |
| --- | --- | --- |
| T4.1 | Quota | Per-workspace daily set of hashed senders, checked pre-model, deterministic reply at the limit; config default 200 |
| T4.2 | Standby number | Second entry in `WHATSAPP_AGENT_NUMBERS`; replies leave from the receiving number; assignment at bind time |
| T4.3 | Alerting | 80% of tier per number; signature-failure spike; queue lag; `131026`/`131047` rates |
| T4.4 | Retention | Whatever §8 of the design lands on; a scheduled job, not a manual run |

---

## 9. Test plan

**Unit (each PR):** signature verify (valid/tampered/missing), wamid dedupe, router branches, command
parser, `formatForWhatsApp` (table, chunk boundary, numbered question), pending-question policy
(option / free text / multi-question / queue / stale), outbound idempotency, invite-link construction,
`bindPhoneFromInvitation` (no phone, same row, other row, unnormalised input, profile number differs).

**Integration (one suite, staging DB):** inbound job with a mocked Graph client → message persisted →
outbound called once; invite acceptance from `sign-in-up` and from `auth.service` both bind; partial
unique rejects a second phone.

**Manual, on the Meta test number (run at the end of Phase 3, again at 4):**

1. Text "hi" from an uninvited phone → one canned reply; no DB rows written.
2. Invite that phone from Members (for an existing member, the dialog pre-fills the profile number) →
   text again → invite link arrives.
3. Accept with the invited Google account → phone bound; reply confirms.
4. Accept with a different account → refused, invite still usable.
5. Ask something that needs a tool → formatted answer, no markdown artefacts.
6. Trigger `ask_questions` → numbered options; reply "2" → answer accepted.
7. Send three messages quickly → all three arrive, queued and answered in order, nothing dropped.
8. Send a voice note → transcribed and answered.
9. Send an image → deterministic "can't read those yet".
10. Kill the worker mid-stream → restart → no duplicate message on the wire.
11. `/session` → new thread; `/session list` → shows both; web sidebar shows the same threads.
12. Replay a webhook body → no duplicate reply.

---

## 10. Observability

**Logs, every stage:** `wamid`, `phoneNumberId`, `workspaceId`, `threadId`, `stage`, `outcome`,
`latencyMs`. Never log message bodies or phone numbers in full (hash the phone).

**Metrics:** `wa_inbound_total{number,outcome}`, `wa_outbound_total{number,status}`,
`wa_signature_fail_total`, `wa_window_blocked_total`, `wa_quota_blocked_total`, `wa_turn_duration_ms`,
`wa_daily_unique_senders{number}`.

**Alerts:** signature failures > 10/min (misconfiguration, or an attack), daily unique senders > 80% of
tier, outbound error rate > 2%, inbound job lag > 60 s.

---

## 11. Rollout and rollback

Staging only until Phase 3 passes §9. Production changes follow the workspace rule: staging and review
first.

1. **Config in staging**, test number, signature in log-only for 24h, then enforce.
2. **Phase 1 in production** with the flag off **and** the number absent from
   `WHATSAPP_AGENT_NUMBERS` — the code is deployed but unreachable, so outreach is byte-for-byte
   unaffected.
3. **Pilot workspace:** enable `IS_WHATSAPP_AGENT_ENABLED` for one internal workspace; invite two
   people; watch for a week.
4. **All workspaces**, then Phase 4 numbers and alerts.

**Rollback:** flip the flag (instant, no deploy); remove the number from `WHATSAPP_AGENT_NUMBERS`
(restart) to route everything back to outreach; the queue keeps draining, so in-flight messages still
get answered rather than dropped.

---

## 12. Decisions that gate tasks

| Decision | Gates | Default if unanswered |
| --- | --- | --- |
| Quota value per plan | T4.1 | 200 unique senders/day/workspace |
| Images in v1 or v1.5 | T3.7 | v1.5 — refuse images in v1 |
| Hot rotation vs restart | T4.2 | Restart |
| Retention window | T4.4 | Inherit web thread behaviour |
| Signature enforcement window | T1.3 | 24h log-only in staging, enforced in production |

---

## 13. Definition of done

Per phase: typecheck and lint clean, migration generated and reviewed, tests added for new branching,
no change to outreach behaviour, and the phase's exit criteria demonstrated on staging (screenshot or
log excerpt in the PR).

Per release: feature flag dark by default, logs carry the correlation fields, the manual script in §9
passes, and the rollback path in §11 has been exercised once — not just documented.
