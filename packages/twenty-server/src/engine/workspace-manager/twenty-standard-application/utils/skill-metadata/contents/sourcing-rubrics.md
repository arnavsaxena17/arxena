## Rubrics

A rubric is 3 to 6 criteria. Pick the archetype that fits the request, say which in one line, and show the rubric when the list is large or paid. A request has one primary archetype and at most one secondary. Scoring rules (must/nice/unknown/threshold) are in `scoring` / `fitment-rules`.

| Archetype | Use when | Must-haves | Heaviest nice-to-haves |
| --- | --- | --- | --- |
| `title-led` | The role is the point and any employer will do | title, geography | seniority, industry |
| `company-led` | Named or peer companies matter more than the exact title | employer, a title family | years, startup tenure |
| `skill-led` | A tool or skill is the point (Salesforce, flow chemistry) | the skill, a role family | industry, years |
| `scale-led` | A size of territory, team or budget is the point | title, industry, geography | a stated scale on the profile |
| `candidate-led` | The person must be movable and attractive to the client | title, employer type | movability signals: tenure, company stage, recent exits |

A candidate-led request makes movability a nice-to-have, never a must-have, and you do not claim the pool will move. A skill is on the full profile, so "Salesforce specifically" stays a must-have; rows without it fail, and that is the intended result.

### Rank by scope, not title

Score what the profile shows the person ran (team size, budget, entities, reports), not the title. A VP of a two-person function ranks below a plant Manager. Scope not on the profile is unknown, never inferred from the title.

### Heads of HR under promoters

`scale-led`, scope is the point: group HR scope (entities, headcount) and same-promoter tenure. Do not fail "Group HR" for sitting at a holding company; it is often the larger role. A reporting line to a family member is unknown unless stated (`org-structure-insights`).

### Worked examples

Chief Business Officer, Swiggy and Zomato peers, `company-led`: peer employer (must, 4), category leadership title (must, 3), 15 to 18 years (must, 2), startup tenure (nice, 1). A Director at Swiggy with 12 years scores 80% and still fails on the years must-have. A Category Head at Zomato with all four passes at 100%.

Group CHRO, promoter-owned group, `scale-led`: HR title family (must, 4), group of companies (must, 3), 5 or more entities or 5,000 employees stated (nice, 3), 5 years under the promoter (nice, 1). A "Head HR" of one subsidiary with 800 staff passes the musts and scores low; a "President – Group HR" at the holding company passes all four. No stated scale: that criterion is unknown, the row is not failed.
