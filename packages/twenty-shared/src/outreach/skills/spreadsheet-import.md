# Spreadsheet Import Skill

Use this skill when the user attaches a `.xlsx` / `.xls` / `.csv` and wants its rows in the Outreach **Companies** and/or **People** tabs ("import this sheet", "upload these leads into project X", "create a project from this file").

The rows land in the project's **ephemeral lists** (Companies / People tabs), exactly like search results. Nothing is written to the CRM; that only happens later through Add to CRM / Enroll. Never read the sheet yourself, never paste rows into `upsert_outreach_target_*`: the server parses every row.

## Flow (always in this order)

1. `learn_tools({ toolNames: ["inspect_outreach_spreadsheet", "import_outreach_spreadsheet", "find_many_projects", "create_one_project", "ask_questions"] })` once.
2. **Find the file.** The user message carries a note `[Spreadsheet attached: <name> fileId=<id>]`. Use that `fileId`. If it is missing, ask the user to attach the file again.
3. **Inspect**: `inspect_outreach_spreadsheet({ fileId })`. It returns the headers, five sample rows, a `suggestedMapping` and `suggestedCounts` (companies / people the mapping would produce). The mapping is proposed by a separate structured LLM call (`mappingSource: "llm"`, header heuristics when it is `"heuristic"`): sheet columns go onto the built-in company / person fields where one fits, and the rest become **proposed extra columns**, each with a snake_case `key`, a `label` and a `type` (text / number / boolean / url). Pass `sheetName` / `headerRow` only when the workbook has several sheets or the header is not on the first filled row.
4. **Ask the user, in one `ask_questions` turn** (skip any question the message already answers):
   - **Project**: the project from the browsing context if they are on `/outreach-home`, else list with `find_many_projects`. If they want a new one ("create a project", "new project called X"), `create_one_project({ name })` and use its id.
   - **What to import**: Companies only / People only / Both.
   - **Mapping**: show the suggested mapping as a short table (sheet column → company name, domain, industry, …; each contact column set → person, and the proposed extra columns with their key, label and type). Say which column is the company name and which fills in when it is empty, and which columns become extra table columns.
5. **Adjust** only what the user corrects, then **import**: `import_outreach_spreadsheet({ fileId, projectId, target, mapping, mode: "merge" })`. Pass the `suggestedMapping` object unchanged when the user accepted it. Use `mode: "replace"` only if they ask to overwrite the existing lists.
6. **Report** from the result: companies and people imported, tab totals, skipped rows and contact slots. Tell the user the Companies / People tabs refresh on their own, and that the extra sheet columns show as table columns. Offer the next step (AI column on the list, Add to CRM, Start outreach); do not take it unasked.

## Mapping rules

- **Company name**: the brand is the display name. If a separate legal / operating company column exists it is the fallback when the brand is empty and otherwise stays as an extra column.
- **Wide sheets**: columns like `Contact 1 name`, `Contact 1 title`, `Contact 1 LinkedIn`, `Contact 2 …` are one person each (`peopleGroups`). Empty slots and placeholders such as "Not found" are skipped.
- **LinkedIn**: the cell hyperlink is used as `linkedinUrl` when there is one, else the visible text if it is a URL. A link may be a LinkedIn search URL rather than a profile; keep it as `linkedinUrl` anyway.
- **Extra columns**: edit `key` / `label` / `type` in `extra` when the user asks, or drop an entry to leave that column out. The values appear on the Companies tab as table columns and can be filtered and sorted like AI columns.
- **People only** keeps the company name column in the mapping so each person shows their company, but writes no company rows.
- **Upsert keys**: companies by domain (fallback normalized name), people by LinkedIn URL (fallback name + company). Importing the same file twice does not duplicate.
- Rows without a company name are skipped for the Companies tab and reported.

## Errors

- `FILE_NOT_FOUND`: the attachment is gone; ask for it again.
- `UNKNOWN_COLUMNS`: the mapping names a header that is not in the sheet; use the exact `headers` from the inspect result.
- `MISSING_COMPANY_NAME` / `MISSING_PEOPLE_MAPPING`: ask the user which column holds the company or person name, then retry.
