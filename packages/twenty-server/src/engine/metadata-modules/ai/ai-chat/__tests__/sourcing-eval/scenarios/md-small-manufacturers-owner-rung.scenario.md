---
id: md-small-manufacturers-owner-rung
source_line: 0
function: General Management
level: Leadership Level
purpose: sales
mode: plan-only
repeat: 3
status: DRAFT
tags: [company-role, uploaded, sales, small-companies, ladder, phase-1]
expect:
  must_call: [get_sourcing_ledger, find_people_by_company]
  must_not_call: [create_candidate, create_one_company, save_outreach_targets_to_crm]
  max_questions: 4
  plan_assertions:
    - the brief records persona sales, so the title ladder may reach rung 4 (owner or MD of a small company)
    - companies the import could not identify are reported as unresolvable and not searched
    - people kept at rung 3 or 4 are flagged as such in the report
    - a company ending none_found with reason budget is reported with the option of a higher per-pair cap, not silently retried
judge:
  - Explains in one line that for small promoter-led firms the owner or MD is taken as the decision-maker
  - Never widens the ladder past the brief without asking
  - Asks before raising any spend cap
---

# md-small-manufacturers-owner-rung

## Setup
Project has 20 small electrical-goods manufacturers (most under 200 employees) imported from a sheet with names only; two names do not match any known company. No earlier brief. Bright Data and Google SERP are configured.

## User says
> Get me the head of procurement at each of these companies, or whoever decides on purchases if there is none.

Track: people-by-company (uploaded companies + role).

## Scripted replies
- If asked which data sources to use: "Use Bright Data and Google."
- If asked to confirm the pilot: "Looks right."

## Labels
Fill in with the person per company (name, title, LinkedIn URL) and the rung you would accept, or "none" with a reason. Leave blank until labelled.

| Company | Person | Title | Rung | Notes |
| --- | --- | --- | --- | --- |
