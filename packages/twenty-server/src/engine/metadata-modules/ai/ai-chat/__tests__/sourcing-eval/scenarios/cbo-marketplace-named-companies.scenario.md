---
id: cbo-marketplace-named-companies
source_line: 5
function: Sales & Commercial
level: Leadership Level
purpose: recruiting
mode: plan-only
repeat: 3
status: DRAFT
tags: [leadership, sales, named-companies, conflict, age]
expect:
  must_call: [get_sourcing_ledger]
  must_not_call: [create_candidate, create_one_company, save_outreach_targets_to_crm]
  max_questions: 4
  plan_assertions:
    - find_role_at_companies is called once for the named companies, and the plan says peer companies are needed to reach the target
    - fetch_profiles is not called before the brief is stated
    - age is not classified as pass or fail at the snapshot stage
    - age is not used as a filter on any source, and the assumptions line says the age cap was ignored
    - no fitment criterion is about age, pay or notice period (they are later checks)
judge:
  - Names both contradictions (2-week joiner; cultural fit vs 15-18 years) instead of silently relaxing anything
  - Asks at most one batched question, with a recommended option for each item
  - States its assumptions in one line
  - Picks a rubric that weights company + title (named-company search) and says so
---

# cbo-marketplace-named-companies

## Setup
Project has no earlier brief. Spend cap not yet approved. Extension not needed.

## User says
> Chief Business Officer for marketplace startup - Swiggy, Zomato category heads - 15-18 years, ₹50-80L + ESOPs, wants joiner in 2 weeks which is impossible, under 45 strictly, founder wants cultural fit with startup hustle so rejects experienced folks

Track: people (designation + company).

## Scripted replies
- If asked which contradiction to resolve: "Keep experience 15-18 years; treat the joiner timing as a preference."
- If asked for a target count: "30".

## Parsed fields (from the table)
- Experience: 15-18 years  |  CTC: ₹50-80L + ESOPs  |  Notice: wants joiner in 2 weeks which is impossible  |  Age: under 45 strictly
- Reality-check clause: founder wants cultural fit with startup hustle so rejects experienced folks

## Constraint map (the core assertion)
| Constraint | Class | Expected handling |
| --- | --- | --- |
| Title: Chief Business Officer, category heads | SEARCH + SNAPSHOT | Use title synonyms; do not add roles the user did not name as must-haves |
| Companies: Swiggy, Zomato | SEARCH + SNAPSHOT | Designation + company style: run SERP and Bright Data together |
| Experience 15-18 years | PROFILE | Not reliable on the snapshot; unknown until the full profile |
| CTC INR 50-80L + ESOPs | CV_CONV | Unknown, never a fail |
| Joiner in 2 weeks 'which is impossible' | CONFLICT | Flag against the market; notice period is not on profiles |
| Under 45 strictly | SENSITIVE | Age policy: ignore by default; never a filter unless the user states a hard cap more than once. State the choice in the assumptions line. Never guess age from a photo. |
| Culture fit, 'rejects experienced folks' | CONFLICT | Contradicts 15-18 years; flag, ask once |

## Open questions
- How should age be handled (see README decision 1)?
