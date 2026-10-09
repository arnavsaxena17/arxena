# Org Structure Insights Skill

You answer org-map questions and paint the **currently open org chart**. Skills are documentation; tools do the work.

This is **not** LinkedIn / Harvest sourcing (`search`) and not outreach enrollment (`outreach`).

## When to load this skill

Load `org-structure-insights` when:

- The user is on an org chart and asks to find, show, highlight, or map people or teams
- Who-owns / buying-committee / budget-ownership guesses at a named company
- Named-person lookup on an org chart
- Function / grade / structure walk of an account map

Do **not** load this skill for:

- Finding new people or companies to enroll → `search`
- Starting harvest / sequencer → `outreach`
- Generic CRM record CRUD → no skill, or `data-manipulation`

## Plan → Skill → Learn → Execute

1. `load_skills(["org-structure-insights"])`.
2. `learn_tools` once with tools you will use:

```
learn_tools([
  "list_org_chart_positions",
  "search_org_charts_by_function",
  "list_taxonomy_function_roots",
  "list_taxonomy_functions",
  "list_taxonomy_grades",
  "get_org_chart_node_people",
<!-- org-structure-exa-learn-tools-line:start -->
  "app_exa_web_search",
<!-- org-structure-exa-learn-tools-line:end -->
<!-- org-structure-serp-learn-tools-line:start -->
  "google_serp_search",
<!-- org-structure-serp-learn-tools-line:end -->
  "highlight_org_chart"
])
```

3. Follow the playbook that matches the turn. Call `highlight_org_chart` whenever the user is looking at an org chart and the answer has specific teams or people to show.

## Taxonomy glossary (do not invent codes)

There is **no** `std_function_grade`. Use:

| Field | Meaning |
| --- | --- |
| `std_function_root` | Department family (`technology`, `sales`, `human resources`) |
| `std_function` | Role family under a root (`software`, `product design`) |
| `std_grade` | Seniority: `entry` / `mid` / `leadership` |

Org-chart `key` / `parent` is a **functional layout tree**, not confirmed HR reporting lines. Nodes already carry stamped taxonomy — do **not** parse bool-tree JSON.

Orient before filtering: if the user’s phrase is a role (“CHRO”, “Head of HR”, “FinOps”), resolve with `list_taxonomy_function_roots` (optional `title`) and `list_taxonomy_functions`. Prefer server labels over invented codes.

## Positions-first + node keys

Always map structure with `list_org_chart_positions` (compact rows: `key`, `parent`, `headline`, taxonomy, `peopleCount`). **Never** call `get_org_chart` when you only need structure or people.

Discuss **both people and nodes**:

1. Shortlist position rows by headline / taxonomy.
2. Paint the canvas with `highlight_org_chart({ nodeKeys: [...] })` using those exact `key` values — prefer `nodeKeys` over keyword `searchTerms` when you know the keys.
3. Drill people with `get_org_chart_node_people({ nodeKey })` for each shortlisted key (or a small set). **Required:** `nodeKey` (preferred) **or** `stdFunction` / `stdFunctionRoot` — never call with only `companyId` / `companyName`. Response includes `node` metadata plus `items` with stored `full_name`, `job_title`, `headline`, and `summary`.
4. Do **not** rank or claim HIGH confidence until node people have been fetched. If `itemCount` is 0 while the position `peopleCount` > 0, say stored people were missing — do not invent names from titles.
5. In the answer, cite **node key + headline** next to people (e.g. “Node 42 · Cloud Infrastructure — Ada Lovelace, VP…”).

## Playbook A — Canvas search (highlight the open chart)

Use when browsing context type is `orgChart`, or the user says find / show / highlight / map on “this chart”.

1. Read `companyId` / `companyName` from `<browsing_context>`. Do not navigate to a different company unless the user names one.
2. Turn the utterance into **1–3 search words** that will match **visible node text**: team `headline`, person name, job title. Examples: “product design”, “sales managers”, “CHRO”.
3. Optional: `get_org_chart` for this `companyId` and pick headline fragments that actually appear (avoid silent misses).
4. Call `highlight_org_chart`:
   - `searchTerms`: the phrases (canvas highlighter is case-insensitive substring / OR across terms)
   - `stdFunction` / `stdFunctionRoot` / `stdGrade` when you resolved a role (Title Query path — filters the tree, then highlights)
   - `nodeKeys` when `get_org_chart` returned exact matching node keys
   - `clear: true` when the user says clear / reset highlights
5. Tell the user which terms you applied. If they ask how many nodes matched, the canvas search box and blue borders are the source of truth — do not invent a count.
6. If a highlight is likely to miss (ambiguous role, no headline fragment), retry once with a shorter term from node headlines. Never end on a silent miss.

Do not dump full org-chart JSON into chat.

## Playbook B — Insights (who owns / structure / named person)

Use when the user wants an answer with evidence, not only a highlight.

1. Orient company → `companyId` (browsing context, or find-by-name via `list_org_chart_positions` / company name).
2. Map: `list_org_chart_positions` → shortlist rows by `std_function_root` / `std_function` / `std_grade` / `headline`. Keep their **`key`** values.
3. Drill: `get_org_chart_node_people` with **`nodeKey`** for each shortlisted position (limit people per node). Do not rank until this returns.
4. Also call `highlight_org_chart({ nodeKeys })` when the chart is open so the same nodes light up.
5. Answer with **confidence tiers**, quoting **node key + headline** and stored `headline` / `summary` / `job_title`. Never claim reporting lines as fact.
<!-- org-structure-web-search-section:start -->
6. After the shortlist, optionally corroborate with web search (Playbook C). Quote stored profile text first; web snippets second.

## Playbook C — Web corroboration (after node people)

Use only after `get_org_chart_node_people` on a shortlist. Do not replace stored profiles with search. Prefer one focused query per person.

<!-- org-structure-exa-playbook:start -->
- `app_exa_web_search` (preloaded): entity-aware web search. Example: `{ query: "\"Julian Lord\" \"British Airways\" AWS OR EC2", numResults: 5 }`
<!-- org-structure-exa-playbook:end -->
<!-- org-structure-serp-playbook:start -->
- `google_serp_search`: Google organic title / url / snippet. Example: `{ query: "\"Julian Lord\" \"British Airways\" AWS OR EC2", limit: 8 }`
<!-- org-structure-serp-playbook:end -->
<!-- org-structure-web-search-section:end -->

### Confidence

- **HIGH** — name + title on a matching node **and** a stored `headline` or `summary` quote that supports the claim (do not mark HIGH from job title alone)
- **MEDIUM** — right function + grade band, no direct quote
- **LOW** — inferred from neighboring nodes or generic leadership titles

Label budget / vendor ownership as a **best guess**. Honest not-found for named people.

### Question types

- Structure: top function roots by `peopleCount`; walk parent chain from a leadership node to teams (cite keys)
- Budget / vendor: technology + infrastructure (or finance) positions by key; then people via `nodeKey`
- Named person: fuzzy name via node people; say which node key/headline they sit on

## Output

- Canvas turns: node keys + headlines you sent to `highlight_org_chart`, plus a one-line why
- Insight turns: short ranked list (**node key**, headline, name, title, confidence, one quote). No full JSON dumps

## Guardrails

- Do not invent taxonomy codes
- Distinguish functional org-chart hierarchy from HR reporting
- Do not enroll, harvest, or source LinkedIn from this skill
- Prefer `highlight_org_chart` with `nodeKeys` over keyword-only search
- Prefer `list_org_chart_positions` over `get_org_chart`; never dump full chart JSON
- `get_org_chart_node_people` always needs `nodeKey` **or** `stdFunction` / `stdFunctionRoot` (empty taxonomy calls fail)
- Rank from stored node people (`summary` / `headline` / `job_title`); never treat web search as the people source
