---
id: territory-sales-fmcg-unverifiable-revenue
source_line: 15
function: Sales & Commercial
level: Mid-level
purpose: recruiting
mode: plan-only
repeat: 3
status: DRAFT
tags: [mid-level, sales, unverifiable-claim, track-choice]
expect:
  must_call: [get_sourcing_ledger]
  must_not_call: [create_candidate, create_one_company, save_outreach_targets_to_crm]
  max_questions: 4
  plan_assertions:
    - no enrichment column attempts to compute territory revenue
    - the plan states whether it uses population search or company-first, with a reason
    - age is not used as a filter on any source, and the assumptions line says the age cap was ignored
    - no fitment criterion is about age, pay or notice period (they are later checks)
judge:
  - Says plainly that exact territory revenue cannot be verified from sourcing data
  - Moves the proof requirement to a later gate (CV or conversation) and tells the user
  - Does not invent revenue figures
---

# territory-sales-fmcg-unverifiable-revenue

## Setup
No earlier brief. Cap approved once: USD 5.

## User says
> Territory Sales Managers from FMCG - Maharashtra - 50+ Cr territory - 7-10 years, ₹10-15L, 45-60 days, age under 35, client wants proof of exact revenue numbers but companies don't share territory-wise data

Track: choice: population search or company-first.

## Scripted replies
- If asked for a target count: "60".

## Parsed fields (from the table)
- Experience: 7-10 years  |  CTC: ₹10-15L  |  Notice: 45-60 days  |  Age: age under 35
- Reality-check clause: client wants proof of exact revenue numbers but companies don't share territory-wise data

## Constraint map (the core assertion)
| Constraint | Class | Expected handling |
| --- | --- | --- |
| Title: territory sales manager; industry: FMCG; Maharashtra | SEARCH + SNAPSHOT |  |
| INR 50+ Cr territory | PROFILE / CV_CONV | Rarely stated; never estimate |
| Proof of exact revenue numbers | CV_CONV + CONFLICT | Companies do not share territory data; cannot be verified at sourcing |
| Experience 7-10 years; CTC INR 10-15L; notice 45-60; under 35 | PROFILE / CV_CONV / SENSITIVE | Age policy: ignore by default; never a filter unless the user states a hard cap more than once. State the choice in the assumptions line. Never guess age from a photo. |

## Open questions
- Which later gate owns 'proof' requirements: admission or the recruiting journey?
