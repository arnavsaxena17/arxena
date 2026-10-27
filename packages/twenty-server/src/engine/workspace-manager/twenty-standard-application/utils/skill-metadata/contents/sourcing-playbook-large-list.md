## Playbook: large list

About 1,000 rows or more. One query will not reach it, and rows keep arriving while you score.

1. Plan with `query-planning`: slices by city and title band, two or three variants, a probe.
2. Ask once for the target, the caps and the rubric (`scoring`). That yes covers every slice inside the caps.
3. Launch the independent slices in the same step. Never one call per row or per person.
4. Score each batch at the snapshot stage as it lands, with one column. Fetch profiles only for rows that passed or are unknown, and only as many as the target needs.
5. After each round report one line per slice: rows, the pass-or-unknown share, duplicates, spend. Drop a slice whose share is far below the others and give its budget to the best one.
6. Stop on the rules in `playbook-shortfall` (a source's cap, duplicates above 80%, flat rounds, the spend cap) or when the target is met at the fitment threshold. Never lower the threshold or a must-have for speed.
7. If the probe says 5,000 is not reachable, say so before the full spend and offer the choices.
