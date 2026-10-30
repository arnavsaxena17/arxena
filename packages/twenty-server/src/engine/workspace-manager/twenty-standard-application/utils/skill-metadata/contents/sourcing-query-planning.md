## Query planning

Break the request into queries before the first search, then measure before you scale.

### Build the queries

1. **Track**: companies, people, or people at named companies (the Plan table).
2. **One query = title words + industry + geography.** Expand titles with the synonym ladders in `playbook-shortfall` (loaded with this path). State the city list you expand to ("tier 1 = Mumbai, Delhi NCR, Bangalore, Hyderabad, Chennai, Pune, Kolkata, Ahmedabad").
3. **Slice a big request** by city and title band so each slice stays under the source's cap (see its "Limits and exhaustion").
4. **Variants.** Write two or three versions of the main query that differ by one word or phrase (a synonym, the industry term, with or without a skill word). One word can change the yield a lot, so do not assume.
5. **Exhaustive: record the plan.** Write the queries you will run into the brief (`get_sourcing_ledger` `brief.queries`: source, query, slice, entity) before the first search. Run every one. The ledger's `coverage.frontier.unattempted` is the stop condition, not the target; a query counts only once its list is attached to the project.

### Dipstick

Use when the request is ambiguous and the full run is expensive (the intake gate). It is process, not knowledge: the model will not do it by default.

1. Run 2 to 4 cheap probes of about 20 to 100 rows, one per reading of the ambiguity (a title variant, an industry term, HQ against presence). Independent probes go in the same step.
2. Read the yield, not the rows (`get_sourcing_ledger`, `get_outreach_tab` with `summarize`). Note what the market looks like: how many rows, how many duplicates, which titles and employers dominate.
3. Ask the user once, with that insight and a recommended option ("Mumbai fintech heads return 40 rows; 'India' returns 900 and mostly operations roles. Which did you mean?").

### Probe, then scale

- Run each variant once with a small budget (about 100 rows). Independent variants go in the same step.
- Score the probe rows at the snapshot stage with one column. Compare the variants on rows returned, the share that pass or are unknown, and duplicates.
- Scale the variant with the best share. Say in one line which word change made the difference.
- Quote only yields you measured. If the probe shows the reachable pool is far below the target, say so and ask (widen, relax a nice-to-have, add a source, raise the cap) before the full spend.
- A probe counts against the cap the user approved once. It needs no new approval.

### Large lists

About 1,000 rows or more. One query will not reach it, and rows keep arriving while you score.

1. Build the slices (by city and title band), two or three variants, and a probe, as above.
2. Ask once for the target, the caps and the rubric (`scoring`). That yes covers every slice inside the caps.
3. Launch the independent slices in the same step. Never one call per row or per person.
4. Score each batch at the snapshot stage as it lands, with one column. Fetch profiles only for rows that passed or are unknown, and only as many as the target needs.
5. After each round report one line per slice: rows, the pass-or-unknown share, duplicates, spend. Drop a slice whose share is far below the others and give its budget to the best one.
6. Stop on the rules in `playbook-shortfall` (a source's cap, duplicates above 80%, flat rounds, the spend cap) or when the target is met at the fitment threshold. Never lower the threshold or a must-have for speed.
7. If the probe says 5,000 is not reachable, say so before the full spend and offer the choices.

### Keep the aggregate clean

Every query appends to the project's lists. Duplicates drop on append; `outreach_list` `dedupe` against the CRM before counting. Score each batch as it lands, so the count toward the target is always current.

### Evidence

{{include: evidence-ladder}}
