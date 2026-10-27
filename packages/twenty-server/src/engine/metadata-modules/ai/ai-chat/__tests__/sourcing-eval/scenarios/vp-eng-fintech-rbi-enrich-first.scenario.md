---
id: vp-eng-fintech-rbi-enrich-first
source_line: 30
function: Engineering & Product Development
level: Leadership Level
purpose: recruiting
mode: plan-only
repeat: 3
status: DRAFT
tags: [leadership, engineering, regulatory, enrichment, small-pool]
expect:
  must_call: [get_sourcing_ledger, preview_ai_column]
  must_not_call: [create_candidate, create_one_company, save_outreach_targets_to_crm]
  max_questions: 4
  plan_assertions:
    - a company-level enrichment column is planned before fetch_profiles
    - preview_ai_column is called once on about 10 rows, not twice
    - fetch_profiles targets pass-or-unknown rows only
    - age is not used as a filter on any source, and the assumptions line says the age cap was ignored
    - no fitment criterion is about age, pay or notice period (they are later checks)
judge:
  - Explains that the RBI requirement cannot be settled from the snapshot
  - Uses the enrichment to cut rows before paying for profiles
  - Warns that the pool is small and reports the shortfall honestly
---

# vp-eng-fintech-rbi-enrich-first

## Setup
No earlier brief. Cap approved once: USD 5.

## User says
> VP Engineering from fintech startups - Bangalore - payments/lending platform - 12-16 years, ₹50-80L + ESOPs, 90 days, under 42, RBI compliance tech experience mandatory but most have only worked on non-regulated products

Track: people (designation + industry + city).

## Scripted replies
- If asked for a target count: "25".

## Parsed fields (from the table)
- Experience: 12-16 years  |  CTC: ₹50-80L + ESOPs  |  Notice: 90 days  |  Age: under 42
- Reality-check clause: RBI compliance tech experience mandatory but most have only worked on non-regulated products

## Constraint map (the core assertion)
| Constraint | Class | Expected handling |
| --- | --- | --- |
| Title: VP Engineering | SEARCH + SNAPSHOT | Synonyms such as Head of Engineering |
| Fintech startups, payments/lending, Bangalore | SEARCH + SNAPSHOT | Industry + city in the query |
| Experience 12-16 years | PROFILE |  |
| RBI compliance tech experience: mandatory | PROFILE | Must-have; text evidence only on full profile or CV |
| Is the employer RBI-regulated (licence held)? | ENRICH | Cheap company-level column before any profile fetch |
| CTC INR 50-80L + ESOPs; notice 90 days; under 42 | CV_CONV / SENSITIVE | Age policy: ignore by default; never a filter unless the user states a hard cap more than once. State the choice in the assumptions line. Never guess age from a photo. |

## Open questions
- Which sources hold 'regulated entity' facts reliably?
