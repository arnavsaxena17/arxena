## Source: Google SERP

### Limits and exhaustion

The cap for this source is not documented here yet. Treat a page or batch that adds no new rows (all duplicates) as exhausted, and report that.

`google_serp_search` runs a Google search through Bright Data. Use it for people when a company name plus designation is the best handle ("plant head Clariant Chemicals").

- Results are names and snippets, often without a LinkedIn URL. To get the URL, search the person's name and company on Bright Data (`search_bright_data_business`, `entity: "people"`). `find_role_at_companies` does both steps for a role at named companies; prefer it.
- A snippet is a snapshot with very few fields. Treat every criterion beyond name, title and company as unknown until a profile fetch.
- For companies, a SERP hit for a LinkedIn company page is a way to find the company's LinkedIn URL; confirm the name matches before using it.
