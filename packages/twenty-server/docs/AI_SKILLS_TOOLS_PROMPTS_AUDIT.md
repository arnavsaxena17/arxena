# Skills, tools and prompts: inventory, findings and proposal

Scope: Ask AI chat, the workspace `/mcp` endpoint, and the server-side LLM
features that turn natural language into searches. Numbers come from the code
and from the database on 2026-10-13. Token figures use 4 characters per token
and are estimates (±15–20%).

Worked example throughout: chat `493be3f7` ("MD/CEO of the first 5 companies"):
21 tool calls, 11 model calls, about 250k input tokens, and a wrong query
("CEO or founder of …") that dropped "MD".

---

## 1. Inventory

### 1.1 Skills (26 files, 204k characters, about 51k tokens)

Two source locations, one DB copy per workspace (22 skills after merging).

| Skill | Source | Tokens | Purpose |
|---|---|---|---|
| search (5 parts: preamble, companies, list-building, people, linkedin-harvest) | `twenty-shared/src/outreach/skills` | ~15,400 | company and people sourcing, Bright Data, LinkedIn, Harvest |
| outreach | same | ~4,400 | harvest, enrol, sequencers, messaging |
| ai-filter-enrich | same | ~3,600 | AI columns over the tab |
| org-structure-insights | same | ~2,000 | org chart lookups |
| setup | same | ~1,700 | ICP and send preferences |
| spreadsheet-import | same | ~1,100 | import CSV/Excel into project tabs |
| local-business-search | same | ~530 | Google Maps places |
| resolve-company-name | same | ~420 | raw name to canonical company |
| workflow-building | `twenty-server/.../skill-metadata/contents` | ~4,350 | generic workflows |
| dashboard-building | same | ~2,900 | dashboards |
| workspace-demo-seeding | same | ~2,900 | demo data |
| data-manipulation | same | ~2,600 | CRM record recipes |
| code-interpreter | same | ~1,750 | sandbox usage |
| view-building, view-filters-and-sorts | same | ~1,200 each | views |
| pptx, docx, pdf, xlsx | same | ~700–1,100 each | document generation |
| metadata-building, custom-objects-cleanup, research | same | 180–750 | misc |

### 1.2 Tools

| Layer | Count | Where | Reached by |
|---|---|---|---|
| Core meta tools | `learn_tools`, `execute_tool`, `load_skills`, `ask_questions`, `get_tool_catalog` | `core-modules/tool-provider/tools` | model directly |
| MCP-only | `search`, `fetch`, `list_skills`, `list_object_metadata_names` | `api/mcp/tools` | MCP clients |
| Native action tools | 23 | `core-modules/tool/tools/*` (22 dirs), registered in `ActionToolProvider` | `execute_tool` |
| Generated CRUD | 15 objects × operations | `DatabaseToolProvider` | `execute_tool` |
| Workflow, metadata, view, dashboard, logic function, navigation, webhook | 7 providers | `tool-provider/providers/*` | `execute_tool` |
| Arxena library | 108 defined in 18 files; 89 in `ARXENA_TOOL_CATALOG` (prospecting 42, accounts 15, enrichment 14, outreach 12, orgchart 6) | `twenty-server/src/engine/core-modules/arxena-tools/library/tools`, catalog in `twenty-shared` | `execute_tool` via `ArxenaToolProvider` |
| External MCP servers | variable | `mcp-federation` | `execute_tool` |

Preloaded (always in the tool list): `search_help_center`, `app_exa_web_search`,
plus the four core tools.

### 1.3 `learn_tools`

`learn_tools({toolNames, aspects})` → `ToolRegistryService.getToolInfo` returns
description and JSON schema per tool; large results are spilled to a file and
replaced by compact summaries. Not-found names get "did you mean" suggestions.
`get_tool_catalog` browses by category, server or keyword. The system prompt
carries a catalog section (names or counts per category) so the model knows what
exists before calling either.

### 1.4 Prompts

| Layer | Where | Size |
|---|---|---|
| Chat system prompt | `chat-system-prompts.const.ts` (CORE 7.4k chars, CHAT_UI 2.3k, RESPONSE_FORMAT 0.9k, MCP_TRANSPORT 1.6k) | ~2.7k tokens |
| Dynamic system sections | `system-prompt-builder.service.ts`: workspace instructions, user context, connected accounts, tool catalog, skill catalog, uploaded files | ~2.6k tokens |
| Shared routing lines | `twenty-shared/src/outreach/outreach-prompt.ts` (used by chat and MCP) | ~1k tokens |
| Tool descriptions | `MCP_TOOL_DESCRIPTIONS`, `load_skills` inline, each tool's own `description` | ~1.3k tokens of definitions per request |
| Skills | section 1.1 | loaded on demand |
| Feature prompts (server-side LLM calls) | about 40 files, 373 KB: `outreach.prompts.ts` 59k, `search-parameters-prompts.ts` 39k, `workspace-modifications/.../prompts.ts` 31k, `prompting-agents.ts` 22k, `parameter-generation` 14k, `search-models` 14k, `linkedin-query-generation` agents 1–4, Bright Data planner 11k, … | n/a |

---

## 2. How the pieces link

```
User message
  └─ System prompt (CORE + routing lines + tool catalog + skill catalog)
       └─ model picks intent → load_skills([name])         ← skills (DB copy)
            └─ skill names tools → learn_tools([...])      ← registry schemas
                 └─ execute_tool({toolName, arguments})
                      └─ ToolRegistryService.resolveAndExecute
                           └─ ToolExecutorService.dispatch → provider
                                ├─ native provider → Tool class (in-process)
                                └─ ArxenaToolProvider → ArxenaMcpBridgeService
                                     → arxena-tools/library handler
                                       → HTTP call back to this same server
                                         → REST controller → service/tool
```

Skill content path: `skills/*.md` → `outreach-skill-markdown.generated.ts`
→ `loadStandardSkillContent` → standard flat skill metadata → **DB copy per
workspace** (this is what `load_skills` reads) → refreshed by an upgrade
command.

Skill-to-tool links are free text: a skill names tools in backticks, the model
passes those names to `learn_tools`, and nothing checks that they exist.

---

## 3. How the tasks actually run (chat `493be3f7`)

1. `load_skills(["search"])`: 14k tokens, of which about 3k apply to the task.
2. `learn_tools` ×2, `get_outreach_tab`, `extract_json_paths`.
3. Five parallel `search_bright_data_business` calls, each of which runs a
   planner LLM call, probes shards, bills, judges relevance.
4. Verify, retry with legal/parent names by hand (3 more calls), verify again.
5. Eleven model calls re-sent the system prompt, tool definitions and the 14k
   skill text each time.

The skill told the model to write `"CEO or founder of <company> <country>"`
(`search-people.md`, "Role at named companies", step 2). The planner then
expanded titles in a single unchecked LLM call. The shared
`job-title-expander` and `query-constructor` were not involved.

---

## 4. Redundancies and drift

| # | Finding | Evidence |
|---|---|---|
| 1 | **Skill text lives in four places**; each edit needs an upgrade command to reach workspaces | md → generated.ts → flat metadata → DB; 32 skill-sync/backfill commands under `upgrade-version-command` |
| 2 | **The same rule is written in five places** | "Role at named companies" appears in `outreach-prompt.ts` (routing line), `search-preamble.md` (default-provider rule), `search-people.md` (full section), the tool description's `autoExecute` text, and CORE via routing lines. The routing line says CEO/founder/MD; the section's query template says "CEO or founder". |
| 3 | **Bright Data search is described in five places** | MCP tool definition, NestJS `SearchBrightDataBusinessTool.description`, `search-preamble`, `search-companies`, `search-people`, `search-list-building` |
| 4 | **Six separate "natural language to structured search" LLM pipelines** | Bright Data ludicrous planner; `candidate-search` query-constructor + title/company expanders + `search-parameters-prompts`; `linkedin-query-generation` agents 1–4; LinkedIn x-ray parser; `people-api` natural-language parse; `search-models`. None share title expansion. |
| 5 | **Two routers plus a third description** for "which skill to load" | CORE routing lines, the skill catalog, and the `load_skills` tool description ("START HERE …") |
| 6 | **Same capability in the Arxena library and as native tools** | e.g. `outreach_list`, local business search, LinkedIn/WhatsApp messaging exist both in `twenty-server/src/engine/core-modules/arxena-tools/library/tools` and in `core-modules/tool/tools` |
| 7 | **Self-HTTP loop** | every Arxena tool call goes library handler → HTTP to the same server |
| 8 | **Catalog and library disagree** | 26 library tools are not in the catalog (browser-extension tools for Naukri/Resdex, legacy `linkedin_*`, query generators, WhatsApp); 7 catalog tools (`linkedin_unipile_*`) are not in the library |
| 9 | **Two preload lists, mismatched names** | `COMMON_PRELOAD_TOOLS` vs `AI_CHAT_TOOL_NAMES_TO_PRELOAD`; the latter names `app_exa_web_search`, skills say `exa_web_search` |
| 10 | **Skills mention names that are not tools** | `save_to_crm` (an `outreach_list` action) and `exa_web_search` (name mismatch). Other unmatched names (`create_*`, `*_workflow*`, dashboard) are likely generated by providers; I did not verify each. |
| 11 | **Static context cost** | ~6.6k tokens of system prompt and tool definitions on every call; skills add 1–15k and are re-sent every step |
| 12 | **Prompt size without limits** | no test fails if a skill or the system prompt grows |

Verbatim duplication is low (one repeated paragraph across skills). The
redundancy is conceptual: the same decision or procedure re-stated in several
places, which then drift.

---

## 5. Proposal

### 5.1 One manifest per skill, everything else generated

Each skill gets front matter:

```yaml
name: find-people-at-companies
description: CEO / MD / founder / any role at named companies
triggers: ["get the CEO of each company", "founders of these"]
tools: [search_bright_data_business, google_serp_search, get_outreach_tab]
sections: [...]
```

Generate from the manifests: the routing lines, the skill catalog, the
`load_skills` description, and a tool→skill index. CI checks: every tool named
in a skill exists, every catalog tool is used by a skill or tagged `internal`,
and no skill exceeds its token budget. This removes findings 2, 5, 8, 9, 10, 12.

### 5.2 Serve standard skills from code, not from a per-workspace DB copy

Read standard skills from the deployed build; keep the DB only for custom
skills and workspace overrides. Edits then ship with the release and the sync
commands stop being needed. (Finding 1.) Risk: a migration for workspaces that
edited a standard skill; handle by treating an edited copy as an override.

### 5.3 Split by task and load by section

- Break `search` (15k tokens) into task skills: `find-people-at-companies`
  (~1.5k), `search-people`, `search-companies`, `build-target-list`,
  `linkedin-harvest`, each loaded alone.
- Add `load_skills({name, sections})` so a skill can return only what applies.
- For chat `493be3f7` this removes about 11–12k tokens from every one of the
  11 steps, around 130k tokens of the 250k.

### 5.4 Move deterministic procedure out of prose and into tools

The "Role at named companies" recipe is a fixed procedure the model re-runs by
hand. Make it one server tool:

`find_role_at_companies({companies[], roles[], location, sources})`

- Expands roles in code (a synonym table: CEO, Chief Executive Officer,
  Managing Director, MD, Founder, Owner, …), so the user's wording is never
  dropped.
- Resolves company name variants (brand, legal, parent) in code.
- Runs Bright Data people search and the Google SERP people search
  (`site:linkedin.com/in …`) in parallel for each company.
- Verifies the company and title match (the logic already exists in
  `OrgChartBrightDataPeopleService`), merges by LinkedIn URL, returns a table
  with the source of each row and a "no match" list.

This replaces about 15 model-driven calls with one, and puts correctness in
tested code instead of in a skill. The skill shrinks to a few lines.

### 5.5 One search-intent compiler instead of six parsers

A single service turns a request into a structured intent (roles, companies,
geography, seniority), with shared title expansion and company-variant
resolution, then provider adapters (Bright Data, Apollo, LinkedIn, SERP)
translate it. The Bright Data planner keeps only its shard-and-sample logic.
Retire the unused parsers (`parameter-generation.prompt.ts` has no importers).
Finding 4.

### 5.6 One tool registry, one execution path

- A single manifest lists every tool with `{owner, visibility: agent|internal|extension, skill}`; the catalog,
  preload list, MCP exclusions and `get_tool_catalog` derive from it. Findings 8, 9.
- Move Arxena library handlers behind Nest services and call them in-process;
  drop the HTTP hop. Finding 7.
- Resolve each native-vs-library duplicate to one implementation. Finding 6.

### 5.7 Prompt layering rules

| Layer | Holds | Does not hold |
|---|---|---|
| System prompt | identity, plan→skill→learn→execute, output format, safety | tool recipes, provider specifics |
| Tool description | what the tool does, parameters, one example | multi-step procedures |
| Skill | procedure, decision rules, when to use which tool | tool schemas, internals of server code |
| Server feature prompt | one LLM job each, next to its service, with an eval | duplicated parsing rules |

Token budgets enforced in CI: system prompt, per-skill, per-tool description.

### 5.8 Measure it

Ship the tool I/O logging and token breakdown (done / designed), then add
per-skill load counts and tokens, and a small eval set (e.g. this chat's
request: right roles in the query, right company on each row, tool calls,
tokens).

### 5.9 Suggested order

1. Token breakdown logging and CI budgets (small, gives the baseline).
2. Manifest and generated routing/catalog, with the tool-name checks (low risk, fixes drift).
3. Split `search`, add section loading (largest immediate token saving).
4. `find_role_at_companies` with Bright Data + SERP (fixes the quality problem from the example chat).
5. Serve skills from code and retire the sync commands.
6. Search-intent compiler and removal of the unused parsers.
7. Registry unification and removal of the HTTP loop.

### 5.10 Expected effect on the example chat (estimates)

| | Now | After steps 1–4 |
|---|---|---|
| Tool calls | 21 | about 6 |
| Model calls | 11 | about 4 |
| Input tokens summed over the turn | ~250k | ~50–60k |
| Roles searched | CEO, founder (MD dropped) | all roles the user named, expanded in code |

## 6. Not verified

- Whether the DB copy of a skill ever diverges from the build output beyond what the sync commands overwrite.
- Which of the six parsers are live in production paths; only import counts were checked.
- The `assistant/mcp-in-process-tool-runner.service.ts` path appeared in searches but was not traced; it may be a further execution route.
- Token numbers are estimates; the logging work will replace them with measured values.

---

## 7. Status

| Item | State |
|---|---|
| Token breakdown and tool I/O logging | Done (`TOKEN_BREAKDOWN_LOG`, `TOOL_IO_LOG`) |
| 1. Manifest per skill | Partly: CI checks for tool names and token budgets exist (`skill-content-integrity.spec.ts`); front-matter manifest and generated routing/catalog not built |
| 2. Serve standard skills from code | Done for content: `SkillService` overlays the code version on stored standard skills, so edits ship with the build. Names and descriptions still come from the database; new standard skills still need a backfill command |
| 3. Split `search`, load by section | Done: `load_skills({skillNames, sections})`, sections `companies`, `list-building`, `people`, `linkedin-harvest`; role lookup loads about 5.5k tokens instead of 15.4k |
| 4. `find_role_at_companies` | Done: native action tool, Bright Data + Google in parallel, company and title verification, writes the People tab. Not yet run against live Bright Data |
| 5. One search-intent compiler | Not started |
| 6. One registry, no HTTP loop | Not started |
| 7. Layering rules in CI | Token budgets per skill and per section only |

Known unrelated failure: `fetch-linkedin-activity-tool.spec.ts` expects `{ limit: 5 }` but the tool now also passes `cacheIdentifiers`.

Role matching uses the arxena-site job-title taxonomy (`/api/title-taxonomy/classify-titles` and `/manual-boolean-queries`) instead of a hand-kept alias table. If that service is down, the tool falls back to the roles as typed.

---

## 8. What the system prompt is for, how it does it, and better ways

Source: `chat-system-prompts.const.ts` (CORE, CHAT_UI, MCP_TRANSPORT, RESPONSE_FORMAT) plus `system-prompt-builder.service.ts`.

| # | Goal | How the prompt achieves it today | Better way |
|---|---|---|---|
| G1 | Keep context small: don't load every tool and skill | Plan→Skill→Learn→Execute ritual; "learn only tools you will run"; catalog and skill list in the prompt | Keep the lazy-loading idea. Make it enforced, not advised: `execute_tool` already redirects uncallable calls to `learn_tools` (`guide-uncallable-tool-calls-to-meta-tool`); do the same for "specialised tool without a loaded skill". Auto-attach the skill's sections when its tools are learned |
| G2 | Route intent to the right skill | Routing lines (shared builder) + CORE bullets + CHAT_UI bullets + skill catalog + `load_skills` description | Generate from skill manifests (5.1). One router, not four |
| G3 | Correct tool-call syntax (filters, FULL_NAME, phones, relation IDs, upsert vs update, group_by) | About 3k chars of prose in CORE under "Database vs HTTP Tools" | Move into the tool schemas and descriptions (`find_many_*` filter shape is a schema fact); validate and return a corrective error naming the right shape. Prose rules cost tokens on every call; schema errors cost tokens only on failure |
| G4 | Data efficiency: small limits, filters, batching | Prose rules | Enforce defaults in the tools (default `limit`, required `select`, cap with a "truncated, use filter" hint) |
| G5 | Don't hallucinate record links or IDs | RESPONSE_FORMAT rules | Keep the rule, but have the tool layer render `[[record:...]]` strings and reject unknown ones in a post-check; the model then only copies |
| G6 | Handle large tool outputs | CHAT_UI "spilled outputs" rules; spill service | Fine as is; move the rule text next to the spill tool descriptions (`extract_json_paths`) |
| G7 | Ask when ambiguous, don't when obvious | `ask_questions` rules (CHAT_UI) | Fine; shorten. Put the CSV/top-N exceptions into the skills that cause them |
| G8 | Same behaviour in chat and MCP | One CORE, transport-specific tails | Good structure. Anti-bloat list in MCP_TRANSPORT is mostly G1 restated; fold it into G1's enforcement |
| G9 | Outreach policy: destination verbs, don't enrol before confirmation, complete requests | `OUTREACH_*_PROMPT` constants from `twenty-shared` | These are policy, not prose: gate `outreach_save_to_crm` / enrol on a confirmation flag in the tool; keep one line in the prompt |
| G10 | Domain primitives often confused (favourites, nav items) | Two bullets in CORE | Belong in the navigation tool description. Remove from CORE |

Summary: about half of CORE is tool-usage rules that belong in schemas, descriptions or validation. The prompt should keep identity, the lazy-load loop, output format and safety, per 5.7.

### Caveats from re-checking this audit

- Finding 9: only `COMMON_PRELOAD_TOOLS` exists in non-test source now; `AI_CHAT_TOOL_NAMES_TO_PRELOAD` is gone, so the mismatch is likely already fixed. The `exa_web_search` vs `app_exa_web_search` name check is still worth confirming.
- Skill sync/backfill commands: 36 skill-named files across upgrade-version directories (finding 1 says 32).

## Skill front matter and playbooks (built)

Each shared skill file starts with YAML front matter (`description`, `priority`,
`routes[{when, sections?, hint?}]`, optional `label` and `icon`). The generator
validates it, strips it from the served text and resolves `{{include: name}}`
fragments. The routing lines in the system prompt and the catalog descriptions of
the eight core skills are generated from it and match the former hand-written
text exactly.

A **playbook** is a markdown file with front matter that is not one of the core
skills. It needs no label constant, UUID, metadata entry, routing line or upgrade
command: the server registers it, derives its identifier from the name, routes to
it, and serves it from the file even before the workspace has a stored row.
Playbooks default to a 1,500-token cap. How to write one: `skills/README.md`.

First playbook: `find-role-at-companies` (about 640 tokens). Moving "Role at named
companies" out of the `search` skill took the role lookup from about 5,500 tokens
of context to about 640.

## Consolidation into twenty-server (done)

- `twenty-mcp-server` no longer exists. Its 41 source files are
  `src/engine/core-modules/arxena-tools/library`, compiled with the server. The
  bridge imports it directly: no separate build, no `dist` path lookup, no
  `MCP_TOOL_LIBRARY_PATH`, nothing to stream in the deploy scripts.
- All skills are markdown files in
  `src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/contents`,
  read at runtime by `skill-library.ts` (front matter via the `yaml` package,
  `{{include}}` fragments, section selection, generated routing lines). The
  generator script and the generated TypeScript file in `twenty-shared` are gone.
- `twenty-shared/outreach` is gone. The tool catalog, the tool descriptions and
  the search-tools config moved to `arxena-tools/constants` and
  `arxena-tools/utils`, next to the only code that uses them.
