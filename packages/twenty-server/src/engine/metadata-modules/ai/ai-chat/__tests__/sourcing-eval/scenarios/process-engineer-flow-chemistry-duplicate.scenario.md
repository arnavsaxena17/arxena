---
id: process-engineer-flow-chemistry-duplicate
source_line: 305
function: Quality & Compliance
level: Leadership Level
purpose: recruiting
mode: plan-only
repeat: 3
status: DRAFT
tags: [duplicate, ledger, dedupe, expand-or-refresh]
expect:
  must_call: [get_sourcing_ledger]
  must_not_call: [create_candidate, create_one_company, save_outreach_targets_to_crm]
  max_questions: 4
  plan_assertions:
    - the earlier brief is read from the ledger before any new search
    - no new paid fetch happens before the duplicate decision
    - results are deduped against the CRM and the existing list
    - age is not used as a filter on any source, and the assumptions line says the age cap was ignored
    - no fitment criterion is about age, pay or notice period (they are later checks)
judge:
  - Says it recognises the earlier brief and reuses its criteria
  - Asks at most one question to confirm same or different
  - Does not rerun an identical query that would return only duplicates
---

# process-engineer-flow-chemistry-duplicate

## Setup
The same project already holds the brief from line 249 (Process engineers from specialty chemicals - Gujarat - flow chemistry), with a ledger entry, searches and 30 rows on the People tab. The user now pastes the line 305 wording.

## User says
> Process engineers from specialty chemicals - Gujarat - flow chemistry experience - 10-16 years, ₹15-30L, 60-90 days, age 35-45, flow chemistry means continuous processing but most Gujarat chemical plants are batch operations so talent pool is tiny

Track: expand or refresh.

## Scripted replies
- If asked whether it is the same requirement: "Same client, same role."

## Parsed fields (from the table)
- Experience: 10-16 years  |  CTC: ₹15-30L  |  Notice: 60-90 days  |  Age: age 35-45
- Reality-check clause: flow chemistry means continuous processing but most Gujarat chemical plants are batch operations so talent pool is tiny

## Constraint map (the core assertion)
| Constraint | Class | Expected handling |
| --- | --- | --- |
| Role, experience, CTC, notice and age identical to the earlier brief | DUPLICATE | Recognise the overlap |
| Wording differs: 'flow chemistry' vs 'flow chemistry experience' | DUPLICATE | Treat as the same criterion |
| Function label differs (R&D vs Quality & Compliance) | METADATA | Not a new requirement |
