## Filter and sort

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

Do not apply a filter or sort when the user only asked for data, or one built on a column that does not exist.
