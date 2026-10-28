## Source: Google SERP

`google_serp_search` runs a Google search. Use it for people when a company name + designation is the best handle ("plant head Clariant Chemicals"). Can also use it for a full name + company name + linkedin or full name + company name + designation + linkedin to ascertain the linkedin url of a person ("Ashish Kumar Salesforce linkedin") or ("Ashish Kumar Engineering Director Salesforce linkedin")

- Results are names and snippets, often without a LinkedIn URL. Put the rows on the tab with name and company, then `fetch_profiles` finds each URL: Bright Data by name and company, Google with "linkedin" on a miss. Never re-run `google_serp_search` per person for it; rows without a company are skipped. `find_role_at_companies` does both steps for a role at named companies; prefer it.
- A snippet is a snapshot with very few fields. Treat every criterion beyond name, title and company as unknown until a profile fetch.
- For companies, a SERP hit for a LinkedIn company page is a way to find the company's LinkedIn URL; confirm the name matches, then an instant lookup on that URL fetches the record.
