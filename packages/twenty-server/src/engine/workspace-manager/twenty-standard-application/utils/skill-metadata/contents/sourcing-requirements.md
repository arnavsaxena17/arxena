## Requirements

Settle the brief before the first search, with as few questions as the request allows. Sort every open point first (see **Ask, decide or look up** above).

### The brief

- **Type** of request (one of the six below) and the **target** count.
- **Who or what**, in the user's words, and the **criteria**: must-have (a stated attribute) or nice-to-have ("preferably", "ideally").
- **Geography** and **exclusions**.
- **Caps** in USD (fetch and enrichment), once.
- **Destination** (the project; it is in the browsing context).
- **Assumptions**: the defaults you chose. Say them to the user in one line.

State the brief in a few lines, ask only what is missing in one batch (at most four questions, each with a recommended option; free text is always allowed), then call `get_sourcing_ledger` with `brief` so the final report can quote it.

### By kind of request

| Kind | Example | Defaults | Ask only |
| --- | --- | --- | --- |
| Population | "React engineers in Mumbai" | Current roles; the workspace HQ country when none is given | The count; the seniority band if the title spans levels |
| Named role at named companies | "the CEO of each company" | Every role named and no others; up to three per company; the company's HQ country | Which roles, only for "leaders" or similar. Never which companies when the project has them |
| Company list | "QSR restaurants in India" | Headquartered in the country; skip those already in the project's unexpired lists or the CRM | The unit and the count |
| Scored list of about N | "60 multi-store Indian brands that run digital marketing" | Stated attributes are must-haves; the server's fitment threshold | Thresholds not stated and the evidence each is read from ("20 or more stores" from what); the caps, once; the count |
| Look-alikes of seeds | "more like these" | The industry, size band and geography the seeds share | Which attributes, only if the seeds differ on them |
| Expand or refresh a list | "find more" | The earlier brief from `get_sourcing_ledger`; skip everyone already in the list or the CRM | How many more |

### Ambiguous terms

Settle them with the intake gate above and `intent-glossary`.

### Age, later checks, conflicts

{{include: later-checks}}

- **Conflicts in the brief.** When two parts contradict each other or the market (a two-week joiner, "rejects experienced folks" against 15 to 18 years), name each one in the brief and ask once, with a recommended option. Do not relax anything silently.
- **A requirement already in the ledger.** If `get_sourcing_ledger` shows an earlier brief with the same role, experience and pay, say you recognise it, reuse its criteria and ask once whether it is the same. Run no paid search before the answer, and never rerun an identical query.
- **Thin coverage.** For roles whose profiles are rare (doctors, plant staff), say what you do not know about coverage and probe first (`query-planning`).

### Never ask

The `projectId` when the context has it; which source to use; whether to run a column; which model; how many rows to preview.
