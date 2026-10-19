## Playbook: when there are not enough

You are short when `get_sourcing_ledger({ projectId, target })` shows `shortfall.short` above what `expectedFromAwaitingProfile` will cover. Never fill the gap with rows that failed, with unknown rows, or by lowering the fitment threshold or a must-have.

### Order of moves

One change per round, and say what you changed in one line.

1. **Use what is already in the pipeline.** `fetch_profiles` for the rows awaiting a profile, then score the profile stage again. It is the cheapest source of qualified rows.
2. **Next slice of the same source.** The next Unipile cursor or slice, or the next Bright Data slice. Read the source's "Limits and exhaustion" before assuming there is more.
3. **Related titles.** Expand the roles with the title synonyms in the `know-seniority` section (load it). Never drop a role the user named.
4. **Adjacent industries**, then **wider geography** (more cities, then the country).
5. **The next source in Source order.**
6. **Nice-to-have criteria.** Only with the user's yes, and never a must-have.

### When to stop

- A source returned only rows already in the list (duplicate share of its last batch above 80%), or says it has no more pages: that source is exhausted for this query.
- A round added fewer than 5% of the target in qualified rows: it is flat. Two flat rounds in a row, or five rounds in all, end the search.
- The spend cap the user approved is reached.

### Stop short properly

Call `get_sourcing_ledger({ projectId, target, stoppedBecause })` with one sentence on why. Write the report from its result, not from memory:

- **Delivered:** N of M at the fitment threshold, and how many more are awaiting a profile.
- **Why short:** which limit ended it (a source's cap, duplicates, flat rounds, spend).
- **What was tried:** a short table from `searches`: source, query, rows returned, duplicates, spend.
- **What would add more, with an estimate each:** widen the geography, relax a nice-to-have, another source, or a bigger budget. The user chooses.
