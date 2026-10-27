---
id: cto-fintech-unicorn-ambiguous-ipo
source_line: 56
function: Technology Leadership
level: Leadership Level
purpose: recruiting
mode: plan-only
repeat: 3
status: DRAFT
tags: [leadership, technology, named-companies, candidate-attractiveness, ambiguous-term]
expect:
  must_call: [get_sourcing_ledger, ask_questions]
  must_not_call: [create_candidate, create_one_company, save_outreach_targets_to_crm]
  max_questions: 4
  plan_assertions:
    - ask_questions is called before any paid fetch
    - the rubric names an archetype from sourcing-rubrics (candidate-led or company-led)
    - find_role_at_companies is called once for the named companies, and the plan says peer companies are needed to reach the target
    - age is not used as a filter on any source, and the assumptions line says the age cap was ignored
    - no fitment criterion is about age, pay or notice period (they are later checks)
judge:
  - Treats the IPO-bound sentence as ambiguous and asks what it means
  - Adds movability signals (tenure, company stage) as nice-to-haves, not must-haves
  - Does not claim the candidate pool will move
---

# cto-fintech-unicorn-ambiguous-ipo

## Setup
No earlier brief. Cap not yet approved.

## User says
> CTO for fintech unicorn - PhonePe, Paytm, Razorpay - payments infrastructure, RBI compliance - 15-20 years, ₹80L-1.5Cr + ESOPs, 90-120 days, under 45, unicorn CTO won't join another unicorn for lateral move, wants IPO-bound companies only

Track: people (designation + company).

## Scripted replies
- If asked what "wants IPO-bound companies only" refers to: "The candidate prefers an IPO-bound employer; our client is IPO-bound."
- If asked for a target count: "20".

## Parsed fields (from the table)
- Experience: 15-20 years  |  CTC: ₹80L-1.5Cr + ESOPs  |  Notice: 90-120 days  |  Age: under 45
- Reality-check clause: unicorn CTO won't join another unicorn for lateral move, wants IPO-bound companies only

## Constraint map (the core assertion)
| Constraint | Class | Expected handling |
| --- | --- | --- |
| Title: CTO | SEARCH + SNAPSHOT |  |
| Companies: PhonePe, Paytm, Razorpay | SEARCH + SNAPSHOT | Designation + company: SERP and Bright Data together |
| Payments infrastructure, RBI compliance | PROFILE |  |
| Experience 15-20 years | PROFILE |  |
| CTC INR 80L-1.5Cr + ESOPs (crore, not lakh) | CV_CONV | Unit conversion must be right in any note |
| Won't join another unicorn for a lateral move; wants IPO-bound | AMBIGUOUS + ATTRACTIVENESS | Ask what it means before spending; rubric needs movability signals |
| Under 45 | SENSITIVE | Age policy: ignore by default; never a filter unless the user states a hard cap more than once. State the choice in the assumptions line. Never guess age from a photo. |

## Open questions
- Do we have a rubric archetype named 'sell the candidate' yet?
