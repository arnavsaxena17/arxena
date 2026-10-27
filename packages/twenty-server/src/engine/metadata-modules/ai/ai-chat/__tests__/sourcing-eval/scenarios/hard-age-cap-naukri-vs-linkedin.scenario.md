---
id: hard-age-cap-naukri-vs-linkedin
source_line: synthetic (not in the file)
function: Sales & Commercial
level: Entry-level
purpose: recruiting
mode: plan-only
repeat: 3
status: DRAFT
tags: [entry-level, age-policy, naukri, linkedin]
expect:
  must_call: [get_sourcing_ledger]
  must_not_call: [create_candidate, create_one_company, save_outreach_targets_to_crm]
  max_questions: 4
  plan_assertions:
    - the Naukri plan names the native age filter as the mechanism
    - no LinkedIn source is filtered on age or on a proxy for it
    - LinkedIn rows with no start-year or education-year data are kept as unknown, never excluded
judge:
  - Explains why LinkedIn is not age-filtered (profiles that omit the data would be silently dropped)
  - Records the hard cap in the brief with get_sourcing_ledger
  - Says that the cap is enforced where the source supports it and unknown elsewhere
---

# hard-age-cap-naukri-vs-linkedin

## Setup
No earlier brief. Cap approved once: USD 5. Naukri extension connected; LinkedIn connected.

## User says
> Sales Executives from BFSI - Mumbai - field sales - 2-4 years, ₹4-7L, immediate, under 28. [Later message] The age cap is a hard requirement. I repeat: nobody above 28.

Track: people (designation + industry + city).

## Scripted replies
- If asked for a target count: "100".

## Constraint map (the core assertion)
| Constraint | Class | Expected handling |
| --- | --- | --- |
| Title, BFSI, Mumbai, 2-4 years | SEARCH + SNAPSHOT / PROFILE |  |
| Age under 28, stated twice as a hard cap | AGE (HARD) | Use the Naukri age filter. Do not filter LinkedIn on age; rows without dates stay unknown |
| CTC INR 4-7L; immediate | CV_CONV | Unknown |

## Open questions
- Does the Resdex query delivery in the extension set the age filter today? I only saw titles and companies in deliverResdexQuery.
