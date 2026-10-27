## Entity resolution

Rows arrive from several sources and from the CRM. Decide when two rows are the same person or company, and which source wins each field.

### Match keys, strongest first

- **People**: LinkedIn URL (normalised: no query string, no trailing slash). Without one, name and current company must both agree; name alone never matches.
- **Companies**: domain (bare host). Then LinkedIn company URL. Then normalised name with the same city. Brand, legal entity and parent are different names for one company only when the domain or URL agrees.
- Two rows that agree on name and differ on company or domain stay separate. Say how many such near-matches you left apart.

### Which source wins which field

| Field | Wins | Why |
| --- | --- | --- |
| Current role, employer | Most recent source: full profile over snapshot, experience over headline | LinkedIn lags on job changes in India |
| Location | Full profile | A snapshot may preview a stale city |
| Company facts (size, revenue, industry) | The company record or a web column, never the person's profile | Profiles state the person's view of the employer |
| Contact details | Not a sourcing field | Contact enrichment |
| Anything blank | The other source; blank is unknown, never a loss | A source that does not preview a field has not said it is empty |

When two sources disagree on a must-have, score the more recent one and name the conflict in the reason.

### Count requests

"Find me N" is three numbers. Report all three, from `get_sourcing_ledger`, not from memory:

**found** (rows returned) → **deduped** (after CRM and list dedupe, `outreach_list` `dedupe`) → **qualified** (clears the fitment threshold on its full profile).

Only qualified rows count toward N.
