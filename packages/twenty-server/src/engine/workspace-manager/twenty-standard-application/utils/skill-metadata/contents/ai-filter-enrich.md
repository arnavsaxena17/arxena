---
description: |-
  Add an AI-computed column (filter or enrichment) to the project people / companies: preview on ~10 rows, confirm, then run for all
priority: 40
routes:
  - when: |-
      Filter / classify / enrich the people or companies in the list ("who is a CEO", "revenue of each", "employees in each")
    hint: |-
      . Never re-search or page `find_many_*` for the list; the skill reads the project working set. On the People tab this is always a person column, also for questions about their companies (revenue, headcount, industry). Apply a table filter or sort only when the user asks to narrow or order the rows ("only the CEOs", "biggest first"); a plain question about data needs none.
  - when: |-
      Preview / draft the first LinkedIn message (opener) the people in the list would get once their connection request is accepted ("sample first message for each", "what would we send them after they accept")
    hint: |-
      . Do not look for a workflow template or enrolled candidates; list rows need no enrollment. The skill's "Sample LinkedIn message" section uses `preview_sample_message_column`; nothing is sent.
---
# AI Filter & Enrich Skill

Use this skill when the user wants to **filter, classify, or enrich the people or companies they are already looking at** by adding an AI-computed column. Examples:

- "filter these names in terms of who is a CEO"
- "what are the revenues of each of these companies"
- "number of employees in each company in the list"
- "mark which of these are in fintech", "what department is each person in"

Do **not** use `search` to re-source the list, and do **not** page through `find_many_*` to read it. The list the user means is the **project working set**. Do **not** design the column's data types yourself: the server does that with the AI filtering design call.

## Flow (always in this order)

1. **Scope = the tab the user is on.** The browsing context has `activeTab` (people when it is missing).
   - **People tab:** "these / the list / each" means the **people**: `subject: "person"` and `tab: "people"` everywhere. Questions about the people's **companies** ("revenues of each of these companies", "employees in each company", "which are in fintech") are still person columns about the person's **employer**; the server handles that. Do not switch to `subject: "company"` and do not ask where the companies come from.
   - **Companies tab:** "these / each" means the **companies** of the project: `subject: "company"` and `tab: "companies"`. The rows are the CRM companies tagged to the project plus the ephemeral Find list, merged. A company question here is a company column, with the same preview, run and filter/sort steps.
2. **Check what already exists first.** Call `get_outreach_working_set({ projectId, subject, limit: 1 })`: its `aiColumns` lists the AI columns already on the table (key, label, type, how many rows are filled). If the data the user wants is already there (an "Is CEO" column for "who is a CEO", an employee-count column for "companies over 500 employees"), **reuse it**: do not preview or run a new column (it costs money); go straight to the filter/sort step. Only add a column when nothing existing answers the request. **To count or to choose a cut-off, never page rows**: call `get_outreach_working_set({ projectId, subject, limit: 1, summarize: ["brandCategory", "employeesOnLinkedin"], onlyViewMatches: true })`. It returns value counts (yes/no and label columns) or min, quartiles and max (number columns) over ALL rows, or only the rows of the applied view with `onlyViewMatches`. Use the keys listed in `aiColumns` and the row fields (name, domain, industry, employees, or any otherFields key). Beyond that, look at a page of rows only if you need to see them, never everything: `get_outreach_working_set({ projectId, subject, limit: 10 })`. It merges the ephemeral Find list on the project with the CRM people attached to it and returns `total`, `rows` and a `cursor`. Never fetch more than the page you need.
3. **Preview on ~10 rows with the user's own words**: `preview_ai_column({ projectId, subject, description: "<what the user asked, in their words>" })`. The server designs the column with the AI filtering design call: the column name, the **typed fields** (`boolean`, `integer`, `number`, `enum` with ordered values, `text`), the prompt, which row fields the model reads, and the model (jev for decisions the row can answer, web search for facts that are not on the row). Pass `filter` only when the user asks for a specific design.
   Show the user: the column name(s) **with their types** (and enum values), the 10 results as a small table, the model that ran (`usage.engine`, `usage.model`), tokens and the estimated cost of the full run. If `typeWarnings` is not empty, say what it says and call `preview_ai_column` again with a more specific `description` (for example "revenue as a number in USD" or "company size as one of 1-50, 51-200, 201-1000, 1000+").
4. **Ask before running on everything**: end the turn with `ask_questions` — "Run for all {total} rows (~$X)?" — options: Run for all / Adjust the column / Cancel. Do not run on all rows without the answer.
   **Exception: pre-approved list build.** When the user already approved an enrichment cap for a list build (see **Build a target list** in the `search` skill), skip this question if the preview's estimated cost fits inside the remaining cap, and run straight away. Ask only when the cost would exceed it.
5. **Run for all**: `run_ai_column({ projectId, subject, previewId })` (add `onlyViewMatches: true` to run only the rows that match the filters of the currently applied table view, so rows an earlier filter ruled out are not paid for) using the `previewId` from the preview. It starts a **background job** on the AI filtering queue and fills the column in chunks: answers are written into each row's `otherFields` under the column key (ephemeral list and CRM), values appear in the People table as they land, and a progress bar shows above the table. The tool waits up to ~45 seconds. If it returns `status: "running"`, tell the user the column keeps filling in the background (progress is above the table), give them `done/total`, and check later with `get_ai_column_run_status({ runId })`; `cancel_ai_column_run({ runId })` stops it and keeps the filled rows. Only one column runs per project at a time.
   If rows failed (rate limit etc.), call `run_ai_column` again with the **same** `previewId`: it skips rows that are already answered, so only the failed rows are retried and paid for. Failed rows show a red "Failed" tag in the table (an empty cell means not run yet, "unknown" or an empty number means no credible answer was found). Pass `rerunAll: true` only when the user wants every row recomputed. The previewId lasts one hour; after that, preview again.
6. **Report**: the new column name(s) and types, rows answered / failed, the engine and model that ran, tokens and cost from `usage` (`inputTokens`, `outputTokens`, `estimatedCostUsd`; jev reports no tokens or cost, say so), and a few sample rows. For a yes/no filter also say how many matched. Tell the user the column can be sorted and filtered in the table header (numbers by comparison, labels by value).

7. **Filter and sort, only when the request asks for it** (see the next section): once the column is filled, call `generate_table_view({ projectId, tab: <the active tab>, description: "<the user's request in their words>" })`, then `apply_table_view` with its result unchanged.

Tools: `learn_tools({ toolNames: ["get_outreach_working_set", "preview_ai_column", "preview_sample_message_column", "run_ai_column", "get_ai_column_run_status", "cancel_ai_column_run", "generate_table_view", "apply_table_view"] })` once, before the first call.

## One column per fact: reuse before you create

The table must never hold two columns for the same fact (two store counts, two revenues, two brand categories, two "in India" flags). Filters and sorts always use the one existing column for a fact.

1. **List before you design.** Before any `preview_ai_column`, read `aiColumns` from `get_outreach_working_set` (key, label, type, how many rows are filled) and write down, in one line, which existing column answers each thing the user needs. Source data columns count too: Headquarters Country, Headquarters City, Employees On Linkedin, Linkedin Followers, Size Band, Industry, About, Specialties are already on every Bright Data row, so use them (filter on Headquarters Country = IN) rather than asking a model.
2. **Fill or improve an existing column, do not add a sibling.** If a column exists but its values are weak, incomplete or came from a worse engine, call `preview_ai_column` again with a description that says to fill or update that column (the server then reuses its exact key and type), and run it with `rerunAll: true` or `onlyViewMatches` on the rows that need it. The preview returns `reusedColumns` (existing keys it will fill) and `duplicateWarnings` (a new field that looks like an existing column). If `duplicateWarnings` is not empty, do not run: preview again so the field reuses the existing key, unless it is a genuinely different fact (then say why in one line).
3. **Create a new column only when no existing column holds the fact**, and name it so it cannot be confused with an existing one. A new threshold or a new category list is not a new fact: change the filter on the existing column.
4. **Filter on the existing column.** `generate_table_view` and `apply_table_view` use the same column for the same fact every time; never filter on an older duplicate.

## Filter and sort: is it needed?

Adding a column and filtering or sorting the table are different things. Decide from the user's words:

| The user says | Add column | Filter / sort |
| --- | --- | --- |
| "what are the revenues of each of these companies", "number of employees in each company" | yes | **no** — they want the data, not a narrower table |
| "filter these names in terms of who is a CEO", "only the CEOs", "show me who is in fintech", "keep those over 500 employees" | yes, if the column does not exist | **filter** |
| "sort by revenue", "largest companies first", "top 10 by employees" | yes, if the column does not exist | **sort** |
| "CEOs of companies over 500 employees, biggest first" | yes | filter **and** sort |
| "clear the filter", "show everyone again" | no | `apply_table_view({ clear: true })` |

- If the wording is genuinely unclear (for example "which of these are big companies?"), ask one question: "Add it as a column only, or also filter the table to the big ones?"
- Wait until `run_ai_column` has finished (or at least filled the first chunk) before `generate_table_view`: the filter can only use columns that exist. If the run is still going, check `get_ai_column_run_status` first.
- `generate_table_view` decides too: it returns `needsFilter` and `needsSort`. If both are false, do not apply anything and say that no filter or sort was needed.
- It only uses the columns the table really has, and returns how many rows match (`matchCount` of `total`). Show the filters, the sort and the count to the user in one line. When the user explicitly asked to filter or sort, apply it right away; do not ask again.
- `apply_table_view` stores the view for the project and shows it above the table for everyone (a bar with the filters, the sort and a Clear button). Pass the `filters` and `sort` from `generate_table_view` **unchanged**; never invent a `columnId`.
- Yes/no columns filter on Yes / No, label columns on their values, number columns by comparison (>, ≥, <, ≤, =), and a sort on a number column is numeric. This is why the column type matters.

## Sample first LinkedIn message column

When the user wants to **see what the first LinkedIn message would look like** for the people in the list ("draft the first message for these", "show me sample openers", "what would we send them after they accept"), add a **Sample LinkedIn message** column. It is the same column flow, with its own tool for the preview.

1. Preview: `preview_sample_message_column({ projectId, rowLimit: 3, include: { ... } })` instead of `preview_ai_column`. Drafts use the seeded opener prompt and agent; nothing is sent.
2. Choose `include` from what the user asked. Omit it for the defaults. Each flag is a context section:
   - `senderProfile`, `prospectEnrichment`, `profile`, `posts`, `chatHistory`: **on** by default. Set one to `false` only when the user asks to leave it out.
   - `profile` makes one live LinkedIn lookup per row; `posts` and `chatHistory` only exist for people already enrolled in the sequence (Find-list rows skip them).
   - `companyNews`: **off** by default. Turn it on only when the user asks for news, funding or recent company events in the message. It adds a web-search lookup per company (cached for 30 days).
3. Show the drafts, the sections used, and ask before running for all rows, exactly as in the flow above. Then `run_ai_column({ projectId, subject: "person", previewId })`. The messages land in `otherFields.sampleLinkedinMessage`, shown as the **Sample LinkedIn message** column.
4. Use it for the opener only. Follow-ups and replies are not drafted by this column.

## What the server decides (so you do not)

- **Types**: yes/no → `boolean`; counts (employees) → `integer`; money, revenue, ratios, scores → `number` with the unit in the name (for example `companyRevenueUsd`); buckets or ranges → `enum`; `text` only for what cannot be structured. Numbers are stored as numbers and enums as one of their values, so the table can sort and filter them.
- **Model**: `jev` for boolean or enum decisions the row can answer; OpenAI web search (gpt-4o-mini) for facts outside the row (revenue, headcount, funding), run once per distinct company and copied to every person who works there; gpt-4o-mini otherwise. jev only runs when the jev gateway key is configured, so report `usage.engine`, not what was planned.
- **No credible answer**: a number stays empty and a label or text answers "unknown". It is never guessed.

## Where the column is stored

The answer is written as a **new key in `otherFields`** of every row, next to existing keys, never replacing them:

- ephemeral Find list rows (People / Companies tabs, per project): `otherFields[columnKey] = value`
- CRM people already attached to the project (candidate) and CRM companies tagged to the project (`company.projectIds`): the same key via an `otherFields` merge patch

`otherFields.aiColumns[columnKey]` holds the header label, the type and the row status (`ok` or `failed`). Both stores are updated by `run_ai_column`. Do not call `upsert_outreach_target_people` / `upsert_outreach_target_companies` or any `update_*` tool to write it.

## Do not

- Hand-design column types, or put revenue / headcount into a `text` column
- Use `subject: "company"` for a question asked on the People tab (it is a person column about the employer), or `subject: "person"` on the Companies tab; or ask where the companies should come from
- Load every person or company into the conversation, loop `find_many_*`, or call `get_object_metadata` to find the title field
- Run `run_ai_column` before the user has confirmed the preview
- Invent revenue or headcount when the web search returns nothing
- Create CRM Company / Person records or enroll anyone as part of a filter or enrichment
- Create a column for a fact an existing column already holds (see **One column per fact**), or filter on a duplicate
- Skip `learn_tools` before the first call
- Apply a filter or sort when the user only asked for data, or apply one built from a column that does not exist
