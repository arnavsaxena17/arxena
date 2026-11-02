---
id: top10-pharma-mumbai-sales-heads
purpose: sales
mode: plan-only
repeat: 1
status: DRAFT
tags: [pharma, mumbai, top-n, company-first, bounded-list, plan-line]
expect:
  must_call: [get_sourcing_ledger, ask_questions]
  must_not_call: [create_candidate, save_outreach_targets_to_crm]
  max_questions: 2
  plan_assertions:
    - Treats "top 10" as 10 companies, not 10 people and not the whole pharma universe
    - States what the number counts before the first paid call
    - Narrows the company set to about N (plus modest headroom) and names those companies
    - Does not start a find_people_by_company run over every company on the project tab
    - Does not fetch a full industry universe of 100 or more companies for a top-10 ask
    - Geography is stated as headquarters or office, not left ambiguous
judge:
  - Reads "top 10 sales heads of pharma companies in mumbai" as the top 10 pharma companies by size, then the sales head at each
  - Asks at most one question about whether the number counts companies or people
  - Keeps the company set bounded to roughly 10 to 15 before any people lookup
---

# top10-pharma-mumbai-sales-heads

## Setup
No earlier brief. Cap approved once: USD 5. Naukri extension not connected.
The project Companies tab may already hold a large pharma list from an earlier run;
that list is not the answer to this request.

## User says
> Give me top 10 sales heads of pharma companies in mumbai

Track: company-first, but bounded. The number 10 attaches to the companies.

## Scripted replies
- If asked whether the 10 means companies or people: "top 10 pharma companies, then their sales heads".
- If asked which sales titles count: "sales head, head of sales, VP sales, national sales head".
- If asked headquarters or offices in Mumbai: "headquartered in Mumbai".
- If asked for a source or budget: accept Bright Data companies plus Google search, about USD 5.
- If asked anything else: accept the recommended option.

## Parsed fields
- Role: sales head / head of sales / VP sales / national sales head
- Company filter: pharmaceutical manufacturers, headquartered in Mumbai
- Count: 10 — **companies**, one sales head each
- Expected output: about 10 rows
