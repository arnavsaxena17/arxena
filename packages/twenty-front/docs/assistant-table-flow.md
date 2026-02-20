# Assistant vs Job Page: Table Flow and Components

## Summary

- **In-context AI (FloatingAIChat / AIChatAssistant)** produces search plans and drives the **job page DataTable** (parameters, filters, sorts, JD). Candidates shown there are loaded by job id; no separate “table” is created by the in-context chat — it configures the existing table.
- **Full-page Assistant (`/assistant`)** uses MCP tools that **create real jobs and candidates** in the DB. The right-hand **Results** panel shows a **read-only snapshot** of the last tool result (jobs or candidates) in a simple table. Same data later appears in the job page DataTable when the user opens that job.

## Do we need different components for `/assistant` or can we reuse?

**Reuse existing components; no need for a second DataTable.**

| Where | Component | Purpose |
|-------|-----------|--------|
| **`/assistant` right results** | **AssistantDetailsTable** (existing) | Read-only preview of last MCP result: generic `columns` + `rows`. Shows jobs list or candidates list. |
| **Job page** | **DataTable** (existing) | Full job-scoped candidate grid: selection, actions, Bot Status, inline edit, right drawer actions. |

Assistant results are a **preview** of what was just created or listed; the job page is where users **work** on candidates. So:

- Keep **AssistantDetailsTable** for Assistant results (already in place).
- Do **not** embed the full **DataTable** on `/assistant` — it expects job context, selection state, and many job-specific hooks.

## How do candidates flow from one surface to the other?

1. **Assistant**  
   User says e.g. “Create job Head of Strategy and add candidates A, B, C.”  
   MCP tools create a **real job** and **real candidate** records (same DB as the rest of the app).

2. **Results panel**  
   Backend sends a `table_data` event with `columns` and `rows` (e.g. job row or candidate rows).  
   Frontend stores this as `lastTableData` and renders it in **AssistantDetailsTable**.  
   This is a **snapshot** for display only; persistence already happened in step 1.

3. **Flow to job page**  
   User clicks **“Open in Jobs”** → goes to jobs list.  
   When the result is job-scoped (e.g. candidates for one job), we can also offer **“View in job”** → navigate to `/job/:jobId`.  
   On the job page, **DataTable** loads candidates for that job from the same DB → same candidates created from Assistant appear there.

So: **one source of truth (DB)**. Assistant creates/updates it; Results panel shows a preview; job page shows the same data in the full table.

## If we get candidates in `/assistant` right results, DataTable or new?

**Use the existing Assistant results table (AssistantDetailsTable), not DataTable.**

- **On `/assistant`:** Keep showing candidates (and jobs) in **AssistantDetailsTable**. It’s generic, read-only, and matches the “last tool result” model.
- **When the user wants to work with those candidates:** Navigate to the job (e.g. “View in job” → `/job/:jobId`). On the job page, the **existing DataTable** loads and shows those same candidates with full actions.

So: **Assistant results = AssistantDetailsTable**. **Job page = DataTable**. No new table component needed.

## Temporary jobs or create new ones?

**Create real jobs and candidates; no temporary jobs in the current design.**

- MCP tools (e.g. `create_job`, `create_candidate`) write to the same DB as the rest of the app.
- `lastTableData` on the thread is only a **cache for the UI** (last tool result). It is not a “temporary job.”
- If you later want a “draft” or “staging” flow (e.g. “Review before adding to job”), that would require new backend support (e.g. draft job or staging candidate entities) and product design; it’s not required for the current flow.

## Optional improvement: “View in job” from Assistant results

When the last result is candidates for a single job, the backend (or frontend) can infer `jobId` (e.g. from `jobId` / `job_id` in the first row). Then:

- Show a **“View in job”** (or “View candidates in job”) action in the Results panel.
- On click, navigate to `getAppPath(AppPath.Job, { jobId })` so the user lands directly on the job page DataTable with those candidates.

“Open in Jobs” can stay as “go to jobs list”; “View in job” closes the loop from Assistant → job page when the result is job-scoped.
