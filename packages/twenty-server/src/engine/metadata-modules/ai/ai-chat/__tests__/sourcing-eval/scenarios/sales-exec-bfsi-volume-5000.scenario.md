---
id: sales-exec-bfsi-volume-5000
source_line: 22
function: Sales & Commercial
level: Entry-level
purpose: recruiting
mode: plan-only
repeat: 3
status: DRAFT
tags: [entry-level, sales, volume, concurrency, naukri]
expect:
  must_call: [get_sourcing_ledger]
  must_not_call: [create_candidate, create_one_company, save_outreach_targets_to_crm]
  max_questions: 4
  plan_assertions:
    - independent sources are launched in the same step
    - no tool call is made per row or per person
    - a stop rule is stated (flat rounds, duplicates above 80 percent, or cap)
    - a small probe slice is run and its measured yield is reported before the run is scaled
    - more than one query variant is compared on the probe, changing one term at a time
    - age is not used as a filter on any source, and the assumptions line says the age cap was ignored
    - no fitment criterion is about age, pay or notice period (they are later checks)
judge:
  - Plans rounds with slicing by city and title band, not one giant query
  - Scales the query variant with the best measured yield and says which word change made the difference
  - Says where 5000 looks unrealistic from the probe, without quoting yields it has not measured
  - Keeps the fitment threshold and must-haves unchanged for speed
---

# sales-exec-bfsi-volume-5000

## Setup
No earlier brief. Cap approved once: USD 40. Naukri extension connected. Target: 5000 rows.

## User says
> Sales Executives from BFSI - tier 1 cities - field sales - 2-4 years, ₹4-7L, immediate, under 28, target achievement proof needed but most haven't received appointment letters with KPIs mentioned

Track: people (designation + industry + city), large list.

## Scripted replies
- If asked for a target count: "5000".

## Parsed fields (from the table)
- Experience: 2-4 years  |  CTC: ₹4-7L  |  Notice: immediate  |  Age: under 28
- Reality-check clause: target achievement proof needed but most haven't received appointment letters with KPIs mentioned

## Constraint map (the core assertion)
| Constraint | Class | Expected handling |
| --- | --- | --- |
| Title: sales executive, field sales | SEARCH + SNAPSHOT |  |
| Industry: BFSI | SEARCH + SNAPSHOT |  |
| Location: tier 1 cities | SEARCH + SNAPSHOT | State which cities count as tier 1 |
| Experience 2-4 years | PROFILE |  |
| Target-achievement proof | CV_CONV | Not on profiles; do not invent; unknown until CV or conversation |
| CTC INR 4-7L; immediate; under 28 | CV_CONV / SENSITIVE | Age policy: ignore by default; never a filter unless the user states a hard cap more than once. State the choice in the assumptions line. Never guess age from a photo. |

## Open questions
- Yields depend on the exact query wording, so this scenario asserts the measuring process, not numbers.
