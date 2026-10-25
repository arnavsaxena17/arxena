# Autonomous recruiter & sales agent — current state and plan

Planning doc for running long-lived sales and recruiting from Ask AI, over CRM + workflows. Captures where we are, what we intend to add, and how pieces fit.

Related: [`outreach-sequencer-overview.md`](./outreach-sequencer-overview.md), [`SOURCING_SKILLS.md`](../packages/twenty-server/docs/SOURCING_SKILLS.md), talent-search harness notes (external plan: Mandate / evidence / gates).

---

## 1. North star

One Ask AI surface can own:

- **Sales:** list building → multi-channel outreach → appointment setting → opportunity.
- **Recruiting:** search → outreach → screen → client process → offer → join / onboard.

Ask AI **decides and configures**. Workflows **execute multi-day cadences**. CRM is the **ledger**. Scheduled **Mission wakes** re-enter Ask AI for judgment; a **heartbeat** only catches overdue / dry work.

---

## 2. Where we are today

### 2.1 Ask AI harness

| Capability | Status |
| --- | --- |
| Streaming agent turns (BullMQ job, max ~300 tool steps) | Live |
| Skills as markdown playbooks (`load_skills`) | Live (sourcing, outreach, workflow-building, …) |
| Tools: CRM CRUD, Find/sourcing providers, calendar/email, LinkedIn, `run_workflow` | Live |
| Pause for human answers (`ask_questions` → resume) | Live |
| Durable sleep / “wake me Monday” / Mission object | **Missing** |
| Code interpreter for bulk ETL in one turn | Live (not for timers) |

Ask AI is **turn-based**, not a durable process. Holding a worker asleep for days is not supported.

### 2.2 Workflows (seeded)

| Workflow | Trigger | Role |
| --- | --- | --- |
| Find companies / Find people by company / Find people by search | WEBHOOK (`run_workflow`) | Search → AI filter → upsert / enroll |
| Add people | MANUAL | Ad-hoc enroll |
| Harvest-style company CRON (recipe / Project harvest) | CRON | Weekly-style company supply into CRM |
| company.created → ICP people (recipe) | DATABASE_EVENT | Company-first enroll |
| **Outreach — Candidate Sequencer** | `candidate.upserted` | QUEUED → connect / warm / email → reply → **MEETING_BOOKED** (reminder + no-show) |

Obsolete split graphs (Reply / Meeting Booked / Negotiating as separate WFs) were merged into the Sequencer or deactivated.

**Timing today:** workflow `DELAY` (duration / random / scheduled date), FORM HITL, send windows, rate-limit deferral. No native wait-until-event (use a second event-triggered workflow).

### 2.3 Domain objects

| Object | Status |
| --- | --- |
| Project (role / campaign) | Live |
| Person / Company | Live |
| Candidate (+ recruiting `status`, outreach `outreachSequenceStage`) | Live |
| Opportunity | Live (sales) |
| chatMessage / messaging | Live |
| Calendar create + availability LF | Live |
| Offer / Joined / employee Onboarding | **Missing or thin** |
| Mission / agent wake entity | **Missing** |
| Live interview-meeting object | Partial / commented in metadata |

### 2.4 Recruiting `candidate.status` (today)

From UI labels (`candidate-status-labels.ts`):

`NOT_INTERESTED` → `INTERESTED` → `CV_RECEIVED` → `NOT_FIT` → `SCREENING` → `RECRUITER_INTERVIEW` → `CV_SENT` → `CLIENT_INTERVIEW` → `NEGOTIATION`

Ladder **stops at negotiation** — no first-class `OFFER` / `JOINED` / onboarding status in that set.

### 2.5 Outreach stages (Sequencer)

Owned by **`outreachSequenceStage`** (not recruiting status): QUEUED → connection / warm / channel sends → WAITING_REPLY / REPLIED → MEETING_BOOKED → STOPPED / failures / DEFERRED (defer handled without separate sequencer branches).

Inbound reply classify is a **silence-window flush** (not a workflow); it stamps cadence + conversation stage and re-enters the Sequencer.

### 2.6 Autonomous recruiter heartbeat (prototype)

| | |
| --- | --- |
| Path | `autonomous-recruiter` cron → MCP assistant on thread `"Autonomous"` |
| Frequency | Every **15 minutes** |
| Status | **`CRON_DISABLED = true`** |
| Behavior | `get_pending_recruiter_actions` + notes → **1–2** actions |

Not wired to Ask AI Mission wakes. Treat as a pattern to generalize, not the production clock.

### 2.7 Strengths vs gaps

**Strong through:** sourcing → enroll → Sequencer → meeting (sales appointment path).
**Weak after:** screening → CV → interview ops → offer → join → onboard; durable Ask AI restarts; versioned mandate / evidence ledger (talent-harness doc).

---

## 3. Where we are planning to go

### 3.1 Mental model

```text
Ask AI (orchestrator)
  → refill policy + run_workflow / sourcing tools
  → enroll + startOutreach
  → Candidate Sequencer          (top-of-funnel, sales + recruiting)
  → Recruiting Candidate Journey (mid/late recruiting)     [to build]
  → Mission wakes                (judgment / dry pipeline / reminders) [to build]
  → Heartbeat                    (overdue / dry safety net)            [enable + generalize]
```

| Driver | Job |
| --- | --- |
| **Workflows** | Same path every time; DELAY; FORM; rate limits; fan-out per candidate |
| **Ask AI + Mission wake** | JD parse, search plan, spend, dry refill judgment, exceptions, client feedback |
| **Heartbeat** | Find overdue wakes / dry projects with no wake — **enqueue**, don’t replace sequencers |
| **CRM** | Authoritative stages and facts |

**Do not** make heartbeat the engine that advances every candidate. Sequencer/Journey DELAY and Mission `wakeAt` are the clocks.

### 3.2 Unified pipeline refill (sales + recruiting together)

One **refill** feature on Project / Mission — not two search products:

| Policy | Typical use |
| --- | --- |
| `schedule` | Sales / GTM: new companies every week (CRON → same Find / Mandate Run) |
| `demand` | Recruiting: search when active pipeline &lt; floor |
| `both` | Volume hiring / hybrid |

Same Find workflows and sourcing skills; only the **signal** (calendar vs dryness) changes.

---

## 4. Workflows to create / keep

### 4.1 Keep / reuse (do not rebuild)

- Find companies / people (webhook) + optional harvest CRON
- company.created → people (when company-first)
- **Outreach — Candidate Sequencer** (sales and recruiting top-of-funnel)

### 4.2 Create — primary spines

| Workflow | Trigger | Owns |
| --- | --- | --- |
| **Search — Mandate Run** (compose Find + gates) | WEBHOOK / Manual / refill callers | Brief → retrieve → score → shortlist / enroll gate |
| **Recruiting — Candidate Journey** | `candidate` status / recruiting flag upsert | Post-interest / post-meeting → join |

### 4.3 Create — Journey internals (branches or small companion graphs)

Prefer **one Journey graph** with IF_ELSE on `status` (Sequencer pattern). Optional thin companions only if needed:

| Concern | Behavior |
| --- | --- |
| Post-meeting → Screening | Set `SCREENING`, disposition FORM |
| Screening → Shortlist / Not fit | HITL or rules |
| Shortlist → CV Sent | Pack + notify HM; `CV_SENT` |
| CV feedback chase | DELAY → nudge HM |
| Interview schedule + T−24h | Calendar + reminder (recruiting copy) |
| Interview outcome | FORM → advance / hold / drop |
| Offer loop | After Offer object exists |
| Pre-join / onboarding | Checklist + T−7 / T−3 / T−1 |
| Stale sweeper (optional) | CRON: stuck in stage &gt; N days |

### 4.4 Cron-repeat workflows

| Cron | When |
| --- | --- |
| Harvest / Find companies on schedule | Project `refillPolicy` includes `schedule` (sales default) |
| Pipeline-health detector (optional) | Daily: mark dry or enqueue Mission wake (recruiting) |
| Heartbeat (~15m) | Workspace: overdue Mission wakes + dry without wake |
| Stale-candidate sweeper | Optional ops |

Recruiting roles often **omit** weekly harvest and rely on **demand** refill only.

### 4.5 Explicitly not new workflows

- Second LinkedIn sequencer “for recruiting”
- NEGOTIATING / DEFERRED as Sequencer branches (skill forbids; use Journey / CRM)
- Webhook-only HITL graphs
- Agent-polled “is it Monday?” instead of CRON / `wakeAt`

---

## 5. How the agent keeps state

### 5.1 Three tiers

| Tier | Contents | Writer |
| --- | --- | --- |
| **CRM** | Project, Candidate `status`, `outreachSequenceStage`, Person/Company, messages, calendar, Opportunity | Workflows + tools (source of truth) |
| **Mission** *(new)* | Goal, stage, `projectId`, `threadId`, `wakeAt`, `nextAction`, `refillPolicy`, status | Ask AI tools + wake worker |
| **Thread / notes** | Scratch, user prefs in chat, `append_agent_note` | Agent (non-authoritative) |

On every wake: **re-read CRM by id** (workflow context is a snapshot). Update Mission after 1–2 actions; schedule next `wakeAt` or complete.

### 5.2 Mission wake (planned)

- Tool: `schedule_agent_wake` / `cancel_agent_wake`
- Implementation: Bull delayed job → resume Ask AI turn with system reason (`pipeline_dry`, `pre_meeting_reminder`, `weekend_restart`, …)
- Parallelism: many Missions / Projects; per-Mission lock to avoid double-send
- Heartbeat: `list_due_missions` safety net

### 5.3 Planned Mission / process stages (agent-facing)

High-level Mission stages (orthogonal to candidate outreach status):

| Mission stage | Meaning |
| --- | --- |
| `SETUP` | Mandate / JD / ICP |
| `REFILL` | Search / Find in progress or due |
| `OUTREACH_ACTIVE` | Sequencer running on pool |
| `PIPELINE_ACTIVE` | Journey / mid-funnel (recruiting) |
| `CLIENT_LOOP` | Shortlist / feedback / re-score |
| `CLOSING` | Offer / join |
| `PAUSED` / `BLOCKED` | Human or budget gate |
| `COMPLETED` | Role filled / campaign stopped |

---

## 6. States by domain

### 6.1 Sales (appointment setting)

**Company funnel (illustrative):** ADDED → REACHED → COVERED → REPLIED → MEETING_BOOKED → MEETING_HELD → OPPORTUNITY

**Person / candidate outreach:** Sequencer stages through MEETING_BOOKED

**After meeting:** Opportunity CRM (amount, stage) — thin today; deepen as needed

### 6.2 Recruiting (candidate)

**Outreach (shared Sequencer):** same as sales top-of-funnel

**Pipeline (`status`) — today + planned extensions:**

| Status | Role |
| --- | --- |
| SOURCED / QUEUED (via outreach flags) | In search or outreach |
| INTERESTED / CV_RECEIVED | Early signal |
| SCREENING | Recruiter screen |
| NOT_FIT / NOT_INTERESTED | Exits |
| RECRUITER_INTERVIEW | Internal interview |
| CV_SENT | With client |
| CLIENT_INTERVIEW | Client rounds |
| NEGOTIATION | Comp / terms |
| **OFFER** *(add)* | Offer out |
| **OFFER_ACCEPTED** / **JOINED** *(add)* | Accepted / started |
| **ONBOARDING** *(add or checklist object)* | Pre/post join tasks |

**Park / drop:** use status + remarks / Journey exits; revive on mandate change via Ask AI re-score (talent-harness idea).

### 6.3 Offer types (recruiting — planned)

Model as Offer records (or structured fields) gated before send:

| Kind | Notes |
| --- | --- |
| Full-time | Base + variable + equity as applicable |
| Contract / freelance | Rate, duration, notice |
| Retained / contingency placement | Fee terms with client (agency) |
| Internal transfer | Different approval path |

Each offer: terms, both-side interest signals, competing-offer risk, human **offer gate** (align with talent-harness gates.yaml idea). Journey advances only after approved send / accept events.

---

## 7. How processes run: sales vs recruiting

### 7.1 Shared strip

```text
Project + refill policy
  → Search / Find (agent or CRON or dry-wake)
  → enroll + startOutreach
  → Candidate Sequencer
```

### 7.2 Sales activities

| Activity | Mechanism |
| --- | --- |
| Weekly new companies | `refillPolicy=schedule` → CRON → Find companies → people → enroll |
| One-off list build | Ask AI + sourcing → Save CRM → enroll |
| Messaging / book meeting | Sequencer (+ inbound classify) |
| Pre-meeting bump | Sequencer MEETING_BOOKED branch (exists) |
| Opportunity after meeting | CRM update; optional light WF later |
| Agent decisions | ICP, spend, when to start/stop, exception replies |

### 7.3 Recruiting activities

| Activity | Mechanism |
| --- | --- |
| JD in | Ask AI → Project / mandate items |
| Initial search | Ask AI → Mandate Run / Find → enroll |
| Top-of-funnel outreach | **Same Sequencer** |
| Mid-funnel | **Candidate Journey** on `status` |
| Pipeline dry | Mission wake `pipeline_dry` → Ask AI → Find again |
| Client shortlist / feedback | FORM + Ask AI; mandate bump → re-rank (planned) |
| Interview / offer / join | Journey + gates + domain objects |
| Agent decisions | Search plan, dry refill, disposition exceptions, offer draft, client politics |

### 7.4 Search methodologies (both verticals)

| Method | When |
| --- | --- |
| People-first Find (title / geo / NL) | Default recruiting; many sales roles |
| Company-first → people at company | Account-based / peer targets |
| Judged / scored list + AI filter | Quality over volume |
| Org-chart / role-at-company | Mapped accounts |
| Local business / maps grid | Geo outlet GTM (existing LFs) |
| Passive vs active | Same pipeline; different first-touch (Sequencer vs inbound) |

Hard constraints → structured filters where possible; LLM judges soft fit (talent-harness principle). Enrich only when it can change advance/park/drop.

---

## 8. End-to-end call order (recruiting example)

```text
1. Client JD          → Ask AI (SETUP Mission)
2. Search             → Ask AI + Find / Mandate Run (webhook)
3. Enroll + start     → tools / UI
4. Outreach           → Candidate Sequencer (events + DELAY)
5. Reply / meeting    → classify + Sequencer branches
6. Screen → … → nego  → Recruiting Journey (status + FORM + DELAY)
7. Dry pipeline?      → Mission wake → Ask AI → Find again
8. Offer → join       → Journey + offer gate (+ domain)
9. Heartbeat          → only enqueue missed wakes / dry flags
```

Sales stops or branches at meeting → Opportunity; refill leans **schedule** CRON instead of dry wakes.

---

## 9. What we will add (build backlog)

### Phase A — Harness

- [ ] Mission entity (or equivalent) + `schedule_agent_wake` / cancel
- [ ] Wake resume into Ask AI with reason + 1–2 action contract
- [ ] Generalize / enable heartbeat as `list_due_missions` + dry detection
- [ ] Skills: `mission-control`, refill policy docs in sourcing/outreach

### Phase B — Search spine

- [ ] Search — Mandate Run (compose Find + spend/shortlist gates)
- [ ] Project `refillPolicy`: schedule | demand | both
- [ ] Wire CRON and dry-wake to the **same** run path

### Phase C — Recruiting Journey

- [ ] Seed **Recruiting — Candidate Journey** workflow
- [ ] Handoff from Sequencer (MEETING_BOOKED / INTERESTED → Journey)
- [ ] FORM + DELAY branches for screen / CV / interview
- [ ] Extend statuses: OFFER / JOINED (+ onboarding checklist)
- [ ] Offer object + offer gate

### Phase D — Quality loop (from talent-harness, incremental)

- [ ] Versioned mandate items (hard/soft/learned) on Project
- [ ] Evidence / score citations (fit + interest) where ROI is clear
- [ ] Client feedback → mandate version → re-score pool
- [ ] Evals / gold sets for search quality (later)

### Phase E — Sales polish

- [ ] Keep Sequencer as primary; Mission wake for post-meeting / no-show judgment if needed
- [ ] Opportunity progression automation as needed

---

## 10. Principles (short)

1. **Sequencers for boring frequent paths; agents for judgment.**
2. **One refill subsystem; policy differs by Project.**
3. **CRM is truth; Mission is the timer + intent; chat is scratch.**
4. **Heartbeat enqueues; it does not replace DELAY or Sequencer.**
5. **Don’t clone Sequencer for recruiting — add Journey on `status`.**
6. **Parallel Projects/Missions;** shared rate limits and budgets only.

---

## 11. Doc history

| Date | Note |
| --- | --- |
| 2026-10-25 | Initial plan from Ask AI / workflows / Mission / Journey design discussion |
