## People

### What each source can filter on

{{sources: capabilities people}}

A population is this section: a title, a skill, an industry, a city, or "all software engineers who know React in SaaS companies in Mumbai". Do not call `find_people_by_company` and do not look up each person at each company. A role at companies already named loads `people-by-company`.

### Provider map (choose by intent)

{{sources: provider-map people}}

### learn_tools (people)

Do not `create_candidate` on Find or on Save to CRM. Write and Save to CRM follow **Result lists** and **Write contract** in the head of this skill.

{{sources: learn-tools people}}

<!-- search-find-candidate-internal-learn-tools-line:start -->
`find_candidate_in_arxena_internal` looks up one existing person. It does not create a record.
<!-- search-find-candidate-internal-learn-tools-line:end -->

The server dedupes on one key per row: public LinkedIn URL (never Sales Navigator), else name plus company. `against: "lists"` checks every list in the workspace. The CRM check uses the LinkedIn URL only: a row without one counts as new and `save_outreach_targets_to_crm` skips it.

### People constraints

- On Outreach People tab, a Find must write the tab before ending. Do not end on a chat-only list. Do not `create_candidate` on Find or on Save to CRM.
- Present results with name, title, company, location, and source; note when Recruiter results hide public identifiers.
- Save to CRM: `save_outreach_targets_to_crm` with `target: "people"`. Start outreach only after, and only when asked: `load_skills(["outreach"])`.

### Job title search

When people are filtered by the job they hold now ("heads of procurement", "plant managers", "CFOs"), check which sources filter the current title.

Use only the sources the user picked for this run.

| Source | Current title filter | How to write the titles | Trust |
| --- | --- | --- | --- |
| Bright Data people | `current_title` (separate from `past_job_titles`) | Plain words; the ludicrous planner compiles boolean strings from the request ("(VP OR Head) AND Procurement") | Good; a record can lag a recent job change |
| Sales Navigator (the user's LinkedIn) | `role: { include }` on the current position (`src-linkedin`) | Boolean string | Best precision; runs in slow mode |
| Harvest | `currentJobTitles` (Sales Navigator filters) | One entry per title | Same as Sales Navigator; paid |
| LinkedIn Recruiter | Title keywords with `scope: "CURRENT"` | Boolean string | Good |
| LinkedIn Classic | Keywords only (`advanced_keywords.title` is a keyword match too) | Short keywords | **Flaky**: a match can come from a past role, the headline or the about text. A Classic row is not a title match until its profile shows the title as the current position |
| Google search | Company + job title, to find LinkedIn URLs | One title per query | Snippets only; `find_people_by_company` already does this |
| Apollo | Person titles | One entry per title | Only when switched on |

### Job title rules

- **Always the current title.** Never filter on past titles unless the user asks for "ex-" or "former" people.
- **Expand titles in the user's words.** Use the synonym ladders (`title-seniority`, in `playbook-shortfall`). `find_people_by_company` applies the title taxonomy on its own. Never drop a title the user named, and never add a lower-level one they did not ask for.
- **Write each title the way the source expects:** boolean for Sales Navigator and Recruiter, plain words for Bright Data, one per entry for Harvest. Never send boolean syntax to Classic.
- **Seniority depends on company size.** "Head of X" at a small company can be a manager; at a large company, "Director" can sit below VP. Read the scope on the profile (`scoring`).
- **Headline against position.** When they disagree, trust the current position in the experience section.
- **Title at named companies** is `find_people_by_company`, not a title search.
