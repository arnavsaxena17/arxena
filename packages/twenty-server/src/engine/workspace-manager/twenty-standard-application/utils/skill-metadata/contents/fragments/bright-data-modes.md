**Pick the mode by what the request gives you: a description of a set, or an identifier.**

- **ludicrous** (default): a set described by attributes the data holds (see **What a query may say**). Pass the sentence; the server plans a structured query, then estimate, budget, fetch. It has **no URL, website or domain field**, so an identifier matches nothing.
- **instant**: one raw string (max 200 characters), fuzzy word match, no filters, no estimate, billed per record. The server keeps only exact identity matches. Only for one company by website; anything else passed as instant runs as ludicrous.

| The user gives | Do this |
|---|---|
| A description of companies or people | ludicrous |
| A company website or domain | instant, `entity: "company"`, bare host (companies recipe) |
| A person's LinkedIn URL, or name and company | Not this tool: `fetch_profiles` on the row does the instant lookup; `find_role_at_companies` for a role at named companies |
| A company LinkedIn URL | Not supported (instant filters on website). Ask for the website |
| A Sales Navigator or LinkedIn search URL | `src-linkedin` |
