---
id: plant-head-chemical-gujarat-source-mix
source_line: 68
function: Manufacturing Operations
level: Leadership Level
purpose: recruiting
mode: plan-only
repeat: 3
status: DRAFT
tags: [leadership, manufacturing, location, source-selection]
expect:
  must_call: [get_sourcing_ledger]
  must_not_call: [create_candidate, create_one_company, save_outreach_targets_to_crm]
  max_questions: 4
  plan_assertions:
    - the plan names at least two sources and gives a reason for each
    - Naukri Resdex is considered because the extension is connected
    - age is not used as a filter on any source, and the assumptions line says the age cap was ignored
    - no fitment criterion is about age, pay or notice period (they are later checks)
judge:
  - States why more than one source is used for this seniority and region
  - Treats Naukri rows as entering at the profile or CV level and scores them after upload
  - Does not promise coverage it cannot verify
---

# plant-head-chemical-gujarat-source-mix

## Setup
No earlier brief. Cap approved once: USD 5. Naukri extension is connected and the user is on a Resdex page.

## User says
> Plant heads from chemical manufacturing - Gujarat - ISO certifications - 18-25 years, ₹25-45L, 90 days, age 45-58, plant head means living in Vapi/Ankleshwar which families reject for education/lifestyle reasons

Track: people (designation + industry + region).

## Scripted replies
- If asked for a target count: "40".

## Parsed fields (from the table)
- Experience: 18-25 years  |  CTC: ₹25-45L  |  Notice: 90 days  |  Age: age 45-58
- Reality-check clause: plant head means living in Vapi/Ankleshwar which families reject for education/lifestyle reasons

## Constraint map (the core assertion)
| Constraint | Class | Expected handling |
| --- | --- | --- |
| Title: plant head | SEARCH + SNAPSHOT | Synonyms such as works head, site head |
| Industry: chemical manufacturing | SEARCH + SNAPSHOT |  |
| Location: Gujarat (Vapi, Ankleshwar and others) | SEARCH + SNAPSHOT | State the city list used |
| ISO certifications | PROFILE / CV | Keyword evidence |
| Experience 18-25 years | PROFILE |  |
| Families reject Vapi/Ankleshwar | CV_CONV | Relocation willingness: conversation only |
| Age 45-58; notice 90 days; CTC INR 25-45L | SENSITIVE / CV_CONV | Age policy: ignore by default; never a filter unless the user states a hard cap more than once. State the choice in the assumptions line. Never guess age from a photo. |

## Open questions
- Hypothesis to test live: plant-level talent is better covered on Naukri than on LinkedIn.
