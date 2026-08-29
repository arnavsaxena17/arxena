---
name: gtm-home-e2e-browser
description: >-
  Drives the GTM Command (/gtm-home) happy-path in the Cursor IDE browser:
  new run → Ask AI company search → Companies tab + chat snippet → MD/CEO
  people search → People tab → LinkedIn connection outreach workflow. Use when
  the user asks to test GTM home, demo Ask AI companies/people upsert, verify
  ephemeral Redis tabs, or run LinkedIn outreach from GTM chat.
---

# GTM Home E2E (Cursor browser)

Prefer the **Cursor IDE browser** (visible) over Playwright so the user can
watch. Only fall back to API smoke curls when UI is blocked.

## Preconditions

| Check | How |
| --- | --- |
| Front | `http://arxena.localhost:3001` → 200 |
| Server | `http://arxena.localhost:3000` → 200 |
| Auth | User ACCESS JWT (Bearer). Workspace from JWT `workspaceId` claim |
| Skills synced | `upgrade:2-25:sync-gtm-company-skill-content` + `sync-gtm-people-skill-content` for that workspace |

Default local workspace used in prior runs: `635976bf-1483-4259-8a3b-eed5cd4e87f1`.

If the user pastes an `authorization: Bearer …` header (e.g. from a GraphQL
curl), use that token for API checks and browser auth injection.

### Auth injection (when browser is logged out)

1. Navigate to `http://arxena.localhost:3001/`
2. Lock tab
3. CDP `Runtime.evaluate`:

```js
localStorage.setItem(
  'tokenPairState',
  JSON.stringify({
    accessOrWorkspaceAgnosticToken: { token: '<ACCESS_JWT>' },
  }),
);
location.href = 'http://arxena.localhost:3001/gtm-home';
```

Key is `tokenPairState` (see `TOKEN_PAIR_LOCAL_STORAGE_KEY`). Reuse an existing
logged-in session if `/gtm-home` already renders.

## Product path under test

| Layer | Companies | People |
| --- | --- | --- |
| Ephemeral | Redis `upsert_gtm_target_companies` | Redis `upsert_gtm_target_people` |
| UI | Companies tab (poll ~5s) | People tab (poll + merge CRM) |
| CRM | Only on enroll / Add to CRM | Only on enroll / Add to CRM |

Do **not** expect `create_candidate` during discovery. Agent must call the
upsert tools with `projectId` from GTM browsing context.

## Browser workflow

Copy and tick:

```
GTM E2E:
- [ ] 0 Setup (health + auth + /gtm-home)
- [ ] 1 New project + company search → Companies tab
- [ ] 2 MD/CEO for first 3 companies → People tab
- [ ] 3 LinkedIn connection outreach workflow
```

Show the browser: `browser_navigate` / `browser_tabs` with `position: "active"`.

### Step 0 — Setup

1. `browser_tabs` list; open/reuse front tab with `position: "active"`.
2. Go to `http://arxena.localhost:3001/gtm-home` (inject token if needed).
3. Snapshot: PageHeader **GTM Command**, tabs Companies / People / Workflow.
4. Note `projectId` from URL (`?projectId=`).

### Step 1 — Companies discovery

1. Click **New project** (creates Project; URL gains new `projectId`).
2. Ask AI right drawer opens with ICP preprompt — clear/replace composer text.
3. Send exactly (or close equivalent):

> Give me textile manufacturing companies from india

4. Wait for agent tools (search + `upsert_gtm_target_companies`). Poll up to
   ~2–3 minutes; snapshot chat + Companies tab every ~15–20s.
5. **PASS when:**
   - Chat shows a small companies snippet / table preview
   - Companies tab datatable has rows (typically ≥3)
   - Optional: click chat snippet → focuses/shows Companies tab full table
6. Confirm Redis (optional):

```bash
curl -s "http://arxena.localhost:3000/gtm-command/cache/companies?projectId=<PROJECT_ID>" \
  -H "authorization: Bearer <TOKEN>"
```

### Step 2 — People (MD/CEO) for first 3 companies

Same chat thread. Send:

> Find MD/CEOs for the first 3 companies in the Companies table. Use the
> company list from this GTM project as context. Resolve MD/CEO titles (boolean
> query from Python if needed), then search each company via Unipile/LinkedIn.
> Upsert results into the GTM People tab — do not create CRM candidates yet.

Expected agent path:

1. Read GTM browsing context (companies in table / `projectId`)
2. Resolve title → boolean (Python / search-people / linkedin-search skill)
3. Unipile LinkedIn search per company (limit 3 companies)
4. `upsert_gtm_target_people({ projectId, mode: "merge", people })`

**PASS when:** People tab shows names for those companies (ephemeral rows;
not necessarily CRM Candidates). Verify Redis:

```bash
curl -s "http://arxena.localhost:3000/gtm-command/cache/people?projectId=<PROJECT_ID>" \
  -H "authorization: Bearer <TOKEN>"
```

### Step 3 — LinkedIn connection outreach

Same chat. Send:

> Start outreach with a LinkedIn connection workflow for these people. Create
> the workflow if it does not exist, then start it manually for each candidate
> so a connection request is sent.

Expected:

- Prefer / create **`GTM Outreach — Per Candidate`** (`GTM_OUTREACH_WORKFLOW_B_NAME`)
- Bind `Project.outreachWorkflowId` if missing
- Enroll / queue people → workflow runs send LinkedIn connection (Unipile)

**PASS when:** Workflow tab shows the outreach workflow (or run), and at least
one candidate is queued / connection step started. If Unipile LinkedIn is
disconnected, report **Needs connection** banner and stop (not a product fail
of the chat routing).

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
  people skill sync and ensure `upsert_gtm_target_people` is registered.

## Report format

```markdown
## GTM E2E result
- Step 1 Companies: PASS/FAIL — <n> rows, snippet Y/N, projectId=
- Step 2 People: PASS/FAIL — <n> people, tool used=
- Step 3 Outreach: PASS/FAIL — workflow= , runs=
- Blockers: <none | …>
```

Take screenshots at each PASS gate (`take_screenshot_afterwards` or
`browser_take_screenshot`).

## Related code

- Front: `packages/twenty-front/src/modules/gtm-home/`
- Tools: `upsert-gtm-target-companies-tool.ts`, `upsert-gtm-target-people-tool.ts`
- Skills: `search-companies.md`, `search-people.md`, `linkedin-search.md`,
  `gtm-icp-onboarding.md`
- README: `packages/twenty-front/src/modules/gtm-home/README.md`
