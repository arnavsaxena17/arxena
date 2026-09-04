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
  "get_org_chart",
  "search_org_charts_by_function",
  "list_taxonomy_function_roots",
  "list_taxonomy_functions",
  "list_taxonomy_grades",
  "get_org_chart_node_people",
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

1. Orient company → `companyId` (browsing context, or `get_org_chart` / find-by-name).
2. Map: `get_org_chart` → scan nodes by `std_function_root` / `std_function` / `std_grade` and `headline`.
3. Drill: `get_org_chart_node_people` for shortlisted nodes only (`stdFunction`, `stdFunctionRoot`, `stdGrade`, `limit`). Do not fetch every node.
4. Also call `highlight_org_chart` when the chart is open so the user can see the same nodes.
5. Answer with **confidence tiers** and quoted evidence. Never claim reporting lines as fact.

### Confidence

- **HIGH** — name + title on a matching node, or a summary quote that names the vendor / budget
- **MEDIUM** — right function + grade band, no direct quote
- **LOW** — inferred from neighboring nodes or generic leadership titles

Label budget / vendor ownership as a **best guess**. Honest not-found for named people.

### Question types

- Structure: top function roots by headcount; walk parent chain from a leadership node to teams
- Budget / vendor: technology + infrastructure (or finance) nodes; keyword-scan summaries for vendor / decision / platform
- Named person: fuzzy name via node people or headlines; say so if absent

## Output

- Canvas turns: the search words you sent to `highlight_org_chart`, plus a one-line why
- Insight turns: short ranked list (name, title, node headline, confidence, one quote). No full JSON dumps

## Guardrails

- Do not invent taxonomy codes
- Distinguish functional org-chart hierarchy from HR reporting
- Do not enroll, harvest, or source LinkedIn from this skill
- Prefer `highlight_org_chart` over describing where to type in the search box
