## Playbook: company list first

Use when the user wants a role across an industry ("HR head in pharmaceutical companies") or at a set of companies they did not name. Build the companies, then find the people.

1. **Build the company list** with the `companies` section (Bright Data first). Score the companies against the user's company criteria before spending on people: industry, size, geography, and anything else that does not need a person.
2. **Show the user the count** and a few names. Ask once before the people step if the list is large.
3. **Find the role at every company** with `find_role_at_companies`, as the `people-by-company` section describes: `fromProject: true`, one call, the user's role words. Do not search company by company yourself.
4. **Score the people** by the funnel in the Vocabulary, using `scoring`. A person whose company fails the company criteria does not count.
5. Report companies searched, people found, people that cleared the threshold, spend.

Company name plus designation on Google often yields names without LinkedIn URLs. `find_role_at_companies` already resolves those URLs; do not do it by hand.
