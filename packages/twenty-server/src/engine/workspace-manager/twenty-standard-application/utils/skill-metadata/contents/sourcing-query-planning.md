## Query planning

Break the request into queries before the first search, then measure before you scale.

### Build the queries

1. **Track**: companies, people, or people at named companies (the Plan table).
2. **One query = title words + industry + geography.** Expand titles with the synonym ladders in `playbook-shortfall` (loaded with this path). State the city list you expand to ("tier 1 = Mumbai, Delhi NCR, Bangalore, Hyderabad, Chennai, Pune, Kolkata, Ahmedabad").
3. **Slice a big request** by city and title band so each slice stays under the source's cap (see its "Limits and exhaustion").
4. **Variants.** Write two or three versions of the main query that differ by one word or phrase (a synonym, the industry term, with or without a skill word). One word can change the yield a lot, so do not assume.

### Dipstick

Use when the request is ambiguous and the full run is expensive (`intent-glossary`). It is process, not knowledge: the model will not do it by default.

1. Run 2 to 4 cheap probes of about 20 to 100 rows, one per reading of the ambiguity (a title variant, an industry term, HQ against presence). Independent probes go in the same step.
2. Read the yield, not the rows (`get_sourcing_ledger`, `summarize`). Note what the market looks like: how many rows, how many duplicates, which titles and employers dominate.
3. Ask the user once, with that insight and a recommended option ("Mumbai fintech heads return 40 rows; 'India' returns 900 and mostly operations roles. Which did you mean?").

### Probe, then scale

- Run each variant once with a small budget (about 100 rows). Independent variants go in the same step.
- Score the probe rows at the snapshot stage with one column. Compare the variants on rows returned, the share that pass or are unknown, and duplicates.
- Scale the variant with the best share. Say in one line which word change made the difference.
- Quote only yields you measured. If the probe shows the reachable pool is far below the target, say so and ask (widen, relax a nice-to-have, add a source, raise the cap) before the full spend.
- A probe counts against the cap the user approved once. It needs no new approval.

### Keep the aggregate clean

Every query appends to the project's lists. Duplicates drop on append; `outreach_list` `dedupe` against the CRM before counting. Score each batch as it lands, so the count toward the target is always current.

### Evidence

{{include: evidence-ladder}}
