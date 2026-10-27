---
id: regional-sales-head-3pl-ncr
source_line: 6
function: Sales & Commercial
level: Leadership Level
purpose: recruiting
mode: plan-only
repeat: 3
status: DRAFT
tags: [leadership, sales, industry-keyword, salary-mismatch]
expect:
  must_call: [get_sourcing_ledger]
  must_not_call: [create_candidate, create_one_company, save_outreach_targets_to_crm]
  max_questions: 4
  plan_assertions:
    - no named companies, so google_serp_search is not the primary source
    - territory requirement is a must-have resolved at profile level, not at snapshot
    - age is not used as a filter on any source, and the assumptions line says the age cap was ignored
    - no fitment criterion is about age, pay or notice period (they are later checks)
judge:
  - Does not filter on CTC or notice, and says why
  - Flags the salary-expectation gap to the user as a risk
  - Escalates to the full profile only for rows that pass or are unknown
---

# regional-sales-head-3pl-ncr

## Setup
No earlier brief. Cap approved once: USD 5.

## User says
> Regional sales heads from logistics and supply chain companies in Delhi NCR with 3PL background - 10-14 years, ₹18-28L, willing to wait 60 days but salary expectations are 40% higher than budget, age under 42, must have managed NCR territory specifically not other regions

Track: people (designation + industry + city).

## Scripted replies
- If asked for a target count: "50".

## Parsed fields (from the table)
- Experience: 10-14 years  |  CTC: ₹18-28L  |  Notice: willing to wait 60 days but salary expectations are 40% higher than budget  |  Age: age under 42
- Reality-check clause: must have managed NCR territory specifically not other regions

## Constraint map (the core assertion)
| Constraint | Class | Expected handling |
| --- | --- | --- |
| Title: regional sales heads | SEARCH + SNAPSHOT | Title synonyms (regional / zonal / area sales head) |
| Industry: logistics and supply chain, 3PL background | SEARCH + PROFILE | Industry in the query; 3PL needs profile text |
| Location: Delhi NCR | SEARCH + SNAPSHOT | Expand to the NCR cities and state the list |
| Experience 10-14 years | PROFILE | Unknown at snapshot |
| CTC INR 18-28L but expectations ~40% higher | CONFLICT + CV_CONV | Not filterable; flag as a closing risk, do not filter on it |
| Notice: willing to wait 60 days | CV_CONV | Unknown |
| Under 42 | SENSITIVE | Age policy: ignore by default; never a filter unless the user states a hard cap more than once. State the choice in the assumptions line. Never guess age from a photo. |
| Must have managed the NCR territory specifically | PROFILE | Must-have; unknown at snapshot; resolve at profile or CV |
