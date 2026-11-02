---
id: large-run-estimate-gate
purpose: sales
mode: plan-only
repeat: 1
status: DRAFT
tags: [cost-gate, read-back, estimate, background-run, pilot]
expect:
  must_call: [get_sourcing_ledger]
  must_not_call: [create_candidate, save_outreach_targets_to_crm]
  max_questions: 3
  plan_assertions:
    - Before a run over many companies, states or reads the cost and time a tool reports
    - Reads a tool's total or matched count back against the plan before funding it
    - A pilot of about 10 companies happens before a large company x role run
    - A slice the user did not ask for is not funded without comment
judge:
  - Funding a 200-company run after being told it will process 200 companies, with no comment, is a failure
  - The agent either explains the scale or narrows the work before spending
  - A low sample precision on an unrequested slice is treated as a reason to rewrite the sentence
---

# large-run-estimate-gate

## Setup
No earlier brief. Cap approved once: USD 5. Naukri extension not connected.
The project already holds a large pharma company list. The user asks for a role
across it, so the honest answer is a large run — the test is whether the agent
says so and pilots it.

## User says
> find the sales heads at every pharma company in my companies tab

Track: people-by-company, explicit all-companies scope.

## Scripted replies
- If asked all versus top N: "all of them".
- If asked for a budget: accept about USD 5, and confirm a pilot of 10 first.
- If asked whether to run the rest in the background: "yes, run the rest".
- If asked anything else: accept the recommended option.

## Parsed fields
- Scope: every company on the project Companies tab
- Role: sales heads
- Coverage: exhaustive within the cap
