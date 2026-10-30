## Companies

### Provider map (choose by intent)

{{sources: provider-map companies}}

### What each source can filter on

{{sources: capabilities companies}}

Call `get_source_capabilities({ sources, entity: "company", want: [...], term, rawQuery })` before the plan questions: it returns the fields above with their allowed values, the fields no picked source has and the nearest stand-in, and ready-to-send question options. Never offer a filter a source does not have.

### learn_tools (companies)

Write and Save to CRM follow **Result lists** and **Write contract** in the head of this skill.

{{sources: learn-tools companies}}

The server dedupes on one key per row: domain, else LinkedIn company URL, else name alone (same-name companies without either merge). `against: "lists"` checks every list in the workspace. The CRM check uses the domain only: a row without one counts as new.

### Companies constraints

- Outlets on a map are `places`, not this section.

- On Outreach Companies tab, a Find must write the tab before ending. Do not end on a chat-only list.
- Present results with name, domain, industry, location, size, and source so the user can assess quality.
- Save to CRM: `save_outreach_targets_to_crm` with `target: "companies"`.
