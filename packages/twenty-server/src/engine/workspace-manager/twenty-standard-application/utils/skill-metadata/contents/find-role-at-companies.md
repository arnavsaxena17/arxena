---
label: Find Role At Companies
icon: IconUserSearch
description: |-
  Find the CEO, MD, founder or any named role at companies already on the project, in one call that checks every match
priority: 25
routes:
  - when: |-
      Get the CEO / founder / MD / any role at the companies already on the project ("get the CEO of each filtered company", "founders of these")
    hint: |-
      and follow it: one `find_role_at_companies` call for all the companies (it searches Bright Data and Google and checks each match), no estimate or budget question. Never use Harvest or LinkedIn for it unless the user names them. "Filtered" means the rows the Companies tab view or its AI columns select (for example the HQ column), not every row.
---
# Find Role At Companies

A targeted company + position lookup. **No estimate, no budget question, no provider question**: one tool, `find_role_at_companies`. The user's short sentence is the whole request.

`learn_tools(["find_role_at_companies", "get_outreach_working_set"])` once, then follow the steps.

1. **Which companies.** "Filtered", "selected" or "these" means the rows shown on the project's Companies tab. Read them with `get_outreach_working_set` (companies, `onlyViewMatches: true`). If the view filter does not narrow the list but the user named a criterion (a city, "HQed in Mumbai", revenue), use the AI column that answers it (its summary and values are in the working set) and keep only the rows that satisfy it. Say in one line how many companies you took and which you left out and why. Ask a question only if no tab or column can tell you.
2. **One call for all of them** (up to 25): `find_role_at_companies({ companies: [{ name, alternateNames? }], roles, country, projectId })`.
   - `roles`: every role the user named, in their words (`["CEO", "MD", "founder"]`). Never drop one and never add one they did not ask for. The tool classifies each with the job-title taxonomy service and searches the titles that belong to it, so "MD", "managing director" and "CEO" are treated as one function.
   - `name`: the company as shown on the tab. `alternateNames`: legal or parent names you know (Arun Ice Cream → `["Hatsun Agro Product"]`, Baskin Robbins India → `["Graviss Foods"]`), because profiles list the employer, not the brand.
   - `country` is a country, never a city. `projectId` writes the verified people to the People tab.
   - The tool searches Bright Data and Google (LinkedIn profiles), checks that each person works at that company and holds the role, and merges duplicates. Total Bright Data spend is about $0.02 per company.
3. **Read `status` per company.** `matched`: the person holds the role. `related_role_only`: a deputy, vice or acting holder; say so, do not call it a match. `no_match`: nothing verified. `rejected` lists people who were found but do not belong, with the reason; they are not written to the tab.
4. **No match.** Call the tool once more for only the `no_match` companies, with `alternateNames` you can add (legal name, parent). If they are still `no_match`, list them as such. Do not broaden the roles.
5. **Report in one short table**: company, person, title, LinkedIn URL, source; then the related-role-only and no-match companies and the spend. No separate verification step is needed; the tool already did it.
