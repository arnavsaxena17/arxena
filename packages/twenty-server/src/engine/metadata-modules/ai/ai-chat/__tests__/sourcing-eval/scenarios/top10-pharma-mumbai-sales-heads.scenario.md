---
id: top10-pharma-mumbai-sales-heads
purpose: sales
mode: plan-only
repeat: 1
status: DRAFT
tags: [pharma, mumbai, top-n, bounding, plan-line]
expect:
  # Two routes are correct here, and the run may take either: a bounded
  # company-first list, or one people search with the industry, city and title.
  # What must not happen is either half of the original failure: a whole-industry
  # company fetch, or a find_people_by_company run over every row on the tab.
  must_call: [search_bright_data_business]
  must_not_call: [create_candidate, save_outreach_targets_to_crm]
  max_questions: 2
  plan_assertions:
    - Reads "top 10" as a bound on the work, not a licence to fetch the whole pharma universe
    - States or asks what the number counts before the first paid fetch, when the two readings differ
    - Bounds to about 10 companies or 10 people; does not fetch 100 or more companies for a top-10 ask
    - Does not start find_people_by_company over every company on the project tab
    - Geography is stated as headquarters or office, not left ambiguous
judge:
  - Either a bounded company list (about 10 to 15 companies, then the sales head at each) or a single people search filtered by industry, city and sales title is acceptable
  - Fetching a full industry universe of 100 or more companies for a top-10 ask is a failure
  - A run over every row on the Companies tab is a failure
---

# top10-pharma-mumbai-sales-heads

## Setup
No earlier brief. Cap approved once: USD 5. Naukri extension not connected.
The project Companies tab may already hold a large pharma list from an earlier run;
that list is not the answer to this request.

## User says
> Give me top 10 sales heads of pharma companies in mumbai

Track: either bounded people search, or company-first bounded to about 10.

## Scripted replies
- If asked whether the 10 means companies or people: "top 10 pharma companies, then their sales heads".
- If asked which sales titles count: "sales head, head of sales, VP sales, national sales head".
- If asked headquarters or offices in Mumbai: "headquartered in Mumbai".
- If asked for a source or budget: accept Bright Data, about USD 5.
- If asked anything else: accept the recommended option.

## Parsed fields
- Role: sales head / head of sales / VP sales / national sales head
- Company filter: pharmaceutical manufacturers, headquartered in Mumbai
- Count: 10 — a bounded set, not the whole industry
- Expected output: about 10 rows
