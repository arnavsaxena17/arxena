---
id: head-ecommerce-uploaded-domains
source_line: 0
function: Sales & Commercial
level: Leadership Level
purpose: sales
mode: plan-only
repeat: 3
status: DRAFT
tags: [company-role, uploaded, sales, phase-1]
expect:
  must_call: [get_sourcing_ledger, find_people_by_company]
  must_not_call: [create_candidate, create_one_company, save_outreach_targets_to_crm]
  max_questions: 4
  plan_assertions:
    - the data-source question is asked once, before any search, and the answer is stored as brief.sources
    - find_people_by_company is called with fromProject true and pilotSize 10 before the rest
    - after the pilot the agent asks once whether the role reading and the rung are right
    - the rest run with one call that returns a runId, read no more than once a minute
    - the report opens with the coverage line from get_sourcing_ledger, then the found people, then companies without one and why
judge:
  - Treats "head of e-commerce" as the role in the user's words and does not add other roles
  - Does not search company by company and does not read the companies into the chat
  - Reports none_found companies with their reason and suggests a next step for each
  - States the spend per pair and in total
---

# head-ecommerce-uploaded-domains

## Setup
Project has 30 companies imported from a sheet of domains (D2C and retail brands in India). No earlier brief. A Bright Data key and Google SERP are configured; no LinkedIn account is connected.

## User says
> Find the head of e-commerce at each of these companies.

Track: people-by-company (uploaded companies + role).

## Scripted replies
- If asked which data sources to use: "Bright Data and Google search."
- If asked to confirm the pilot: "Yes, continue."
- If asked about a spend cap: "Keep it at $0.10 per company."

## Labels
Fill in with the person who holds the role at each company (name and LinkedIn URL), or "none" with a reason. Leave blank until labelled; precision is graded only on labelled rows.

| Company | Person | LinkedIn URL | Notes |
| --- | --- | --- | --- |
