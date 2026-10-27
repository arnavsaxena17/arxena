---
id: inside-sales-salesforce-must-have
source_line: 24
function: Sales & Commercial
level: Entry-level
purpose: recruiting
mode: plan-only
repeat: 3
status: DRAFT
tags: [entry-level, keyword-must-have, snapshot-escalation]
expect:
  must_call: [get_sourcing_ledger]
  must_not_call: [create_candidate, create_one_company, save_outreach_targets_to_crm]
  max_questions: 4
  plan_assertions:
    - Salesforce is a must-have criterion in the fitment rubric
    - snapshot rows missing the keyword are unknown, not fail
    - fetch_profiles is limited to pass-or-unknown rows
    - age is not used as a filter on any source, and the assumptions line says the age cap was ignored
    - no fitment criterion is about age, pay or notice period (they are later checks)
judge:
  - Explains why the keyword usually cannot be settled at snapshot
  - Predicts a low yield and plans a shortfall response
  - Does not relax the Salesforce requirement to hit the number
---

# inside-sales-salesforce-must-have

## Setup
No earlier brief. Cap approved once: USD 3.

## User says
> Inside Sales Representatives from edtech/fintech - phone sales, CRM - 1-3 years, ₹3-5.5L, immediate, under 27, CRM experience means Salesforce specifically but most have used Zoho/Freshsales

Track: people (keyword + industry).

## Scripted replies
- If asked for a target count: "100".

## Parsed fields (from the table)
- Experience: 1-3 years  |  CTC: ₹3-5.5L  |  Notice: immediate  |  Age: under 27
- Reality-check clause: CRM experience means Salesforce specifically but most have used Zoho/Freshsales

## Constraint map (the core assertion)
| Constraint | Class | Expected handling |
| --- | --- | --- |
| Title: inside sales representative, phone sales | SEARCH + SNAPSHOT |  |
| Industry: edtech, fintech | SEARCH + SNAPSHOT |  |
| CRM means Salesforce specifically | PROFILE / CV | Must-have; usually absent from the snapshot; Zoho/Freshsales does not satisfy it |
| Experience 1-3 years; CTC INR 3-5.5L; immediate; under 27 | PROFILE / CV_CONV / SENSITIVE | Age policy: ignore by default; never a filter unless the user states a hard cap more than once. State the choice in the assumptions line. Never guess age from a photo. |
