A score is how well one person or company fits the user's criteria, from 0 to 100%.

Score every criterion **pass**, **fail** or **unknown**. Unknown means the data you have cannot answer it. A snapshot is partial, so most criteria beyond title, company and location are unknown there.

| Criterion | Fail | Unknown at snapshot | Unknown at profile |
| --- | --- | --- | --- |
| Must-have | Fails the row | Never a fail: the row goes to profile fetch | Fails the row |
| Nice-to-have (weight 1–4; heaviest is the archetype's point) | Ranks the row lower | Scores like a fail; say so in the reason | Scores like a fail; say so in the reason |

Nice-to-haves only rank rows that pass every must-have.

- The fitment threshold is set in code. Do not lower it or round a row up. If you cannot reach the target, return what you have and say what limited the results.
- A must-have needs evidence a profile can show. Never make a must-have of pay, notice or age (later checks). Stated title, employer, skills and years stay must-haves. Never demote a stated skill/title/employer to avoid an unknown; relaxing a must-have needs a yes. "Preferably" / "ideally" = nice-to-have.
- When the evidence does not answer a criterion, return unknown. A guess from a title, a photo or a company's reputation is worse than unknown, at every evidence level.
- Give every score a one-line reason that names the evidence.
