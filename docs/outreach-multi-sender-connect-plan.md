# Plan: Several members connecting with the same person (2-week sequence, first-accept-wins opener)

## Goal

1. Tag **more than one workspace member** against a person in the outreach list.
2. Let those members **send a connection request to the same person inside a 2-week window**
   (staggered, or in parallel), instead of the current one-owner-per-person model.
3. Send the **first message (opener) and its follow-up sequence only from the first member whose
   invite was actually accepted**. Every later accept stands down — no second opener, no duplicate
   thread.

## What exists today

| Capability | Where | Limit |
| --- | --- | --- |
| One owner per person, every send/reply on that seat | `candidate.outreachWorkspaceMemberId` (`outreach-command-fields.data.ts:398`), `outreach-member-assignment.service.ts:128` | **One** member only |
| Manual / bulk / split assignment | `POST …/assignment/assign|split`, `OutreachAssignMemberSelect.tsx` | Splits *people across* members, never *members per person* |
| Warm overlap ranking | `OutreachWarmOverlapService`, policy `warm_suggest` | Picks **one** winner |
| Sequencer reads the pinned member | `select-outreach-workspace-member` logic function → `Load workspace member` (`outreach-workflow-graphs.ts:3313-3337`) | Returns `outreachWorkspaceMemberId`, then `hasPinnedMember` short-circuits forever |
| Option toggle | `Pin outreach sender by warm overlap` (`EditOutreachSequencerOptionsModal.tsx:299`) | Off by default; on = 1:1 pinning |

So today the answer is: **you cannot do this in the product.** Assigning two members to one person is
not expressible, and the single-owner field is treated as immutable once set.

## Why the current model can't express it

1. **One scalar owner, never re-scored.** `selectForCandidate` returns
   `alreadyPinned: true` and stops (`outreach-member-assignment.service.ts:128-135`). There is no
   "attempt 2, attempt 3" concept anywhere in the candidate schema.
2. **Accept has no sender identity.** `onConnectionAccepted` maps `account_id` → *workspace*
   (`unipile-webhook.service.ts:1201`) but never resolves **which member's seat** accepted. The
   `CONNECTION_ACCEPTED` run then resolves the sender from `outreachWorkspaceMemberId`, which may be
   a different member than the one who was accepted. That is the exact bug that would make "first
   message only from the accepted member" fail.
3. **Entry is stage-scoped, not attempt-scoped.** The trigger is `candidate.upserted` filtered to
   `QUEUED | CONNECTION_ACCEPTED | REPLIED | MEETING_BOOKED`
   (`outreach-workflow-graph-helpers.ts:1653`). Two concurrent attempts on the same candidate cannot
   be distinguished by the payload — both would wake one run that reads the same candidate row.
   On top of that, `cancel-outreach-sequencer-sibling-runs` cancels **all** sibling runs on
   accept/reply (`cancel-outreach-sequencer-sibling-runs.util.ts:6`), which would kill the other
   members' attempts.

## Recommended shape

Do **not** replace the single-owner field. Reinterpret it as *"the member owning the attempt in
flight"* and add an ordered plan + a first-accept lock next to it. That keeps Today, Mine, journey,
sends, pause/stop and reply routing untouched.

### v1 (recommended): staggered escalation inside one run

- One candidate, one **ordered plan** of 2–4 members, one attempt in flight at a time.
- Attempt 1 connects → wait `staggerDays` (default 3) → if still no accept, attempt 2 connects from
  its own seat → … until the **14-day window** closes.
- On accept: the seat that accepted claims the candidate; opener + FU1–FU3 run from that member only.
- Window closes with no accept → existing InMail / email / `FAILED_NO_REPLY` fallback path.

This gives the outcome you asked for (several members trying within two weeks) with **no parallel
run model**, so no duplicate openers to suppress and no sibling-run rewrite.

### v2 (optional, later): parallel fan-out

All tagged members connect in the same 72h. Requires attempt-scoped runs (see "Parallel notes") and
the same accept lock. Only build it if the staggered escalation measurably under-performs.

## Data model (v1)

New fields on `candidate` in `outreach-command-fields.data.ts`, all additive:

| Field | Type | Purpose |
| --- | --- | --- |
| `outreachSenderPlan` | `RAW_JSON` | `{ windowDays, staggerDays, maxSenders, attempts: [{ memberId, order, status, scheduledAt, sentAt, acceptedAt, canceledAt, inviteId }] }`, `status: planned \| sent \| accepted \| stood_down \| expired` |
| `outreachConnectWindowEndsAt` | `DATE_TIME` | Stamped when the first attempt starts; 14 days later |
| `outreachFirstAcceptedMemberId` | `TEXT` (member UUID) | **The lock.** Written once, atomically |
| `outreachFirstAcceptedAt` | `DATE_TIME` | When the winning accept landed |
| `outreachOpenerSentByMemberId` | `TEXT` | Idempotency for the opener |
| `outreachOpenerSentAt` | `DATE_TIME` | Idempotency for the opener |

`outreachWorkspaceMemberId` stays and is still the *active* seat — every existing consumer
(`withPinnedEmailSender`, Today "Mine", journey, chat persist, reply routing) keeps working because
at any moment exactly one member owns the attempt.

Ordering: when the plan is created, order attempts by (1) member already connected to the person,
(2) warm-overlap score, (3) least loaded, then (4) rotate. Reuse
`buildOutreachSplitPlan` / `pickLeastLoadedMember` / warm scores rather than new scoring.

## Sequencer graph changes (`.ts` graph builder)

In `buildCandidateSequencerGraph` (`outreach-workflow-graphs.ts:3257`), only when the new option is on:

**QUEUED branch** (after qualify / company dedupe, before the connect note):

```
[Filter] multi-connect ON && now < outreachConnectWindowEndsAt && attempt exists
   └─ [Logic Function] plan-next-connect-sender   ← new native function
        - reads outreachSenderPlan + outreachSequenceStage
        - skips attempts already sent/stood_down
        - writes outreachWorkspaceMemberId = next member, stamps scheduledAt
        - first attempt also stamps outreachConnectWindowEndsAt (+14d)
        - returns { hasAttempt, workspaceMemberId, attemptIndex }
        - returns hasAttempt=false when the window is closed / all attempts used
   └─ [existing] connection note → Send LinkedIn Connection Request
   └─ [Delay] staggerDays
   └─ [Filter] outreachSequenceStage == CONNECTION_SENT   ← accept wins the race, stop escalating
        └─ loop back to plan-next-connect-sender
[Else] existing InMail / email / FAILED_NO_REPLY fallback
```

**CONNECTION_ACCEPTED branch** (before the existing "draft opener"):

```
[Filter] outreachWorkspaceMemberId == outreachFirstAcceptedMemberId   ← stand down if not the winner
[Filter] outreachOpenerSentAt is empty                                ← idempotency
... existing opener draft → FORM → send → stamp outreachOpenerSentByMemberId/At → FU1–FU3
```

That is the whole enforcement of "first message sequence only by the first accepted member": one
filter for *who*, one for *already sent*. It also survives duplicate triggers, retries and re-entry.

Reuse or extend `select-outreach-workspace-member` rather than adding a second selector: give it a
`mode: 'plan'` input so existing workspaces on the 1:1 pin keep their exact behaviour.

## Accept-time lock (the critical piece)

In `onConnectionAccepted` (`unipile-webhook.service.ts:1185`):

1. Resolve the **member** from `account_id` (workspace member row carries
   `linkedinUnipileAccountId`), not just the workspace.
2. Atomically claim:
   `UPDATE candidate SET outreachFirstAcceptedMemberId = :memberId, outreachFirstAcceptedAt = now()
    WHERE id = :candidateId AND outreachFirstAcceptedMemberId IS NULL`
   and branch on affected rows.
3. **Claimed** → mark that attempt `accepted`, set `outreachWorkspaceMemberId = memberId`, then stamp
   `CONNECTION_ACCEPTED` as today (this wakes the opener run for the right seat).
4. **Already claimed by another member** → mark the attempt `accepted_late`, keep the relation/message
   on the accepting seat (the thread is real, it must not be lost), **do not** change stage and **do
   not** wake an opener run. Optionally notify that member: "`<Winner>` already opened — do not DM".
5. Keep the mock path in sync: `POST /outreach-mock/candidates/:id/accept` needs an optional
   `memberId` / `accountId` so tests can simulate seat A vs seat B.

## Edit Workflow UI (`Sender` section)

`EditOutreachSequencerOptionsModal.tsx:292-310` — under the existing pin toggle:

- **Toggle**: `Multiple members connect per person (first accept wins)` — disabled unless
  `Pin outreach sender by warm overlap` is on (multi-sender is meaningless without seat pinning).
- When on, three compact fields:
  - `Members per person` (2–5, default 3)
  - `Sequence window` days (default **14**)
  - `Gap between members` days (default 3; helper text shows the computed schedule, e.g.
    "0 → 3 → 6 → 9")
- Helper text states the rule in plain words: *"Each member sends their own invite from their own
  seat. The first accepted invite owns the conversation; everyone else stands down."*
- Plumb through the same 5 places as every other option:
  `ApplyOutreachSequencerGraphOptionsInput` (add `multiSenderConnect`, `sendersPerPerson`,
  `connectWindowDays`, `senderStaggerDays`), `OutreachSequencerGraphOptions` + defaults,
  `resolveOutreachSequencerGraphOptions`, `inferOutreachSequencerGraphOptionsFromSteps`
  (`:117` pattern), `useApplyOutreachSequencerGraphOptions`.

## Person tagging UI (where the tags actually live)

Recommendation: **the workflow holds the rule, the list holds the tags.** The workflow version is
shared by every person on the project; putting a person→member map inside the graph version means a
new version every time you retag one person. So:

- **People table**: `Owner` becomes `Senders` — chips of tagged members with attempt state
  (planned / sent / accepted / stood down), plus a bulk action **`Tag senders…`** (multi-select,
  ordered) next to the existing `Assign owner` (`OutreachAssignMemberSelect.tsx`).
- **Candidate drawer**: `Connect plan` block — each member, its seat status, scheduled/sent/accepted
  timestamps, countdown to `outreachConnectWindowEndsAt`, and a `Remove` for not-yet-sent attempts.
- **Outreach → Setup → Team sending** (`OutreachSetupTeamSendingSection.tsx`): keep as the default
  pool + policy. Tagging one person overrides the policy for that person only; untagged people
  inherit the pool automatically (round robin / balanced / warm), so bulk tagging is optional.
- Inside the **Edit Workflow** modal, show a read-only summary line
  ("3 members per person · 14 days · 4 people tagged manually, 96 from the pool") with a link to the
  People tab. That satisfies "I want it in Edit Workflow" without forking versions per list edit.

## API additions

Under `/outreach-command/projects/:projectId`:

| Call | Purpose |
| --- | --- |
| `POST candidates/:candidateId/senders` `{ memberIds: string[], mode? }` | Tag ordered senders (validates seats + duplicates) |
| `DELETE candidates/:candidateId/senders/:memberId` | Untag before send |
| `GET candidates/:candidateId/senders` | Plan + per-attempt status |
| `POST candidates/:candidateId/senders/plan` `{ windowDays, staggerDays, maxSenders }` | Re-plan / preview schedule |

Existing `assignment/config` (`participantMemberIds`, policy) stays the default pool.

## What must not change

- `outreachSequenceStage` semantics and the entry-stage trigger filter.
- Today / Mine, HITL forms, journey drawer, chat persist, reply routing — all keyed off
  `outreachWorkspaceMemberId`, which remains "current attempt owner".
- Company dedupe (`DEFERRED`) — a deferred person never starts a plan.
- 1:1 pinning for workspaces that do not turn the option on (feature is additive and off by default).

## Build order

1. **Schema + DTO + defaults** (fields, option plumbing, tests for `resolveOutreachSequencerGraphOptions`).
2. **`plan-next-connect-sender` logic function** + native executor registration; unit-test the plan
   progression (skip sent, stop on accept, stop at window end, max attempts).
3. **Graph wiring** behind the option; snapshot-test the graph shape with the option on/off
   (`__tests__/outreach-workflow-graphs.spec.ts`).
4. **Accept lock** in `onConnectionAccepted` + member-from-account resolution + `accepted_late`
   handling; unit-test both branches (winner / late).
5. **Opener guard filters** + `outreachOpenerSent*` stamps; test double-trigger sends once.
6. **API + People table tagging UI + drawer plan block**; seat validation.
7. **Edit Workflow modal** fields + inference + apply.
8. **Mock + scripts**: `memberId` on mock accept, extend `drive-outreach-bc-path-matrix` with a
   multi-sender case, add `scripts/seed-outreach-multi-sender-matrix.ts`.
9. Upgrade command to add the fields and resync the seeded graph for existing workspaces.

Rough size: steps 1–5 are the core (~3–5 days), 6–8 the surface (~2–3 days).

## Test plan

| Case | Expected |
| --- | --- |
| Two members tagged, no accept | attempt 1 `sent` → gap → attempt 2 `sent`; stage `CONNECTION_SENT`; no opener |
| Member 1 accepted | stage `CONNECTION_ACCEPTED`; `outreachFirstAcceptedMemberId = m1`; opener sent **from m1's seat**; m2 `stood_down` |
| Member 2 accepted first | same, winner is m2; m1 `stood_down` |
| Late accept from m2 after m1 won | m2 attempt `accepted_late`, stage unchanged, **no second opener**, no duplicate chat |
| Duplicate trigger / retry on accepted | opener sent exactly once (`outreachOpenerSentAt` guard) |
| Window expires, no accept | fallback path (InMail/email/`FAILED_NO_REPLY`), attempts `expired` |
| Manual tag 4 members, max 3 | only first 3 planned, 4th `expired` |
| Option off | graph identical to today; 1:1 pinning unchanged |
| Stop outreach mid-plan | all attempts cancelled, no further sends |

## Risks / edge cases

- **LinkedIn limits**: 3–4 invites from different seats to one person is legal but can look
  coordinated; keep `sendersPerPerson` ≤ 3 and stagger ≥ 48h by default.
- **Accept webhook ordering**: Unipile may deliver accepts out of order — the atomic claim, not
  arrival order, defines the winner. Never "last write wins".
- **Seat disconnected mid-plan**: `plan-next-connect-sender` must skip members whose
  `linkedinUnipileAccountId` is empty (reuse `resolveEligibleMemberIds` logic) instead of failing the run.
- **Person already connected to member 2 but not member 1**: put already-connected members first and
  skip the invite for them (straight to opener) — otherwise you send a redundant invite.
- **Reply before opener**: the existing `CONNECTION_ACCEPTED → hasInboundIf → stamp REPLIED` path
  already handles "they messaged first"; keep the winner filter *before* it.
- **Parallel (v2)** additionally needs attempt-scoped run keys and a rewritten sibling-cancel scope —
  do not attempt it in v1.

## Decision needed

- v1 staggered escalation (recommended) vs v1 parallel fan-out?
- Is "2 weeks" the **connect-attempt window** (assumed here), or the **whole first-touch cadence**
  including FU1–FU3? If the latter, the window field moves to the follow-up cadence and the connect
  attempts simply live inside it.
