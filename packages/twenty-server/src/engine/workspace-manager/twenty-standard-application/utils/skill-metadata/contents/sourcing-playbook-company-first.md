## Playbook: company list first

Use when the user wants a role across an industry ("HR head in pharmaceutical companies") or at a set of companies they did not name. Build the companies, then find the people.

1. **Build the company list** with the `companies` section (Bright Data first). Score the companies against the user's company criteria before spending on people: industry, size, geography, and anything else that does not need a person.
2. **Confirm the exact list before any people spend**, every time, even after a yes on caps. Show the kept companies in a short table (name, the criteria that decided it) and one line on how many you dropped and why. Then `ask_questions` once: "Find {roles} at these {N} companies?" with **Yes, these {N}** (recommended), **Edit the list** and **Cancel**. On Edit, take the user's changes (names to add or drop, or a filter they applied on the Companies tab) and confirm again. Do not call `find_people_by_company` before a yes.
3. **Find the role at the approved companies only** with `find_people_by_company`, as `people-by-company` describes: the brief first (roles, persona, sources, ladder), a pilot of 10, the user's check, then the rest as a background run. Pass the approved list as `companies` with row ids, or `fromProject: true, onlyViewMatches: true` when the Companies tab view shows exactly that list. Do not search company by company yourself.
4. **Score the people** by the funnel in the Vocabulary, using `scoring`. A person whose company fails the company criteria does not count.
5. **Report**, coverage first: the coverage line from `get_sourcing_ledger` (`pairs.coverageLine`: covered, none found with reasons, needing review), then the found people, then the companies without one and why, then companies searched and spend.

Company name plus designation on Google often yields names without LinkedIn URLs. `find_people_by_company` already resolves those URLs; do not do it by hand.
