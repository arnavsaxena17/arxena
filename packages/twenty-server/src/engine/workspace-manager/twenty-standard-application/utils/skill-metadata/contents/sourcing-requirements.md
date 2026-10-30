## Requirements

Settle the brief before the first search, with as few questions as the request allows. Sort every open point first (see **Ask, decide or look up** above).

### The brief

- **Type** of request (one of the six below) and the **target** count. A role plus an industry and country is `company_list`, not a new type. A company-first run has no row target: its size is the company list, so leave `target` null and confirm the companies instead.
- **Who or what**, in the user's words, and the **criteria**: must-have (a stated attribute) or nice-to-have ("preferably", "ideally").
- **Geography** and **exclusions**.
- **Caps** in USD (fetch, enrichment and run), once. An exhaustive run needs `capsUsd.run`: the total it may spend.
- **Coverage**: `best_effort` (default) or `exhaustive`, only when the request implies completeness. See below.
- **Destination** (the project; it is in the browsing context).
- **Assumptions**: the defaults you chose. Say them to the user in one line.
- **Data sources**: which sources the user lets this run use (below).
- For a role at a set of companies, also: **persona** (`sales`: decision-makers to sell to; `exec_search`: candidates or the incumbent) and **target type** (`decision_maker`, `incumbent`, `candidate_pool`). Decide both from the wording; ask only when a wrong guess would waste the run.

State the brief in a few lines, ask only what is missing in one batch (at most four questions, each with a recommended option; free text is always allowed), then call `get_sourcing_ledger` with `brief` so the final report can quote it. `brief` is an object (`requestType`, `target`, `who`, `criteria`, `geography`, `capsUsd`, `coverage`, `universe`, `queries`, `assumptions`, `persona`, `targetType`, `roles`, `ladder`, `sources`, `confidential`); a plain prose string is also accepted as `briefText`. A later `brief` is merged over the latest one: pass only what changed.

### Coverage

Ask coverage and its run cap as one question; they replace the target count on an exhaustive run.

- `best_effort` stops at the target. `exhaustive` stops when every planned query ran and every company x role pair is terminal, or `capsUsd.run` is spent.
- Exhaustive needs a bounded universe (`universe {kind, count}`): the project list, a saved view, a frozen lens set. If the user cannot bound it, propose a scope and count first. A second exhaustive run on the same project starts with `newRun: true`; raising a cap mid-run keeps the spend.
- Exhaustive runs every planned source and query; a fallback chain is best effort, not coverage.
- Population exhaustive: write `queries[]` (source, query, slice, entity) before the first search; the ledger returns `coverage.frontier.unattempted`. A query counts only once its rows are on the project tab, so plan tab-writing searches (index, Bright Data, LinkedIn, Harvest, Apollo); a SERP probe is a step inside one, not a planned query.
- Company-first exhaustive: the universe is the confirmed company list; `pairs` is the coverage, one per company × role. Do not ask for a row target. A named industry in a named country is a universe even without the word "all": offer all (with a cap) and top N, and never default silently to a slice.
- Report coverage first, from the ledger. Never say MECE unless the universe was frozen and every planned query ran.

### Data sources

Ask once, at the start, in the same `ask_questions` batch: "Which data sources should I use for this search?" Multi-select, with cost and speed on each option. Offer only sources whose tool is in the catalog (the workspace's provider flags switch the rest off), and a LinkedIn account only when one is connected. Two or three options are enough; never list a source you cannot call. Pre-select the last run's choice (`brief.sources` from `get_sourcing_ledger`); the first time, pre-select the Arxena index, Bright Data and Google search.

| Option | Key | Companies | People | Cost / speed |
| --- | --- | --- | --- | --- |
| Arxena index | `internal-index` | Yes | No | Free, instant, shallow |
| Bright Data | `bright-data` | Yes | Yes | $0.002 per record |
| Google search (also reads company sites) | `serp` | LinkedIn URLs | LinkedIn URLs | Per query, fast |
| Harvest (Sales Navigator filters, not the user's account) | `harvest` | Yes | Yes | Paid per call |
| My LinkedIn (Sales Navigator / Classic / Recruiter) | `linkedin` | Yes | Yes | Free, slow, uses the account's daily limits |
| Apollo, Exa, Wikidata (when on) | `apollo`, `exa`, `wikidata` | Varies | Varies | Per source |

Record the answer as `brief.sources` with the keys. It binds the run: a search tool for a source not picked refuses, and `find_people_by_company` skips it. Harvest, when picked, runs last in the cascade (after Bright Data and Google found nobody at the plan confidence). Ask again only when the brief changes or the picked sources clearly cannot cover it; say what is missing.

### Match the words to a filter

Before writing the plan questions, call `get_source_capabilities({ sources, entity, want, term, rawQuery })`: `want` is the parameters the user named, `term` the segment in their words, `rawQuery` their sentence. It returns which picked source has each field, the allowed values, the fields none has with the nearest stand-in (Bright Data has employee count, not revenue; Sales Navigator has revenue), and `questions[]` with the exact options and a free-text hint. Build the batch from those questions; add `allowFreeText: true` and a `freeTextHint` so the user can give the number, range or label in their own words.

### By kind of request

| Kind | Example | Defaults | Ask only |
| --- | --- | --- | --- |
| Role plus a company attribute | "VP Engineering at fintech startups in Bangalore" | Company-first: build the companies, confirm them, then one `find_people_by_company` run. Prospects unless the request says hiring | The company criteria that are not in the words: stage, size, revenue, sub-segments, geography (country-wide vs a state/cluster; local HQ only or foreign companies with local operations), and coverage all vs top N when the set is a universe; the budget once. Never a row count |
| Role plus an industry and country | "MD/CEO/heads of operations and manufacturing of glass manufacturing companies in India" | Company-first, with an exhaustive-or-top-N scope question: a named industry in a named country is a universe | Sub-segments, size band, geography and coverage first; then sources and the budget. Do not recommend ~100 companies without an "all" option |
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
