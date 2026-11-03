# Plan: Repeat the list across senders (lagged re-touch)

Companion to [`outreach-multi-sender-connect-plan.md`](./outreach-multi-sender-connect-plan.md) (parallel race inside 14 days) and
[`outreach-sequencer-overview.md`](./outreach-sequencer-overview.md) (how the sequencer works).

## Read this first

There are four ways to ship this. They are not layers of one plan — they are alternatives, and three of
them share nothing.

| # | Path | Build | Coordination | Complexity added |
| --- | --- | --- | --- | --- |
| 0 | **Rounds**: pilot by hand (duplicate project, one sender each) | 0 d | none | none |
| 1 | **Rounds proper**: person-stop filter + next-round builder + round grouping | **~3.5 d** | live (person-level) | additive, generalises |
| 2 | **Campaign-per-attempt** + enrolment guard | ~2.5 d | enrolment only | ops convention |
| 3 | **Same candidate** (v0): 4 graph nodes + claim + sweep | ~6 d | live | bespoke mode |

**Recommendation: ship path 0 this week as the pilot, then path 1.** Path 1 is the only option that is
live-coordinated *and* additive — a project already is a round, `doNotContact` already exists on person,
and nothing in path 3 is required. Path 3 (the 4-node design) is documented as the fallback for the case
where a person must not appear twice in the `Candidate` object — see the wart in
[Recommended shape](#recommended-shape-rounds-project--round).

Everything below path 1 is reference depth, not a build order:

- **[Simplest version (v0)](#simplest-version-v0--stop-sender-a-continue-with-sender-b)** — the 4-node
  design if you ever need one candidate row per person.
- **[Recommended shape: rounds](#recommended-shape-rounds-project--round)** — the 3.5-day build.
- **[Alternative path: campaign-per-attempt](#alternative-path-campaign-per-attempt-new-project-per-touch)**
  — the zero-code pilot and its guards.
- Invariants, data model, graph changes, server changes, UI, edge cases and prospect-visible constraints
  apply to the same-candidate path (3). Path 1 reuses almost none of it.

## Goal

1. **Divide** (exists today): the list is partitioned — one sender owns each person for life.
2. **Repeat** (this plan): the same list is worked by an ordered set of senders, one attempt in
   flight at a time, with a gap. Attempt N+1 starts only if attempt N produced no accept and no
   reply.
3. **Primary** is a label + tiebreak on attempt 1, not a scheduling wait. Never hold a live
   acceptance waiting for a preferred sender.

Non-goals: parallel fan-out (`lag = 0`) — that needs attempt-scoped run keys and a rewritten
sibling-cancel scope, per the multi-sender doc. Multi-project dedupe. Per-person UI override
(phase 4, optional).

## Simplest version (v0) — "stop sender A, continue with sender B"

Everything below is the full plan. **This section is the smallest shippable slice, and it is the
version to build first.** It is exactly the sentence: stop the current attempt, hand the person to the
next sender, run the same graph again.

### Scope

| In | Out (deferred) |
| --- | --- |
| Ordered members + one gap number + one toggle | Strategy cards, previews, live counts |
| Re-entry by `QUEUED` restamp (existing mechanism) | New stage, new workflow, new branch |
| 2 per-attempt gates + 1 stamp + 1 fast-path IF | Any other canvas change |
| Hourly sweep: cancel open runs → move owner → restamp | Reconcile job, ramp policy, backfill tuning |
| First-accept claim + seat resolution + stage guard | Revivable claim, hand-off note, `accepted_late` notifications |
| `keep_open` only (A's invite stays pending) | Withdrawal (3a/3b) and InMail policy (3c) |
| One table change: `Next` reads `Nishant invites · 8d` | `Sending` cell, new chips, header strip |

### Profile: "sender A in month 1, sender B in month 2" (the supported v0 config)

This is the client-facing shape the feature is being sold as, and it is the **recommended default**:

```
Team sending
  ☑ Hand over to the next sender when nobody replies for   [ 30 ] days
  Order:  ① Manoj   ② Nishant
  Stop after [ 2 ] senders
```

**Two things "a month" has to mean precisely.**

1. **Measured from the previous sender's last outbound, not from their first.** That is what "no
   activity for a month" literally says, and it guarantees no overlap: a non-accepter's last touch is
   ~day 3, an accepter's is FU3 at ~day 22 — plus up to ~6 days of weekend/send-window slippage. Either
   way the next sender cannot start inside the previous cadence.
2. **"No activity" = no reply, not no touch.** Activity that cancels a handover: inbound reply, meeting
   booked, referral, explicit decline, do-not-contact. Passive signals (profile view, post like) are
   **not** observable and are out of scope.

Two definitions are defensible; pick one per project:

| Definition | Hands over when… | Cohort it adds |
| --- | --- | --- |
| `no_reply` **(recommended)** | they never sent a message | people who **accepted A but went silent** — an accepted-then-dead thread is exactly what a second seat is for |
| `no_accept` | they never even accepted | only cold non-responders; an accept keeps A forever |

Timeline for the dominant cohort (`no_reply`, 30 days):

```
Day 0    A invites + note
Day 3    no accept → InMail/email fallback → A's run ends
         ⋯ nothing happens for 30 days ⋯
Day 33   B invites          ← "month 2"
Day 36   B's fallback → ends
Day 66   exhausted — stop after 2 senders
```

For the accepted-then-silent cohort it lands at ~day 52 (30 days after FU3), which is month 2.5 in
wall-clock terms. If a client insists on strict calendar months, a **fixed** 30-day timer from A's
first send still fits inside A's worst-case cadence (~22 days + slippage) and the wait-guard silently
delays anyone who slips. Prefer last-outbound; accept from-start only if the client is adamant.

**Same follow-up copy is acceptable** (the client waived differentiation). Two mitigations are free and
should still happen:

- **Distinct per-seat sender profiles** (phase 0 config). Every AI draft reads
  `{{memberStep.first.outreachSenderProfile}}`, so B writes in B's voice with no prompt work — this is
  what stops B reading as a clone even with identical templates.
- **One prompt input: `priorAttempt: { memberName, sentAt }`**, so the opener can say *"Manoj reached
  out last month — picking this up."* One input, no copy rewrite. Without it the prospect sees the same
  script from a second face (E29), which is the remaining brand risk the client has chosen to accept.

### The handover choice (stop / wait / skip)

In practice this choice is almost always moot: a non-accepter's run reaches a terminal state a few
days after its invite, so at a 30-day gap **the previous sender has nothing running** (I3 already
excludes everyone who replied). The choice only matters for the stuck minority.

```
If the current sender is still working at handover time:
   ⦿ Wait for them to finish        ← default, always safe
   ○ Stop their run and take over   ← v0 behaviour when a run is live
   ○ Skip this person for now
```

| Option | Works? | Why |
| --- | --- | --- |
| Stop their run, then start the next | ✅ | cancel, then restamp |
| Wait for them to finish | ✅ | sweep skips while any open run exists (E8) |
| Skip this person | ✅ | leaves them with the current sender |
| **Leave it running and start the next** | ❌ | D8 — one stage register, skip-cascading FILTERs |

Never expose "run both". If a client reads that as "we want it faster", the honest lever is the **gap**
(shorter gap = closer to parallel), with the wait-guard keeping it correct. A gap of 0 plus
"wait for them to finish" is the fastest *safe* setting.

**What true parallel would actually cost.** Attempt-scoped state throughout: a per-attempt stage/state
field, attempt-scoped run keys so a payload can identify which attempt it belongs to, a rewritten
sibling-cancel scope, and every stage-reading node re-pointed at the attempt's own register — the
router, `Still CONNECTION_SENT`, `No reply yet (FU1–3)`, `Still WAITING_REPLY (… )`, plus the FILTER
cascade behaviour that makes a wrong read abort a whole branch. Roughly 2–3 weeks, and it re-opens
every invariant in this document (I1 in particular). It is only worth it if measured data shows the
sequential gap is the binding constraint on reply rate — which is a question the Omniways cohort can
answer before any of this is built.

### The four things that cannot be cut

1. **Sender pinning on.** Off, every send comes from the first member row (E7) — B would invite the
   same person from A's seat.
2. **The per-attempt connection gate** (2 nodes + 1 stamp). Without it the handover run wakes at
   `QUEUED` and dies silently at `Connection not yet sent?`.
3. **Cancelling A's open runs before the restamp.** Otherwise a stale `Wait 3 days` / follow-up wait
   fires later and sends as A (E3).
4. **A claim at accept.** Without it, two accepted invites produce two openers from one seat (E2).

### The one risk v0 accepts

A's invitation **stays open** while B invites, so a person can accept both. The claim means only one
conversation starts — but the prospect may see two pending requests from one company. That is the
`keep_open` trade, stated plainly in the UI copy: *"they may see two requests; only one conversation
ever starts."* Withdrawal and InMail exist in the full plan to remove even that.

### Effort

| Slice | Size |
| --- | --- |
| Fields (`outreachAttempt`, `outreachAttemptInviteDue`, `outreachReigniteAt`, `outreachFirstAcceptedMemberId` + claim state) | 0.5 d |
| 4 graph nodes + snapshot tests + resync command | 1 d |
| Claim + seat resolution + duplicate-webhook stage guard | 1.5 d |
| Sweep cron + run cancellation | 1 d |
| Setup toggle + gap + ordered members; `Next` cell | 1 d |
| Regression + manual QA on a staging workspace | 1 d |
| **Total** | **~6 days** |

### What v0 deliberately leaves ugly

- A late accept after B has opened → silence. Visible in the drawer, no hand-off note.
- Re-touch after a decline can only be prevented if `CONNECTION_IGNORED` lands (E31); the fast path
  does not yet require a positive "no relation" check.
- No copy differentiation per attempt — **fill each seat's sender brief before enabling**, or B reads
  as a clone of A (E29). This is a phase-0 config task, not code.
- Enabling on an existing list makes everyone due at once (E21). v0 mitigation is manual: enable
  with a large gap, or enable on a subset first.

### Pre-code pilot (zero build, ~1 day)

For 20–50 people, prove the idea before writing anything: **Stop outreach** on the cohort → set
`Owner = B` → set `Stage = Queued` → clear `outreachAnalytics.connectionSentAt` → **Start outreach**.
Works today because everything except the gate is already wired. Fragile by hand (two fields must stay
consistent) and it resets "Days to first contact", but it answers "does a second sender reactivate
people?" before spending six days.

## Recommended shape: rounds (project = round)

The three paths below all encode "a second attempt" **on the candidate**. That encoding is what forces
either graph surgery (same-candidate) or a coordination gap (two projects). Remove it: the client's own
words — *"sender A in month 1, sender B in month 2"* — describe **two rounds of a campaign**, and a round
already exists as a project.

The two things the project-split paths were missing are not engine work; they are in the wrong place.

### 1. Coordination belongs on the Person

Candidate rows cannot talk to each other, but every project loads the **same Person**, and `doNotContact`
is already a person field (`outreach-command-fields.data.ts:506`) that the graph loads but never checks.
One FILTER node after `Load Person`:

```
Do not contact?   {{queuedPersonFind.first.doNotContact}}  IS  false
```

One node, **zero new fields**, and every project stops that person — including a decline arriving *after*
round 2 has started. Enrolment-time guards cannot cover that; this can.

### 2. The operator surface belongs on round grouping

`outreach-home` is keyed by `projectId`. Group rounds under a campaign and add a round selector, and the
operator gets one list with a `Round` column plus a cross-round journey, instead of two tables.

### Build

| Piece | Size | Buys |
| --- | --- | --- |
| Round = project (one sender each, same list) | 0 d (ops convention) | fresh candidate → no gate change, no attempt state, no claim lock |
| Person-stop filter (1 node, reuses `doNotContact`) | 0.5 d | live cross-round coordination, in-flight included |
| "Next round" builder — cohort → round N+1, excluding replied / declined / booked / DNC / company-already-contacted | 1 d | repeatable without hand-enrolment; restores the per-company guard |
| Round grouping in outreach-home (`Round` column, cross-round journey) | 2 d | the single operator surface |

**~3.5 d.** Nothing in the same-candidate design is required: no 4 nodes, no `outreachAttempt*` fields,
no sweep, no claim lock, no revival, no resync. Double-accept stops being a defect (two people, two
threads — what being connected to two colleagues actually looks like), so there is nothing to arbitrate.

### Honest wart

The person appears **twice** in the `Candidate` object, once per round. Round grouping fixes reporting and
the People table; the raw Candidates nav still shows both rows and a naive count double-counts. Acceptable
for campaign-shaped tooling; if it is not, that is the one thing that pushes back to the same-candidate v0.

## Alternative path: campaign-per-attempt (new project per touch)

Instead of a second attempt on the same candidate, create a **new project** and enrol the same people
into it with a different sender. Zero code; it works today.

Why it works:

- `loadEnrollmentIndex` is **project-scoped** (`where: { projectId }`,
  `outreach-project-outreach-control.service.ts:846`), and there is no unique constraint on
  `(projectId, peopleId)` — so the same Person gets a **fresh candidate row** in the new project.
- A fresh candidate starts at `QUEUED` with empty `outreachAnalytics`, so the
  `Connection not yet sent?` gate passes naturally. **No graph changes at all.**
- Do-not-contact is loaded **workspace-wide** in the same index builder, so a blocked person stays
  blocked across every project.
- Two accepted invites land as two openers in two different threads (Manoj's and Nishant's), not as a
  duplicate in one thread — so the claim lock is not required in this model.

| Plan component | Required? |
| --- | --- |
| 4 graph nodes, attempt fields, sweep cron, atomic claim, seat resolution | ❌ none |
| Sender pinning **in the new project** | ✅ (else it sends from the first member row) |
| Cross-project exclusion at enrolment | ✅ to be safe, see below |

What it does not give you:

1. **No cross-project coordination.** A reply or decline in project 1 is invisible to project 2 —
   the two candidate rows share no state. This is the E31 failure (re-contacting someone who said no)
   and it is the disqualifying risk if left unhandled.
2. **Per-company dedupe breaks across projects** — `companySiblingFilters` includes
   `projectId IS <this project>` (`graphs:711`), so project 2 can contact a second person at a company
   project 1 is already working.
3. **Two tables, split reporting** — the operator's only surface (outreach-home People) doubles, and
   "did the second touch work?" needs a manual cross-project comparison.
4. **Project sprawl** — one project per touch, each with its own sender config, send window and
   templates.

**If this becomes the production shape, the minimum guard (~2 days):** when enrolling into project N,
exclude anyone whose candidate in any other project has replied, declined, booked a meeting, or been
contacted at the same company. Add a listener that stamps `stopOutreach` across all projects for a
person on reply/decline (~0.5 d). That covers both the enrolment-time and the in-flight case without
touching the graph.

**Recommendation:** use campaign-per-attempt as the **zero-code pilot** for the first cohort (better
than the manual field-edit pilot below — no state scrubbing, DNC handled), then pick the production
shape on evidence: 2-day guarded projects if reactivation is strong, or the 6-day same-candidate v0 if
a single table and live coordination matter more.

## Invariants

These must hold at every commit; every edge case below is a consequence of one of them.

| # | Invariant |
| --- | --- |
| I1 | Exactly one attempt is in flight per candidate at any time. |
| I2 | One conversation per person per workspace. First accepted invite owns it; later accepts are recorded, never messaged. |
| I3 | An attempt only exists if the previous attempt got no accept and no reply. |
| I4 | Repeat is impossible without sender pinning on and ≥2 seated members. |
| I5 | Every attempt's send is attributed to the seat that actually sent it. |
| I6 | Re-entry never re-sends an invite from a seat that already invited that person. |

## What exists today

| Capability | Where | Limit |
| --- | --- | --- |
| Entry gate | `outreach-workflow-graph-helpers.ts:1653-1717` — `candidate.upserted` + stage ∈ `{QUEUED, CONNECTION_ACCEPTED, REPLIED, MEETING_BOOKED}` + `startOutreach` + `!stopOutreach` | `WAITING_REPLY`, `FAILED_NO_REPLY`, `CONNECTION_SENT`, `EMAIL_SENT`, `DEFERRED`, `FAILED_ENRICH` are **non-entry** — a finished person cannot wake a run |
| Re-entry guard | `outreach-workflow-graphs.ts:2731-2745` — `Connection not yet sent?` = `IS_EMPTY outreachAnalytics.connectionSentAt`, else-branch `[]` | A naive `QUEUED` restamp silently ends the run |
| Sender resolution | `outreach-workflow-graphs.ts:3316-3337` → `Load workspace member` (`gtmWfMemberStep`, helpers:1579) | With pinning **off** the FIND is unfiltered `limit: 1` → **first member row**. All sends use `{{memberStep.first.id}}` (helpers:380); all AI drafts use `senderJson` = `{{memberStep.first.outreachSenderProfile}}` (helpers:392) |
| Pinned sender | `outreach-member-assignment.service.ts:128` — returns `alreadyPinned: true`, never re-scores | Sticky, but honoured: overwrite the field and the new value wins |
| Sibling cancel | `cancel-outreach-sequencer-sibling-runs.util.ts:8` — only `CONNECTION_ACCEPTED`, `REPLIED` | A `QUEUED` re-entry cancels nothing |
| Accept identity | `unipile-webhook.service.ts:1196` resolves **workspace** from `account_id`, then drops it; `materialize.util.ts:338` writes stage only | Accept has **no seat identity** |
| Accept idempotency | `outreach-command-materialize.service.ts:126-183` | No stage guard for `connection_accepted` (only `inbound_reply_flush` is guarded) |
| Opener idempotency | — | No `openerSentAt` anywhere; accepted branch guards inbound only (`graphs:897`) |
| Split / assign | `outreach-member-assignment.service.ts:703-776`; skip reason `already_started_use_force` | One owner per person |
| Sweep precedent | `outreach-deferred-resume-cron.service.ts` (`@Cron(EVERY_HOUR)`, iterate workspaces) → `resumeDueCandidates` (`take: 500`) restamps stage | Reuse this shape |
| Invite withdrawal | — | **No code path**; Unipile supports it. Phase 3 |

## Decisions

- **D1 — Re-entry reuses `QUEUED`.** No new stage. A new `REENGAGE` stage costs a trigger filter, a
  router branch, a metadata migration and edits in ~6 files that enumerate stages
  (`outreach-command-materialize.util.ts`, `outreach-command-fields.data.ts`, `outreach-stages.ts`,
  `outreach-home.types.ts`), and still needs a per-attempt signal. Verified safe: company dedupe
  excludes self via `candidateId IS_NOT` (`graphs:718-724`).
- **D2 — The attempt record is the source of truth**, not a boolean. `outreachAttempts` (RAW_JSON,
  ordered) drives everything; `outreachAttemptInviteDue` is a **derived cache** written in the same
  transaction, because `IF_ELSE` takes a static path and cannot compute
  (`gtmWfFindField` → `{{step.first.<field>}}`, helpers:402). Document the derivation in the field
  description; add a reconcile job that recomputes it from the array (cheap, catches drift).
- **D3 — The cron restamps the record; it never creates a run.** Run creation stays with
  `candidate.upserted`. Creating runs directly would bypass the entry filter, the pinned-member
  resolution and the payload shape.
- **D4 — One global cron, per-project eligibility.** Do not add/remove cron entries per tenant. The
  project's `Repeat the list` config decides whether anything is ever stamped due. Mirrors the
  deferred-resume sweeper, which iterates all workspaces.
- **D5 — A claim is provisional until the first message is sent.** The prospect-visible event is the
  opener, not the accept. Claim on accept (`provisional`), CAS `provisional → locked` at the opener
  step, and allow reassignment only while still provisional. `outreachPrimarySenderId` decides who
  invites first and what ops see; it never delays a claim. (Revised from "first accept wins" — see
  [What the prospect sees](#what-the-prospect-sees-reputation-constraints).)
- **D6 — Withdrawal is one of three E6 policies, not the default.** Unipile supports withdrawal
  natively — `DELETE /api/v1/users/invite/sent/{invitation_id}?account_id=…` returns
  `{"object":"InvitationCanceled"}`, and `GET /api/v1/users/invite/sent` lists what is still pending.
  But withdrawal **closes the late-accept window**, which is where the highest-intent accepts live. Ship
  `keep_open` in phase 1–2; add `withdraw` and `inmail` as per-project policies in phase 3 and pick by
  measured accept-lag, not by preference
  (see [Phase 3](#phase-3--closing-e6-no-two-live-invitations)).
- **D7 — Re-touch fast path skips qualify and company dedupe.** A person reaching attempt 2 was
  already qualified and is already "contacted"; re-running either can `DEFER` them (see E9, E15).
- **D8 — No parallel runs, and the guard is not a user option.** Two live runs share one
  `outreachSequenceStage` register, and the cadence reads that register with **skip-cascading FILTERs**:
  `No reply yet (follow-up N)` requires `CONNECTION_ACCEPTED` (`graphs:781-787`) and a failed FILTER
  kills the rest of that run. So a second run stamping `CONNECTION_SENT` silently aborts the first one's
  follow-up branch, and vice versa (`Still CONNECTION_SENT`, `graphs:2845`). True parallel needs
  attempt-scoped state — a separate project, priced below.
  The user-facing control is therefore **gap + what to do when the current sender is still working**
  (wait / stop-and-take-over / skip), never "run both".

## Data model (`candidate`, all additive)

| Field | Type | Purpose |
| --- | --- | --- |
| `outreachAttempts` | `RAW_JSON` | **Source of truth.** Ordered attempts (shape below) |
| `outreachAttempt` | `NUMBER` (default 1) | Current attempt index, denormalised for queries/filters |
| `outreachAttemptInviteDue` | `BOOLEAN` (default false) | Derived cache read by the connection gate |
| `outreachReigniteAt` | `DATE_TIME` (indexed) | When the next attempt becomes due. Stamped at send time = `inviteSentAt + gap`. `NULL` = not scheduled |
| `outreachReigniteStopReason` | `SELECT` | `exhausted`, `accepted`, `replied`, `meeting_booked`, `stopped`, `dnc`, `seat_unavailable`, `failed` |
| `outreachFirstAcceptedMemberId` | `TEXT` | **The lock.** Written once, atomically |
| `outreachFirstAcceptedAt` | `DATE_TIME` | When the winning accept landed |
| `outreachOpenedByMemberId` | `TEXT` | Who sent the opener (attribution + idempotency) |
| `outreachOpenerSentAt` | `DATE_TIME` | Opener idempotency (I2) |
| `outreachLastInviteMemberId` | `TEXT` | Per-seat invite dedupe (I6) |
| `outreachLastInviteId` | `TEXT` | Phase 3 withdrawal handle |
| `outreachPrimarySenderId` | `TEXT` | Optional; defaults to `attempts[0].memberId` |

```ts
type OutreachAttempt = {
  index: number;
  memberId: string;
  status:
    | 'planned' | 'sent' | 'accepted' | 'accepted_late'
    | 'replied' | 'stood_down' | 'skipped' | 'expired' | 'failed';
  scheduledAt?: string;   // due time
  sentAt?: string;        // actual send (gap is measured from here)
  acceptedAt?: string;
  inviteId?: string;      // phase 3
  withdrawnAt?: string;   // phase 3
  skipReason?: string;
};
```

Analytics: keep `outreachAnalytics.connectionSentAt` as **first ever** invite (reporting integrity —
"Days to first contact" must not reset). Add `outreachAnalytics.connectionSentByMember: { [memberId]: iso }`
for per-seat dedupe and reporting.

## Sequencer graph changes — 4 nodes

`buildCandidateSequencerGraph` (`outreach-workflow-graphs.ts`). Nothing else on the canvas changes:
all ~12 send nodes read `{{memberStep.first.id}}` and all AI nodes read
`{{memberStep.first.outreachSenderProfile}}`, so swapping the seat needs no send-node edits.

**1 + 2 — the connection gate (both twins).** `IDS.connectionNotSentIf` (graphs:2731) and
`IDS.connectionNotSentNoCompanyIf` (graphs:2745):

```diff
- stepOutputKey: {{<queuedFind>.first.outreachAnalytics.connectionSentAt}}
- operand: IS_EMPTY        type: TEXT
+ stepOutputKey: {{<queuedFind>.first.outreachAttemptInviteDue}}
+ operand: IS             value: 'true'      type: BOOLEAN
```

**3 — stamp on send.** `IDS.markSent` (`'Mark CONNECTION_SENT'`, graphs:2819) gains one field:

```diff
  objectRecord: {
    outreachSequenceStage: 'CONNECTION_SENT',
+   outreachAttemptInviteDue: false,
  }
```

(`UPDATE_RECORD` resolves `{{…}}` templates — precedent at graphs:2301-2305 — so if a stamp of
`outreachLastInviteMemberId: {{member.first.id}}` is preferred over a service hook, it is available.)

**4 — re-touch fast path.** After `IDS.routeFind`, inside the QUEUED branch:

```
[IF_ELSE] Re-touch?  {{queuedFind.first.outreachAttempt}} > 1
   ├── yes → connection note  (skip qualify, enrichment stamp, company dedupe, warm-up)
   └── no  → existing qualify → dedupe → warm-up → connection note
```

This is required, not cosmetic: without it a reignited person re-qualifies (one profile fetch + one
AI call each) and can be `DEFER`red by qualify or by another contacted person at their company.

**Optionally, deferred:** exempt attempt > 1 from being treated as an "earlier QUEUED sibling" by
adding `outreachAttempt IS 1` to `companySiblingFilters` (`graphs:698-726`) — otherwise a reignited
person can silently block new enrolments at their company. Decide in phase 2 (see E16).

## Server changes

**S1 — Sweep** (new `outreach-reignite-cron.service.ts`, cloned from
`outreach-deferred-resume-cron.service.ts`; `@Cron(EVERY_HOUR)`, iterate workspaces):

```
for each workspace:
  skip if project.outreachStatus === 'PAUSED'                       (throttle:49)
  find({ where: {
      outreachReigniteAt <= now,
      outreachSequenceStage IN ('CONNECTION_SENT','EMAIL_SENT','FAILED_ENRICH',
                                'FAILED_NO_REPLY','WAITING_REPLY'),
      candidateFlags.stopOutreach != true,
      outreachAttempt < maxAttempts, outreachReigniteAt IS NOT NULL,
    }, take: 500 })
  per candidate:
    A. re-check eligibility NOW  (E1, E2, E6, E9)
    B. skip if any OPEN run exists for candidate+sequencer              (E8)
    C. atomic claim:
         UPDATE candidate SET outreachReigniteAt = NULL,
                             outreachAttempt   = outreachAttempt + 1
          WHERE id = :id AND outreachReigniteAt IS NOT NULL
         → 0 rows = another tick won, skip
    D. cancel ALL open runs for candidate+sequencer                    (E3)
    E. write: outreachWorkspaceMemberId = next.memberId,
              outreachSequenceStage = 'QUEUED',
              candidateFlags.startOutreach = true, stopOutreach = false,
              outreachAttemptInviteDue = true,
              outreachAttempts = [...prev, next]
       (+ outreachReigniteStopReason = null)
    F. that write fires candidate.upserted → Run #2
```

`outreachReigniteAt` is stamped by the **send** action / materialize hook, not at plan time,
so the gap measures real sends. Guard: `isProcessing` is per-process only — the DB claim (step C) is
the real concurrency control.

**S2 — Seat resolution at accept.** `unipile-webhook.service.ts:1196`: resolve the **member** from
`account_id` via `workspaceMember.linkedinUnipileAccountId` (the query service already maps it) and
pass it down through `applyAcceptedRelationMaterialize` → `applyCandidateEvent`.

**S3 — First-accept lock.** In the accept path:

```
UPDATE candidate
   SET outreachFirstAcceptedMemberId = :memberId,
       outreachFirstAcceptedAt       = now(),
       outreachWorkspaceMemberId     = :memberId,
       outreachSequenceStage         = 'CONNECTION_ACCEPTED'
 WHERE id = :id AND outreachFirstAcceptedMemberId IS NULL
```

- **1 row** → winner. Stamp stage, wake the accepted branch from the winning seat. Claim state is
  `provisional` (`outreachFirstAcceptedMemberId` + `outreachClaimState`).
- **0 rows** → `accepted_late`. Write the accept onto that attempt (`status: 'accepted_late'`), keep
  the connection and thread on that seat, **do not change stage, do not wake a run**, notify that
  sender: "already opened by `<winner>` — do not DM."
- Add the stage guard to `applyCandidateEvent` for `connection_accepted` so a **duplicate webhook**
  is a no-op (this is already a live bug: retries create duplicate ACCEPTED runs today).

**S3b — provisional → locked at the opener.** The `Send LinkedIn message` step CASes
`outreachClaimState: provisional → locked` and stamps `outreachOpenedByMemberId` + `outreachOpenerSentAt`;
only the run that wins the CAS may send. While still `provisional`, an accept arriving from an
**earlier attempt** reassigns the claim and cancels the pending opener — so the person hears from the
invite they accepted first, not the webhook that fired first. After `locked`, accepts are
`accepted_late`.

**S4 — Opener idempotency.** Before `Send LinkedIn message` in the accepted branch, require
`outreachOpenerSentAt IS_EMPTY`; stamp it (with `outreachOpenedByMemberId`) on send. One filter node
in the accepted branch, or an `IF_ELSE` reuse of the existing inbound guard pattern.

**S5 — Repeat enablement validation.** Refuse to enable `Repeat the list` unless: pinning is active
in the live version, ≥2 members with a seated LinkedIn account, gap ≥ 14 days, `maxSenders` 2–3, and
**exactly one active Candidate Sequencer workflow** exists in the workspace (see E19).

**S6 — Reconcile job** (hourly, cheap): recompute `outreachAttemptInviteDue` from `outreachAttempts`;
close candidates whose `stopReason` contradicts their stage; clear `outreachReigniteAt` for
candidates that became ineligible (replied, stopped, DNC).

## UI

### Setup → Team sending (owns the strategy)

Replace the lone policy dropdown with two radio cards. Keep the existing pin status tag and the
`Members on this list` list with `LinkedIn connected · N active`.

**Card A — Divide the list** *(default)*
> Each person is contacted by exactly one member. Replies, follow-ups and the thread stay on that
> member's seat.
- Divide by: `Least loaded ▾` · Members: `☑ Manoj · ☑ Nishant`
- Preview (server, no writes — `buildOutreachSplitPlan` + `loadActiveCandidateCounts`):
  `448 people → Manoj 224 · Nishant 224` · `17 already in a conversation keep their sender`
- Secondary: `Re-divide 286 people who haven't started` → tooltip surfaces the real skip reason
  (`already_started_use_force`) instead of dropping it silently.

**Card B — Repeat the list**
> Every person is worked by each member in turn. The next sender starts only after the gap, and only
> if the person hasn't accepted or replied.
- Order: `① Manoj · PRIMARY ⇄ ② Nishant · BACKUP`
- Gap: `20 days` **or** `fit a 40-day cycle → 20 each`
- Max senders per person: `2`
- Stop when: `Accepted · Replied · Meeting booked · Do-not-contact`
- ☐ `Only one invitation open at a time` — *withdraw the previous sender's invitation before the
  next starts* — **disabled in phase 1–2** with `Needs invite withdrawal (phase 3)`
- Preview timeline: `Day 0 Manoj invites → Day 20 Nishant invites if no reply → resolves`
  plus live counts: `applies to 305 people with no reply · 60 replied or booked skipped · 83 blocked on email`
- Warnings: gap < 14 days (`a second invite from a different seat reads as coordinated`);
  empty sender profile on any seat (`Nishant has no sender brief — his messages will sound like Manoj`).

**Enablement banner** when pinning is off: `Turn on pinning & apply` (calls
`applyOutreachSequencerGraphOptions` inline) instead of sending the user to another screen.

### Edit Workflow → Sender (verifies, does not duplicate)

```
Senders   Repeat the list · Manoj → Nishant · 20-day gap · 2 touches max
          Configured in Setup → Team sending                      [Open Setup]
[✓] Pin outreach sender by warm overlap      ← the only graph-shaping switch
```

### People table / drawer

Row reads as a sentence: `Nishant · touch 2 of 2 · day 12 of 20`, `Manoj · touch 1 of 2 · invited`,
`Done — replied to Manoj`. Drawer gains an **Attempts** block (per member: planned / sent / accepted /
accepted_late / stood down / skipped, with timestamps). Workflow Runs label attempts
`Run 2 of 2 · Nishant` (attempt index in the trigger payload; no `parentWorkflowRunId`).

## Build order

| Phase | Scope | Size |
| --- | --- | --- |
| 0 | Config only: pinning on, per-seat sender briefs, email connected, deactivate duplicate sequencer, activate | 0.5 d |
| 1a | Fields + DTO + `resolveOutreachSequencerGraphOptions` plumbing + tests | 1 d |
| 1b | 4 graph nodes + snapshot tests (option on/off) + resync upgrade command | 1.5 d |
| 1c | Accept: seat resolution + first-accept lock + `accepted_late` + duplicate-webhook guard | 1.5 d |
| 1d | Opener idempotency (`outreachOpenerSentAt`) + stamp on send | 0.5 d |
| 1e | Sweep cron + atomic claim + run cancellation + reconcile job | 1.5 d |
| 2 | Setup cards + previews + Edit Workflow summary + People/drawer attempt surfaces | 2 d |
| 2b | Company-sibling exemption for attempt > 1 (E16) — decide after load test | 0.5 d |
| 3a | Invite id capture + pending-invite check (`GET /users/invite/sent`) | 0.5 d |
| 3b | Withdraw action + fail-closed gate before attempt N+1 | 1 d |
| 3c | Per-attempt channel policy (`connect \| inmail \| email`) for attempts ≥ 2 | 1 d |
| 4 | Per-person override (`Senders…` chips on People) | 1.5 d |

Phases 1a–1e are the safety core. **Do not ship the Repeat UI before 1c lands** — with repeat on and
no lock, two accepted invites produce two openers from one seat (proven trace, E2).

## Phase 3 — closing E6 (no two live invitations)

Goal: at most one open invitation per person per workspace. Three sub-phases, 3a is a prerequisite for
either policy.

### 3a — capture the invitation id, and know what is still pending

Today the id is **thrown away**: `sendInvitation` POSTs `/api/v1/users/invite` and only `console.log`s
the response (`linkedin-unipile-messaging.service.ts:403-437`); the tool nests it at
`result.response` (`send-linkedin-connection-request-tool.ts:139-147`); nothing persists it.

- Persist `outreachLastInviteId` + `outreachAttempts[i].inviteId` on a successful connect send. Do it in
  the action's post-send hook, next to where `getMaterializeEvent()` already emits `connection_sent`
  (`send-linkedin-connection-request.workflow-action.ts`), so the member and candidate are both in scope.
- Add `getPendingInvitations(accountId)` → `GET /api/v1/users/invite/sent`. This is the "is it still
  live?" oracle; never blind-call the DELETE.
- Backfill is impossible for already-sent invites (no id stored) → for pre-existing candidates treat the
  invitation as **`unknown`**, and see the fallback in 3b.

### 3b — withdraw before the next attempt, failing closed

At sweep step D (before writing the new owner/stage), for the previous attempt:

| Pending check on attempt N's invite | Action |
| --- | --- |
| **still pending** | `DELETE /api/v1/users/invite/sent/{inviteId}?account_id=A` → on `InvitationCanceled`, stamp `withdrawnAt`, continue to attempt N+1 |
| **gone, and the person is now 1st degree** | Do **not** invite. The claim lock already made A the winner; route attempt N+1 to the message path or skip entirely |
| **gone, no relation** (withdrawn / expired / declined) | Continue to attempt N+1 normally |
| **`unknown`** (no id captured, or the list call failed) | **Do not invite.** Park: leave `outreachReigniteAt` set, retry next sweep |

**Fail-closed is the whole point.** Any non-confirming outcome — 5xx, timeout, `unknown` — must leave
attempt N+1 unstarted. A transient `503` that we shrug at is exactly how you end up with two live
invitations. Add a `skipReason: 'pending_invite_unresolved'` after N consecutive failures and surface it
in the People table so it is visible, not silent.

### Race with accept

- **Accept lands first** → DELETE returns 404 → the pending check shows a 1st-degree relation → skip the
  invite, let A's opener run. Correct outcome, no cleanup needed.
- **Withdraw lands first** → a late `new_relation` accept for A can still arrive. Detect it (attempt has
  `withdrawnAt` set) and treat it as `accepted_late`: record it, **do not** message, notify A.
- Either way the claim lock decides ownership. Withdrawal *reduces the frequency* of the two-invite
  state; the lock *bounds the damage* when it happens anyway. Both are needed — withdrawal is not a
  substitute for 1c.

### 3c — or skip withdrawal entirely: change attempt 2's channel

A second connection request is the weakest possible touch on someone who ignored the first. Attempts
≥ 2 can use a channel that creates **no invitation at all**:

| Attempt channel | Invitation footprint | Depth | Cost |
| --- | --- | --- | --- |
| `connect` (default) | one per attempt | full cadence if accepted | needs 3a/3b to stay clean |
| `inmail` | none | single touch + email fallback — **no FU1–3**, because there is no accepted thread | Sales Navigator InMail credits per seat (`LinkedIn Specific → Get inmail credit balance`) |
| `email` | none | single touch + follow-ups | needs a connected email (Omniways has none today) |

The graph already supports all three: `inmailEnabled` / `Send InMail`, the email path, and
`method: 'inmail'` in the messaging service (`linkedin-unipile-messaging.service.ts:397`). So 3c is a
**policy on the fast path** — attempt > 1 routes to InMail/email instead of the connect node — with no
new API surface at all.

Trade-off to state to the client: `inmail`/`email` makes E6 structurally impossible and costs no
engineering, but attempt 2 becomes a single touch rather than a full second sequence. `connect` +
withdrawal preserves full depth and needs 3a/3b.

### 3d — "keep both open" is a legitimate third policy, if the claim is revivable

Some clients will refuse withdrawal because it **closes the late-accept window** — the highest-intent
accepts are often the slowest ones. That is a real cost, and for those clients `inmail` (3c) strictly
dominates `withdraw` (3b): nothing vanishes, nothing is forfeited, and no second request exists.

If the client instead wants both invitations live to maximise chances, that is also legitimate — but
then the claim must be **revivable**, and late accepts become an asset rather than a liability:

- The lock is **global per conversation**, keyed on the first message sent in *any* thread — not on the
  first accept.
- Accept arriving while nothing has been sent anywhere → that seat claims and opens. A candidate whose
  sequence "ended" can revive months later.
- Accept arriving after `locked` → `accepted_late`. Do **not** message the same person from a second
  thread. Optional per project (`silence | handoff`): the late sender sends **one** short, non-pitchy
  hand-off… *"Nishant's picking this up — I'll leave you in good hands"*, then goes quiet. One message to
  a 1st-degree connection is normal; accepting someone and hearing nothing is the awkward part.

Choosing between `keep_open`, `withdraw` and `inmail` should be a **data** decision, not a preference:
`Connection Sent At → Connection Accepted At` is already stored per candidate
(`outreachAnalytics.connectionSentAt` / `firstContactAt`). Pull the p50/p90/p99 accept-lag
distribution. If the tail past the gap is negligible, withdrawal is nearly free; if it is material,
`inmail` or `keep_open` is obviously right.

### UI consequence

The checkbox becomes a real choice rather than a disabled stub:

```
Only one invitation open at a time
   ○ Withdraw the previous sender's invitation, then invite   (full sequence, closes the window)
   ○ Skip the invite — second touch by InMail / email          (no invitation, window stays open)
   ○ Keep both invitations open                                (max acceptance, two requests visible)
```

Show the honest promise per option:
`withdraw` → *"nobody receives two requests from us at once"*,
`inmail` → *"the second touch never creates a second request, and the first stays open"*,
`keep_open` → *"they may see two requests; only one conversation ever starts"*.

## Test matrix

| Case | Expected |
| --- | --- |
| Attempt 1 no accept, gap elapses | attempt 2 `planned` → `sent` from seat B; stage `QUEUED` → `CONNECTION_SENT` |
| Attempt 1 accepted | attempt 2 `stood_down`; no invite from B; opener from A only |
| Attempt 1 replied | attempt 2 `stood_down`; `reigniteStopReason = replied` |
| B accepts, A pending | B claims; A `stood_down`; one opener from B |
| Both accept, A first | A claims + opens; B `accepted_late`; **no second opener**; B notified |
| Both accept, B first | symmetric |
| **Late accept revives a closed cadence** (A's invite open, nothing ever sent) | claim moves to A while `provisional`; A's opener runs; stage `CONNECTION_ACCEPTED` |
| **Late accept after `locked`** | `accepted_late`; no second thread; `silence` or exactly one hand-off note |
| `keep_open` policy: A pending, B accepted | B opens; A's request left pending; A's later accept → `accepted_late` |
| `inmail` policy: B never invites | one request (A's) + one message; A's window still open at attempt-2 end |
| Duplicate accept webhook (retry) | single run; no second opener |
| Accept after full cadence (in `WAITING_REPLY`) | claim recorded; opener **not** resent |
| Retry after restamp crash | claim `WHERE outreachReigniteAt IS NOT NULL` → exactly one run |
| Gap < sender cadence, person accepted | skipped by stop rule (accepted) |
| Seat B disconnected | attempt 2 `skipped: seat_unavailable`; try next sender or hold |
| Cap reached (2 of 2) | `reigniteStopReason = exhausted`; never re-enters |
| Pinning off | Repeat card disabled; server rejects enablement |
| Two operators enable concurrently | config write idempotent |
| Reignited person at a company that got contacted meanwhile | E15 — fast path skips dedupe, attempt proceeds |
| Two people at one company both due | E16 — verify one is not silently starved |

## Edge case register

Severity: **S1** = visible to the prospect or destroys data; **S2** = silent miss / stuck person;
**S3** = cosmetic or operator confusion.

| # | Edge case | Sev | Mitigation | Phase |
| --- | --- | --- | --- | --- |
| E1 | Reply lands between sweep query and restamp | S1 | Eligibility re-check **after** the claim; claim is atomic | 1e |
| E2 | Prospect accepts both invites | S1 | Seat resolution at accept + first-accept lock + opener idempotency. Record loser, never message | 1c/1d |
| E3 | Stale open run fires an InMail as the old sender | S1 | Cancel **all** open runs before the restamp; extend `shouldCancel…` to the reignite entry | 1e |
| E4 | Duplicate webhook creates a second ACCEPTED run (exists today) | S1 | Stage guard for `connection_accepted` in `applyCandidateEvent` | 1c |
| E5 | Two cron instances / double tick | S1 | DB atomic claim (rows affected = 1); `isProcessing` is not enough | 1e |
| E6 | A pending invite accepted later, after B started | S1 | Same lock as E2; closed properly by Phase 3 (withdraw-then-invite, or InMail/email for attempt ≥ 2) | 1c / 3 |
| E7 | Pinning off but repeat enabled → **same seat invites twice** | S1 | Hard validation (server + disabled card); verify by inspecting the live graph for the selector node | S5 |
| E8 | Attempt 2 starts while attempt 1 still has an open run (long-tail accepter) | S1 | Skip candidate if any open run exists for candidate+sequencer | 1e |
| E9 | Reignited person re-qualifies → flips to `DEFERRED` | S2 | Re-touch fast path skips qualify | 1b |
| E10 | Email not connected → attempt 2 fails the same way (Omniways: 83 people) | S2 | Phase 0: connect email or turn `Email account connected` off so the branch notifies instead of failing | 0 |
| E11 | Gap shorter than the sender's own cadence | S2 | Stop rules (accepted/replied) make it moot; enforce ≥14 d; show computed minimum | 2 |
| E12 | Seat B loses its Unipile account mid-plan | S2 | `resolveEligibleMemberIds` at fire time; `skipReason: seat_unavailable`; fall through to the next sender | 1e |
| E13 | Person already 1st-degree with B before B's turn | S3 | Skip the invite for that attempt, go straight to opener | 2 |
| E14 | Person already invited by B historically | S3 | `outreachAnalytics.connectionSentByMember` check before stamping B | 1a |
| E15 | Another person at the company got contacted meanwhile → re-touch `DEFER`red | S2 | Fast path bypasses the company-dedupe branch | 1b |
| E16 | Reignited person becomes an "earlier QUEUED sibling" and starves new enrolments at their company | S2 | Add `outreachAttempt IS 1` to `companySiblingFilters` | 2b |
| E17 | Missed sweep (deploy, outage, paused project) | S2 | Sweep is idempotent and self-healing; lateness ≤ 1 h; never mark exhausted on infrastructure failure | 1e |
| E18 | `PAUSED` project resumes with a backlog | S2 | Stamp `reigniteAt = max(due, resumeAt)` and ramp (N/day/seat) on resume | 1e |
| E19 | A second Candidate Sequencer gets activated (Omniways currently has one in Draft) → two active graphs racing | S1 | Refuse to enable repeat unless exactly one active sequencer; audit command to detect duplicates | S5 |
| E20 | Workflow re-activated mid-flight → attempt 1 on v3, attempt 2 on v4 | S3 | Announce; activate before enabling; run freezes its graph (`state.flow.steps`) so behaviour is at least consistent per run | runbook |
| E21 | Enable on an existing list → hundreds instantly due | S1 | On enable, stamp `reigniteAt = max(lastOutbound + gap, enableAt + cooldown)` and cap the first wave; preview shows the count | 1e/2 |
| E22 | Attempt-2 AI opener invents continuity ("as we discussed") on a cold thread | S1 | Pass `attempt` into the prompt; suppress history referencing and prior-thread references on attempt > 1; regression test | 1b |
| E23 | Two candidates for one Person (duplicate rows) | S2 | Reuse `matchCandidateByPersonIdentity` on enrolment; never create a second row | existing |
| E24 | Person blocks / reports; connection gone | S2 | Treat `CONNECTION_IGNORED` as terminal for repeat; never re-invite | 1e |
| E25 | Operator changes order/gap while attempts are in flight | S3 | Snapshot the plan onto `outreachAttempts` at claim time; new config applies to new plans only | 1a |
| E26 | Per-seat invite quota consumed faster; sends fail or queue | S2 | Repeat roughly doubles invite volume — forecast it; respect the send window; reuse the pacing service; cap at 2–3 senders | 2 |
| E27 | Attempt 2 send fails (transient) → person wrongly marked exhausted | S2 | Count **sent** attempts, not started ones; `failed` is retryable, `exhausted` only after a successful send | 1e |
| E28 | Withdrawal race: accept lands while withdraw is in flight | S1 | Claim lock still decides; if accept wins, cancel the withdrawal and keep the thread | 3 |
| E29 | Prompt/voice: both attempts pitch the same angle (`personaGuidance` is project-level) | **S3 — accepted risk** | Client waived differentiation on 2026-11-03. Keep the two free mitigations: distinct per-seat sender profiles (phase 0) and the `priorAttempt` prompt input. Attempt-level angle is optional, not required | 0 |
| E30 | Cross-project double contact (same person in two projects) | S3 | Out of scope; document. Enrolment dedupe is per project | — |
| E31 | **Decline not detected** → re-touch after an explicit no | S1 | Treat any negative signal (`CONNECTION_IGNORED`, withdrawn-by-prospect, block, unsubscribed) as **terminal** and permanent. Sweep requires a positive "no relation" check, never an absence of signal. `reigniteStopReason = dnc` | 1e |
| E32 | Duplicated warm-up footprint — two seats view + comment on the same person | S2 | Make the warm-up per **person**, not per attempt: skip view/comment when any prior attempt already did it | 2 |
| E33 | **Late accept of an earlier invite** while a later attempt is in flight — either revived or dropped | S1 | Claim is revivable while `provisional`; revives only when nothing has been sent anywhere. After `locked` → `accepted_late` + optional single hand-off note (3d). Never a second opener | 1c/3d |
| E34 | Withdrawal chosen, then the person would have accepted late | S2 | That is the cost of `withdraw`; measure the accept-lag tail first and prefer `inmail`/`keep_open` when the tail is material (3d) | 3 |

## What the prospect sees (reputation constraints)

The cadence is spec'd from the sender's side; this section is the receiving side. Every row here is a
hard constraint on copy, ordering and timing, not a nicety.

| Our action | What lands on their screen |
| --- | --- |
| `View LinkedIn profile` (warm-up) | Profile-view notification — **public groundwork, not silent** |
| `Comment on post` (warm-up) | A public comment from that sender on their post, visible to their network |
| Connection request | Pending request + note; their connect button reads *Pending* |
| **Withdraw A's request** | The request **vanishes** from *Manage invitations*. No notification — but a ghost if they saw it |
| B's request, 20 days later | A second notification, same company badge, different face |
| Opener | Message thread. A losing sender's thread stays empty forever |
| **Late accept of an earlier invite** | Either a **revived conversation** (if nothing was sent yet) or a short hand-off note — never a second pitch (E33) |

### Ranked tells (what makes it read as a machine)

1. **Two overlapping requests from one company** — the loudest signal. Phase 3 exists to remove it.
2. **Same pitch, different face** — `personaGuidance` is project-level (E29).
3. **Duplicate openers** — unambiguous bots (E2/E4).
4. **Re-contact after an explicit decline** — not persistence, it's ignoring consent (E31).
5. **Duplicated warm-up footprint** — two seats viewing + commenting in the same month (E32).

### Rules

- **Order ascends in seniority.** AE → founder reads as escalation; founder → AE reads as a
  downgrade. Default the sender order by seniority and say why in the card.
- **Attempt 2 acknowledges attempt 1** — *"Manoj reached out a few weeks back, I'm picking this up from
  a different angle."* It is true, it is coordinated, and it converts the strongest tell into the
  differentiator. Pass `priorAttempt: { memberName, sentAt }` into the attempt-2 prompt and require the
  opener to reference it (E22/E29).
- **Attempt 2 carries a different angle or asset.** If the client cannot differentiate content, do not
  enable repeat — two profiles running one script is worse than one profile running it once.
- **Prefer `inmail` over `withdraw` for attempt 2** where InMail credits exist: a message leaves no
  trace, a withdrawn request leaves a ghost, and `inmail` **keeps the first sender's window open** —
  so it dominates withdrawal for every client that dislikes closing windows
  ([Phase 3](#phase-3--closing-e6-no-two-live-invitations)).
- **Never leave an accepted invite in permanent silence.** If a late accept cannot own the
  conversation because one is already locked, send one short non-pitchy hand-off note (or nothing at
  all, as an explicit choice) — but never a second pitch.
- **Gap floor 20 days** (minimum 14). 5–7 days reads as a spray.
- **A decline is terminal** — see E31. Any explicit negative permanently ends repeat for that person.
- **Cap one active cadence per company.** Two people at one company mid-cadence reads as a coordinated
  campaign and collides with per-company dedupe anyway.
- **Warm-up footprint is per person, not per attempt.** Do not view/comment twice.

### Honest economics

Repeat roughly doubles invitations (≈450 people → ≈900 requests) to buy one extra touch per
non-responder. It is net positive **only** with differentiated copy and a gap that looks deliberate;
without those it is a spam multiplier that costs the brand more than the extra replies are worth.

## Future proofing

- **N senders, not two.** The model is an ordered `outreachAttempts` array — no
  `primary/secondary` boolean anywhere. `outreachPrimarySenderId` is a pointer into it, defaulting to
  `[0]`. Adding a third sender is a config change.
- **Channels.** The attempt is channel-agnostic; only the *gate* is per attempt-per-member. Design the
  gate as per-attempt-per-channel from day one (`outreachAttemptChannelSent: { LINKEDIN_CONNECT: iso }`)
  so repeating email/WhatsApp later needs no second migration. Phase 1 can ship the scalar and
  document the map as the forward path.
- **Race mode.** `lag = 0` reuses the same array with equal `scheduledAt`; it needs attempt-scoped run
  keys and a rewritten sibling-cancel scope — deliberately deferred, not blocked.
- **A/B angles.** Attempt-level `angle`/`personaOverride` slots into the same record; the prompt change
  is additive (E29/E22).
- **Stage vocabulary stays stable** — the main future-proofing win of D1. No new stage means no
  migrations in the ~6 files that enumerate stages, and the People-table vocabulary the client learned
  keeps working.
- **Derived-cache discipline.** `outreachAttemptInviteDue` is the one denormalisation. It carries a
  reconcile job and a documented derivation so it can never drift into a second source of truth.
- **Known ceiling.** Above ~3 senders the marginal reply rate is dwarfed by the coordination smell and
  invite-quota pressure; the next step there is *differentiated personas*, not more seats. Say so now
  rather than discovering it in production.

## What must not change

- Entry-stage semantics and the trigger filter.
- `outreachSequenceStage` vocabulary (D1).
- `outreachWorkspaceMemberId` remains "current attempt owner": Today/Mine, HITL forms, journey, chat
  persist and reply routing all key off it.
- 1:1 split behaviour when repeat is off — a workspace that never enables repeat must be byte-identical
  in behaviour.
- `force` reassignment of a started candidate stays an explicit, scary action.

## Open decisions

1. **Resolved for this client** — profile is "month 1 / month 2": 30 days, `no_reply`, `keep_open`,
   same follow-up copy. Remaining E6 choice (if the two-requests look turns out to matter):
   `keep_open` · `withdraw` · `inmail`. **Run the `connectionSentAt → firstContactAt` lag distribution
   before revisiting.**
2. Late-accept behaviour after a conversation is locked: `silence` or one hand-off note? (E33 — I'd
   default to the hand-off note, since accepting someone and hearing nothing is the awkward part.)
3. **Answered for this client** — same copy is acceptable (E29 downgraded to S3). Two free mitigations
   stay in phase 0: distinct sender profiles per seat, and the `priorAttempt` prompt input.
4. Ramp policy on enable: cap per day per seat, or let the backlog drain at the pacing limit?
5. Does the second touch reuse the same workspace attachments/videos, or a per-attempt asset set?
6. `no_reply` vs `no_accept` as the handover definition — this determines whether accepted-then-silent
   prospects get a second seat. Recommended: `no_reply`.
