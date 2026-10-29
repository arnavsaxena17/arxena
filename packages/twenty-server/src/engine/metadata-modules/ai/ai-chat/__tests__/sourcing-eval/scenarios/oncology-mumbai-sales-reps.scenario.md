---
id: oncology-mumbai-sales-reps
purpose: recruiting
mode: plan-only
repeat: 1
status: DRAFT
tags: [sales-rep, pharma, oncology, mumbai, company-first, enrichment, shortlist]
expect:
  must_call: [get_sourcing_ledger, search_bright_data_business, ask_questions]
  must_not_call: [create_candidate, save_outreach_targets_to_crm]
  max_questions: 4
  plan_assertions:
    - track is company-first (Bright Data companies, then find_people_by_company or people search)
    - oncology manufacture is handled as company enrichment or a must-have employer criterion, not ignored
    - fitment rubric includes sales-rep role and Mumbai location as must-haves when scoring people
    - a shortlist is ranked via fitmentScore and/or generate_table_view / apply_table_view
    - no fitment criterion is about age, pay or notice period (they are later checks)
judge:
  - Prefers company-first over a single unscoped people search
  - Caps spend around 25 companies / 25 people when asked for a budget
  - Reports enrichment quality and a ranked shortlist rather than dumping raw rows
---

# oncology-mumbai-sales-reps

## Setup
No earlier brief. Cap approved once: USD 5. Naukri extension not connected.

## User says
> Give me all sales reps in pharma companies that manufacture oncology drugs in mumbai

Track: company-first (oncology pharma companies, then sales/medical/territory/field reps).

## Scripted replies
- If asked for a target count: "25".
- If asked what "in Mumbai" means: "reps based in Mumbai (companies anywhere in India)".
- If asked which titles count as sales rep: "rep family (sales representative, medical representative, territory sales, field sales)".
- If asked for a Bright Data / search budget: accept about 25 records / ~$0.05.

## Parsed fields
- Role: sales / medical / territory / field reps
- Company filter: pharma that manufacture oncology drugs
- Location: Mumbai (reps based)
- Target: 25

## Constraint map
| Constraint | Class | Expected handling |
| --- | --- | --- |
| Sales rep family titles | SEARCH + SNAPSHOT / find_people_by_company | Roles list or people query |
| Pharma + oncology manufacture | COMPANY ENRICH or SEARCH | Company list first, enrich or filter oncology |
| Mumbai | SNAPSHOT / PROFILE | Reps based in Mumbai |
| Target ~25 | BRIEF | Ask once, then stop at threshold |
