## Source: Google SERP

`google_serp_search` runs a Google search. Four lookups it is good at:

| Query | Finds |
| --- | --- |
| Company + job title ("plant head Clariant Chemicals") | The person holding the role, often with a LinkedIn URL |
| Person name + company + "linkedin" ("Ashish Kumar Salesforce linkedin"), optionally with the title | That person's LinkedIn URL |
| Company name + "linkedin" | The company's LinkedIn page |
| Domain + "linkedin" ("clariant.com linkedin") | The company's LinkedIn page when the name is ambiguous |

Company websites and filings are read through web search, not as a separate source.

- Results are names and snippets, often without a LinkedIn URL. Put the rows on the tab with name and company, then `fetch_profiles` finds each URL: Bright Data by name and company, Google with "linkedin" on a miss. Never re-run `google_serp_search` per person for it; rows without a company are skipped. `find_people_by_company` does both steps for a role at named companies; prefer it.
- A snippet is a snapshot with very few fields. Treat every criterion beyond name, title and company as unknown until a profile fetch.
- For companies, a SERP hit for a LinkedIn company page is a way to find the company's LinkedIn URL; confirm the name matches, then an instant lookup on that URL fetches the record.
