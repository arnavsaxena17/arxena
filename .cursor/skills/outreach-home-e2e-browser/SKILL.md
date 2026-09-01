---
name: outreach-home-e2e-browser
description: >-
  Drives Outreach (/outreach-home) in the Cursor IDE browser on arxena-4:
  discovery happy-path, start campaign (Enroll + Live), pause/resume outreach,
  and A/B Publish as experiment on Per Enrolled Candidate workflow. Use when
  testing Outreach home controls, pause/resume, or A/B experiments.
---

# Outreach Home E2E (Cursor browser)

Prefer the **Cursor IDE browser** (visible) over Playwright so the user can
watch. Only fall back to API smoke curls when UI is blocked.

## Legacy GTM → Outreach (renamed)

The product surface formerly called **GTM Command** at `/gtm-home` is now
**Outreach** at `/outreach-home`. Key renames from the migration wave
(workspace cmds `0074`–`0080`, front module rename):

| Old (GTM) | Current (Outreach) |
| --- | --- |
| `/gtm-home` | `/outreach-home` |
| PageHeader **GTM Command** | PageHeader **Outreach** |
| `gtm-home/*` module | `outreach-home/*` |
| `upsert_gtm_target_companies` | `upsert_outreach_target_companies` |
| `upsert_gtm_target_people` | `upsert_outreach_target_people` |
| `GTM Outreach — Per Candidate` | `Outreach — Per Enrolled Candidate` |
| `GTM_OUTREACH_WORKFLOW_B_NAME` | `OUTREACH_WORKFLOW_B_NAME` |
| `gtm_project_paused` | `outreach_project_paused` |
| `gtm_send_window` | `outreach_send_window` |
| Dashboard title **GTM Command** | Dashboard title **Outreach** |
| `createGtmProject` | `createOutreachProject` |

Skill IDs and some upgrade command names still use `gtm-*` prefixes internally
(e.g. `gtm-icp-onboarding`, `sync-gtm-people-skill-content`); UI and tools use
Outreach naming.

## Preconditions

| Check | How |
| --- | --- |
| Front | `http://arxena-4.localhost:3001` → 200 (legacy: `arxena.localhost:3001`) |
| Server | `http://arxena-4.localhost:3000` → 200 |
| Auth | User ACCESS JWT (Bearer). Workspace from JWT `workspaceId` claim |
| Skills synced | `upgrade:2-25:sync-outreach-company-skill-content` + `sync-gtm-people-skill-content` for that workspace |
| Per Enrolled Candidate workflow | Bound on Project or open Workflow tab; for A/B authoring use the project's `outreachWorkflowId` (example local ws: `6b606456-4e40-556f-aae0-1efddac1b0b7`) |

Default local workspace used in prior runs: `635976bf-1483-4259-8a3b-eed5cd4e87f1`.

If the user pastes an `authorization: Bearer …` header (e.g. from a GraphQL
curl), use that token for API checks and browser auth injection.

### Auth injection (when browser is logged out)

1. Navigate to `http://arxena-4.localhost:3001/`
2. Lock tab
3. CDP `Runtime.evaluate`:

```js
localStorage.setItem(
  'tokenPairState',
  JSON.stringify({
    accessOrWorkspaceAgnosticToken: { token: '<ACCESS_JWT>' },
  }),
);
location.href = 'http://arxena-4.localhost:3001/outreach-home';
```

Key is `tokenPairState` (see `TOKEN_PAIR_LOCAL_STORAGE_KEY`). Reuse an existing
logged-in session if `/outreach-home` already renders.

## Product path under test

| Layer | Companies | People |
| --- | --- | --- |
| Ephemeral | Redis `upsert_outreach_target_companies` | Redis `upsert_outreach_target_people` |
| UI | Companies tab (poll ~5s) | People tab (poll + merge CRM) |
| CRM | Only on enroll / Add to CRM | Only on enroll / Add to CRM |

Do **not** expect `create_candidate` during discovery. Agent must call the
upsert tools with `projectId` from Outreach browsing context.

## Browser workflow

Copy and tick:

```
Outreach E2E:
- [ ] 0 Setup (health + auth + /outreach-home)
- [ ] 1 New project + company search → Companies tab
- [ ] 2 MD/CEO for first 3 companies → People tab
- [ ] 3 LinkedIn connection outreach workflow
- [ ] 4 Start campaign (Enroll + Live chip)
- [ ] 5 Pause / resume campaign
- [ ] 6 A/B experiment on Per Enrolled Candidate workflow
```

Show the browser: `browser_navigate` / `browser_tabs` with `position: "active"`.

### Step 0 — Setup

1. `browser_tabs` list; open/reuse front tab with `position: "active"`.
2. Go to `http://arxena-4.localhost:3001/outreach-home` (inject token if needed).
3. Snapshot: PageHeader **Outreach**, tabs Setup / Companies / People / Workflow.
4. Note `projectId` from URL (`?projectId=`).

### Step 1 — Companies discovery

1. Menu → **Add New Project** (creates Project; URL gains new `projectId`).
2. Ask AI right drawer opens with ICP preprompt — clear/replace composer text.
3. Send exactly (or close equivalent):

> Give me textile manufacturing companies from india

4. Wait for agent tools (search + `upsert_outreach_target_companies`). Poll up to
   ~2–3 minutes; snapshot chat + Companies tab every ~15–20s.
5. **PASS when:**
   - Chat shows a small companies snippet / table preview
   - Companies tab datatable has rows (typically ≥3)
   - Optional: click chat snippet → focuses/shows Companies tab full table
6. Confirm Redis (optional):

```bash
curl -s "http://arxena-4.localhost:3000/outreach-command/cache/companies?projectId=<PROJECT_ID>" \
  -H "authorization: Bearer <TOKEN>"
```

### Step 2 — People (MD/CEO) for first 3 companies

Same chat thread. Send:

> Find MD/CEOs for the first 3 companies in the Companies table. Use the
> company list from this Outreach project as context. Resolve MD/CEO titles
> (boolean query from Python if needed), then search each company via
> Unipile/LinkedIn. Upsert results into the Outreach People tab — do not create
> CRM candidates yet.

Expected agent path:

1. Read Outreach browsing context (companies in table / `projectId`)
2. Resolve title → boolean (Python / search-people / linkedin-search skill)
3. Unipile LinkedIn search per company (limit 3 companies)
4. `upsert_outreach_target_people({ projectId, mode: "merge", people })`

**PASS when:** People tab shows names for those companies (ephemeral rows;
not necessarily CRM Candidates). Verify Redis:

```bash
curl -s "http://arxena-4.localhost:3000/outreach-command/cache/people?projectId=<PROJECT_ID>" \
  -H "authorization: Bearer <TOKEN>"
```

### Step 3 — LinkedIn connection outreach

Same chat. Send:

> Start outreach with a LinkedIn connection workflow for these people. Create
> the workflow if it does not exist, then start it manually for each candidate
> so a connection request is sent.

Expected:

- Prefer / create **`Outreach — Per Enrolled Candidate`** (`OUTREACH_WORKFLOW_B_NAME`)
- Bind `Project.outreachWorkflowId` if missing
- Enroll / queue people → workflow runs send LinkedIn connection (Unipile)

**PASS when:** Workflow tab shows the outreach workflow (or run), and at least
one candidate is queued / connection step started. If Unipile LinkedIn is
disconnected, report **Needs connection** banner and stop (not a product fail
of the chat routing).

### Step 4 — Start campaign (`outreach-start-campaign`)

Maps to Enroll + Live (not a separate “Start” control).

1. Open `/outreach-home`, note `projectId`. Chip **Live** (or Resume first if leftover **Paused**).
2. People tab: select ≥1 row → **Enroll in outreach**.
3. Workflow tab: Per Enrolled Candidate bound; at least one run `RUNNING` / pending send.

**PASS:** candidate `QUEUED` or `CONNECTION_SENT`; header Live; a workflow run exists for that candidate. Outside send window is still PASS if the run is pending `outreach_send_window`.

### Step 5 — Pause campaign (`outreach-pause-campaign`)

Depends on start (or an already-live project).

1. Header **Pause outreach** → chip **Paused**.
2. Assert no new outbound: pending send stays `PENDING` / `outreach_project_paused`; ghosts for those runs released.
3. Optional: enroll another person while paused → run parks, no send.
4. **Resume outreach** → chip **Live**; capacity waits retry immediately (`retryPendingStep`, delay 0) and pick up **current** window/limits.

**PASS:** no send while paused; after resume, either a send attempt or a **new** `waitMs`/`scheduledAt` (not the pre-pause timer). Do not fail if Unipile is disconnected — assert **Needs connection** / parked run instead.

### Step 6 — A/B test (`outreach-ab-test`)

Author on the **project-bound** Per Enrolled Candidate workflow record, then
operate from Outreach Home.

1. Open the workflow at `/object/workflow/<outreachWorkflowId>` (or the
   Workflow tab embed). **Use as draft**, change connection note (or opener),
   **Publish as experiment**. Header: Active A + Experiment B · 50/50.
2. Outreach Home People: enroll enough people (aim ≥4) so both letters appear.
3. People Variant column and/or Workflow Runs Version: mix of A and B.
4. CRM dashboard → **Outreach** → **Experiments**: A vs B KPIs or grouped bars have counts.

**PASS:** B is `EXPERIMENT` without archiving A; at least one candidate A and one B; dashboard (or Runs) shows both arms. Company-search A/B is out of scope.

## Waiting / interaction rules

- Lock before interactions; unlock when done with the browser turn.
- After sending chat, do **not** spam clicks — poll snapshots / Redis.
- Ask AI turns are slow (tool loops). Prefer 15–30s waits between checks.
- If upsert fails with `isNonEmptyString is not a function`, the tool must import
  from `@sniptt/guards` (not `twenty-shared/utils`).
- If `execute_tool` fails with `expected record, received undefined`, the model
  flattened/aliased args — fixed in `coerceExecuteToolArguments` (flatten lift,
  `parameters`/`args`/`input` aliases, double-string parse). Restart/watch server
  if the util change is not yet loaded.
- If People appear only as CRM Candidates, prompts/skills are stale — re-run
  people skill sync and ensure `upsert_outreach_target_people` is registered.

## Report format

```markdown
## Outreach E2E result
- Step 1 Companies: PASS/FAIL — <n> rows, snippet Y/N, projectId=
- Step 2 People: PASS/FAIL — <n> people, tool used=
- Step 3 Outreach: PASS/FAIL — workflow= , runs=
- Step 4 Start campaign: PASS/FAIL — Live chip, enrolled=
- Step 5 Pause/resume: PASS/FAIL — paused parks, resume recomputes=
- Step 6 A/B: PASS/FAIL — variants A/B seen, Experiments tab=
- Blockers: <none | …>
```

Take screenshots at each PASS gate (`take_screenshot_afterwards` or
`browser_take_screenshot`).

## Related code

- Front: `packages/twenty-front/src/modules/outreach-home/`
- Tools: `upsert-outreach-target-companies-tool.ts`, `upsert-outreach-target-people-tool.ts`
- Skills: `search` (parts: `search-preamble.md`, `search-companies.md`, `search-people.md`, `search-linkedin-harvest.md`), `setup` (Outreach ICP intent)
- README: `packages/twenty-front/src/modules/outreach-home/README.md`
