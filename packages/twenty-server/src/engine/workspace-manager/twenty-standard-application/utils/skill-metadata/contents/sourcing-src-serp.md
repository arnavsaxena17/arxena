## Source: Google SERP

`google_serp_search` runs a Google search through Bright Data. Use it for people when a company name plus designation is the best handle ("plant head Clariant Chemicals").

- Results are names and snippets, often without a LinkedIn URL. To get the URL, put the rows on the tab and run `fetch_profiles`: it looks each person up on Bright Data by name and company. Do not use `search_bright_data_business` for one person: for people it is a budgeted set search. `find_role_at_companies` does both steps for a role at named companies; prefer it.
- A snippet is a snapshot with very few fields. Treat every criterion beyond name, title and company as unknown until a profile fetch.
- For companies, a SERP hit for a LinkedIn company page is a way to find the company's LinkedIn URL; confirm the name matches before using it.
