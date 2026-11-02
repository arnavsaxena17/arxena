---
id: top-n-vs-all-boundary
purpose: sales
mode: plan-only
repeat: 1
status: DRAFT
tags: [top-n, coverage, ambiguity, ask-policy, plan-line]
expect:
  must_call: [get_sourcing_ledger]
  must_not_call: [create_candidate, save_outreach_targets_to_crm]
  max_questions: 3
  plan_assertions:
    - Treats "top N" and "all" as different plans, not a format choice
    - Never defaults silently from a named count to a whole-industry universe
    - If it chooses a reading without asking, it states the count it will fetch before spending
    - The plan's company count and the number the user gave are visibly reconciled
judge:
  - The reading of the number is either asked once or stated explicitly in one line
  - Choosing "all companies in the industry" for a request that said "top 25" is a failure
  - Choosing "top 25 companies" for a request that said "all companies" is a failure
---

# top-n-vs-all-boundary

## Setup
No earlier brief. Cap approved once: USD 5. Naukri extension not connected.
This scenario exists to pin the ask rule: a reading that changes how much work
happens is not a format default.

## User says
> top 25 pharma companies in mumbai and their sales heads

Track: company-first, bounded to 25 companies.

## Scripted replies
- If asked whether 25 means companies or people: "25 companies".
- If asked all versus top 25: "top 25 only".
- If asked for a source or budget: accept Bright Data companies plus Google search, about USD 5.
- If asked anything else: accept the recommended option.

## Parsed fields
- Company filter: pharmaceutical, Mumbai
- Count: 25 — companies
- Role: not stated; the request implies the leadership of each company
