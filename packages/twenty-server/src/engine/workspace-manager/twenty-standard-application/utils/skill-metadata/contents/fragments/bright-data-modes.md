**Pick the mode by what the request gives you: a description of a set, or an identifier or short literal.**

- **ludicrous** (default): a set described by attributes the data holds (see **What a query may say**). Pass the sentence; the server plans a structured query, then estimate, budget, fetch. It has **no URL, website or domain field**, so an identifier matches nothing.
- **instant** (`mode: "instant"`): one raw string (max 200 characters), fuzzy word match, no filters, no estimate, billed per row.
  - **Lookup**: a company website (`entity: "company"`, bare host) or a company or person LinkedIn URL. Cut to the exact match and written to the tab.
  - **Probe**: any other short literal ("Smita Jatia Westlife", "CFO fintech Bengaluru"). Up to 25 preview rows (`limit`, default 10, about $0.05 at most), never written. To check a name exists or see what a phrase returns before an estimate. `matched` is not a count of fits; counts come from the ludicrous estimate.

| The user gives | Do this |
|---|---|
| A description of companies or people | ludicrous |
| A website, or a LinkedIn company or profile URL | instant lookup |
| A name, or name and company, to check | instant probe; for rows already on the tab, `fetch_profiles` stores the profile |
| A role at named companies | `find_role_at_companies` |
| A Sales Navigator or LinkedIn search URL | `src-linkedin` |
