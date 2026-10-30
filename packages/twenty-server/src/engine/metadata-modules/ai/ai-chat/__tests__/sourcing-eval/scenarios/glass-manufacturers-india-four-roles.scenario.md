---
id: glass-manufacturers-india-four-roles
source_line: 0
function: Operations & Manufacturing
level: Leadership Level
purpose: sales
mode: plan-only
repeat: 3
status: DRAFT
tags: [company-role, industry, glass, india, multi-role, per-role-pairs, phase-1]
expect:
  must_call: [get_sourcing_ledger, search_bright_data_business, find_people_by_company]
  must_not_call: [create_candidate, create_one_company, save_outreach_targets_to_crm]
  max_questions: 6
  plan_assertions:
    - loads playbook-company-first and industry-search, not a population people search
    - runs search_bright_data_business with entity=company before any find_people_by_company call
    - asks sub-segments, size band, geography and coverage (all vs top N) in the scope batch
    - passes the resolved glass industry label, or names glass manufacturing in the company query
    - passes all four roles (MD, CEO, Head of Operations, Head of Manufacturing), not one merged label
    - coverage is reported per company x role pair, so a company with a CEO and no manufacturing head is not "covered"
judge:
  - Does not recommend a ~100-company slice without offering "all in the universe"
  - Treats "heads of operations/ manufacturing" as two roles
  - Asks about geography (India-wide vs a cluster, Indian HQ vs foreign manufacturers with India operations)
  - Asks about glass sub-segments (float/architectural, container, glassware, automotive, fibre/scientific)
---

# glass-manufacturers-india-four-roles

## Setup
No earlier brief. Cap approved once: USD 5. Bright Data and Google SERP are configured; Harvest is not configured. The project is empty. The company search returns a mixture of glass manufacturers, glass traders and foreign companies.

## User says
> looking for md/ ceo/ heads of operations/ manufacturing of glass manufacturing companies in India

## Scripted replies
- If asked which data sources to use: "Bright Data and Google."
- If asked which glass segments: "All segments — float/architectural, container and packaging, glassware, automotive, fibre and scientific, processing."
- If asked about company size: "All sizes, including MSME units."
- If asked about geography: "India-wide; Indian-headquartered companies plus foreign manufacturers with India operations."
- If asked about coverage: "All glass manufacturers in the universe, within the $5 cap."
- If asked to confirm the company list: "Yes, these companies."
- If asked to confirm the pilot: "Looks right."

## Labels
Fill in with the person per company and role (name, title, LinkedIn URL) and the rung you would accept, or "none" with a reason. Leave blank until labelled.

| Company | Role | Person | Title | Rung | Notes |
| --- | --- | --- | --- | --- | --- |
