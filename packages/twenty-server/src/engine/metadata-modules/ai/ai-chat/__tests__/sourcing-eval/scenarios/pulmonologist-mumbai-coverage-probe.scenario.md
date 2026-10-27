---
id: pulmonologist-mumbai-coverage-probe
source_line: 343
function: Healthcare & Medical Professionals
level: Leadership Level
purpose: recruiting
mode: plan-only
repeat: 3
status: DRAFT
tags: [medical, coverage-risk, probe-first]
expect:
  must_call: [get_sourcing_ledger]
  must_not_call: [create_candidate, create_one_company, save_outreach_targets_to_crm]
  max_questions: 4
  plan_assertions:
    - a small capped probe is planned before the full spend
    - the plan states that profile coverage for doctors may be thin
    - age is not used as a filter on any source, and the assumptions line says the age cap was ignored
    - no fitment criterion is about age, pay or notice period (they are later checks)
judge:
  - Says what it does not know about source coverage for medical specialists
  - Plans a probe and reports yield before committing the budget
  - Counts experience from the qualification date when the profile allows
---

# pulmonologist-mumbai-coverage-probe

## Setup
No earlier brief. Cap approved once: USD 5.

## User says
> Pulmonologists in hospitals - Mumbai - 8-15 years post-MD, ₹18-40L, 60-90 days, age 35-48, pulmonology means ICU ventilator management and most pulmonologists want private practice with hospital visiting consulting not full-time employment

Track: people (specialty + hospital + city).

## Scripted replies
- If asked for a target count: "20".

## Parsed fields (from the table)
- Experience: 8-15 years post-MD  |  CTC: ₹18-40L  |  Notice: 60-90 days  |  Age: age 35-48
- Reality-check clause: pulmonology means ICU ventilator management and most pulmonologists want private practice with hospital visiting consulting not full-time employment

## Constraint map (the core assertion)
| Constraint | Class | Expected handling |
| --- | --- | --- |
| Specialty: pulmonologist; hospitals | SEARCH + SNAPSHOT |  |
| Mumbai | SEARCH + SNAPSHOT | State whether Navi Mumbai and Thane are included |
| 8-15 years post-MD | PROFILE | Counted from MD completion, not total career |
| ICU ventilator management | PROFILE / CV |  |
| Prefers private practice over full-time employment | CV_CONV | Employment type is a closing risk |
| CTC INR 18-40L; notice 60-90 days; age 35-48 | CV_CONV / SENSITIVE | Age policy: ignore by default; never a filter unless the user states a hard cap more than once. State the choice in the assumptions line. Never guess age from a photo. |

## Open questions
- Is there any medical-registry source we should add?
