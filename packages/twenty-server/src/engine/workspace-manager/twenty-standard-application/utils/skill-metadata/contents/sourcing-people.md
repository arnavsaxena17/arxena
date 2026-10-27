## People

A population is this section: a title, a skill, an industry, a city, or "all software engineers who know React in SaaS companies in Mumbai". Do not call `find_role_at_companies` and do not look up each person at each company. A role at companies already named loads `people-by-company`.

### Provider map (choose by intent)

{{sources: provider-map people}}

### learn_tools (people)

Do not `create_candidate` on Find or on Save to CRM. Write and Save to CRM follow **Result lists** and **Write contract** in the head of this skill.

{{sources: learn-tools people}}

<!-- search-find-candidate-internal-learn-tools-line:start -->
`find_candidate_in_arxena_internal` looks up one existing person. It does not create a record.
<!-- search-find-candidate-internal-learn-tools-line:end -->

Dedup across sources before writing: LinkedIn URL, else name plus current company; name alone never matches (`entity-resolution`).

### People constraints

- On Outreach People tab, a Find must write the tab before ending. Do not end on a chat-only list. Do not `create_candidate` on Find or on Save to CRM.
- Present results with name, title, company, location, and source; note when Recruiter results hide public identifiers.
- Save to CRM: `save_outreach_targets_to_crm` with `target: "people"`. Start outreach only after, and only when asked: `load_skills(["outreach"])`.
