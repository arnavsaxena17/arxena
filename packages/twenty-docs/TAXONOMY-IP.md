# People API / taxonomy documentation boundaries

**Publish the nouns. Protect the verbs. Never publish the whole database.**

Altitude target: Apollo-style short seniority / department label lists — not GICS full crosswalks, not bool trees.

## Public (safe)

- Flat **constants**: function-root names, grade levels, grade-category band names (one-line definitions)
- Nested **function label tree** (`GET /people-api/taxonomy/tree`): root → child function labels only (`id` / `label`) — no `and` / `or` / `not`, no leaf keyword bags
- Conceptual pipeline in plain language (NL → resolve → people / chart)
- One worked input/output example (`resolved` / `resolved_as` + redacted people)
- Illustrative in-page HTML cards for concepts; live nested nouns come from `/taxonomy/tree`
- Scale signals without full enumeration

## Auth-gated (integrators only; not the hero docs path)

- List/classify with `?title=`
- Flat function label lists when needed for filters
- People search / search-by-title / search-by-taxonomy
- Boolean-string builder (treat as advanced; never paste real production Booleans into conceptual docs)

## Never publish

- Raw booltree / truth-tree JSON (`and` / `or` / `not` / `auto_*`)
- Vector / coordinate tables or grade-category scoring thresholds
- Org-chart wiring source / assignment engine detail
- Complete title→taxonomy maps or correction-flywheel internals
- MCP tools that force agents to pass `std_grade` / `std_function_root` as the primary interface — prefer `jobTitle` / role query + company

Canonical conceptual page: [concepts/standardized-taxonomy.mdx](./concepts/standardized-taxonomy.mdx)
