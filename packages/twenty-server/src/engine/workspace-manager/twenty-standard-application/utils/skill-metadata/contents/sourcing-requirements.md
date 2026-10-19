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

**Population** ("software engineers who know React in Mumbai"). Needs a role or skill, an industry, a geography, a seniority band, a count. Defaults: current roles only; the workspace HQ country when none is given. Traps: a skill is not a title; one title spans several levels ("engineer"). Ask: the count; the seniority band if the title spans levels.

**Named role at named companies** ("the CEO of each company"). Needs the companies (the project's, or pasted), the roles in the user's words, a country. Defaults: every role they named and no others; up to three people per company; the company's HQ country. Traps: brand against legal name; "MD" as managing director or medical doctor; "leaders" and "decision makers" name no role. Ask: which roles, only if they said "leaders" or similar. Never ask which companies when the project has them.

**Company list** ("QSR restaurants in India"). Needs the industry, the geography, a size band, the unit, the count. Defaults: companies headquartered in the country; exclude those already in the project. Traps: chains against single outlets; India HQ against India presence; brands against legal entities. Ask: the unit and the count.

**Judged list of about N** ("60 multi-store Indian consumer brands that run digital marketing"). A company or population request plus a rubric. Needs each criterion's threshold and its evidence ("20 or more stores" is read from what). Defaults: stated attributes are must-haves; the fitment threshold is the server's. Ask: thresholds the user did not state; the caps, once; the count.

**Look-alikes of a seed list** ("more like these"). Needs the seed (the working set or pasted URLs) and which attributes make them alike. Default: match the industry, size band and geography the seeds share. Ask: which attributes, only if the seeds differ on them.

**Expand or refresh an existing list.** Read the earlier brief from `get_sourcing_ledger` and reuse its criteria. Default: skip everyone already in the list or the CRM. Ask: how many more.

### Ambiguous terms

When a word has two readings, ask what it means before spending anything, with the likely readings as options and the likelier one recommended. Do not ask about a word you can resolve from the workspace ICP or the project.

### Never ask

The `projectId` when the context has it; which source to use; whether to run a column; which model; how many rows to preview.
