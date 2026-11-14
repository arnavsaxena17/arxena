# Server domains

Domain-first layout for the Arxena product modules. Replaces the previous
`src/engine/core-modules/*` placement, where 25 unrelated modules sat beside 109
platform modules with no layer boundaries.

```
src/
├── domains/
│   ├── discovery/
│   │   ├── transport/      linkedin-search              (accounts, sessions, quota)
│   │   ├── providers/      bright-data, apify, builtwith, wikidata, theorg,
│   │   │                   theofficialboard, serp-company-search,
│   │   │                   local-business-data, contact-enrichment,
│   │   │                   web-evidence                 (was arx-web-search)
│   │   ├── search/         people-api, company-api, jobs-api, posts-api
│   │   ├── query/          title-taxonomy, linkedin-query-generation
│   │   └── warm-paths/
│   ├── planning/           candidate-search
│   ├── org-graph/          org-chart, org-chart-embed
│   ├── ingestion/          candidate-sourcing
│   ├── engagement/         outreach-command, org-chart-outreach
│   └── evaluation/         result-validation
└── engine/                 platform + upstream Twenty modules (unchanged)
```

## Dependency rules

1. Dependencies point one way only:
   `engagement → ingestion → planning → discovery → providers`.
   A domain may import a domain to its right; never to its left.
2. Do not import another domain's files directly. Import its Nest module and
   use its `exports`, or a type from `contracts/`.
3. `providers/*` are vendor adapters. They own credentials, HTTP, and payload
   normalisation. They must not know about candidates, projects, or outreach.
4. `transport/*` owns accounts, sessions, pacing, and quota. Providers used by a
   search must be reached through it, not around it.
5. Server-internal callers pass a workspace context, never a minted API token.
   (The `*-api` modules still accept a token because they are also a public HTTP
   surface; new internal callers should not use it.)
6. `forwardRef` is a signal that the seam is wrong, not a fix.

## What changed

| Was (`engine/core-modules/…`) | Now (`domains/…`) |
| --- | --- |
| `linkedin-search` | `discovery/transport/linkedin-search` |
| `bright-data`, `apify`, `builtwith`, `wikidata`, `theorg`, `theofficialboard`, `serp-company-search`, `local-business-data`, `contact-enrichment` | `discovery/providers/*` |
| `arx-web-search` | `discovery/providers/web-evidence` |
| `people-api`, `company-api`, `jobs-api`, `posts-api` | `discovery/search/*` |
| `title-taxonomy`, `linkedin-query-generation` | `discovery/query/*` |
| `warm-paths` | `discovery/warm-paths` |
| `candidate-search` | `planning/candidate-search` |
| `org-chart`, `org-chart-embed` | `org-graph/*` |
| `candidate-sourcing` | `ingestion/candidate-sourcing` |
| `outreach-command`, `org-chart-outreach` | `engagement/*` |
| `search-models` | **deleted** — no callers; see note below |
| `autonomous-recruiter` | **deleted** (cron was hardcoded off; superseded by `candidate-sourcing/run`) |

Removed along with `autonomous-recruiter`: its module registration in
`core-engine.module.ts` and `message-queue/jobs.module.ts`, the
`MessageQueue.autonomousRecruiterQueue` constant, and its worker config entry.

`search-models` was also deleted (2026-11-14): no branch — including
`search_evals` and `searchpipe` — ever called `/search-models/*`, and its prompts
only ran inside its own spec. Its registration was removed from
`core-engine.module.ts`.

Also fixed while moving:
- `jobs-api.types.ts` and `company-api.types.ts` imported `../constants/…`
  (one level too high) — a pre-existing `TS2307` in both files, now correct.
- `web-evidence` no longer needs `forwardRef(() => BrightDataModule)`.
- `candidate-search` no longer registers a dead second instance of
  `LinkedinQueryGenerationService`.

## Done after the move

1. **`discovery/search` is one module.** `search.module.ts` now owns the four
   controllers and the `DiscoverySearchModule` export surface. The data-source
   resolver is shared (`core/search-data-source.ts`) and jobs/posts/companies
   run through one `EntitySearchService`; `people-api` keeps its own body.
   Deleted: three services, three resolvers, three modules.
2. **`planning/candidate-search` no longer owns the org-chart build.** The seven
   `orgchart-*-build.processor.ts`, the chart-build/linkedin-search/query-router/
   shard-planner services, their utils, types, schema and prompt moved to
   `org-graph/org-chart/build/`. `python-query-generation` and
   `title-taxonomy-remote` moved to `discovery/query`.
3. **`org-chart-outreach` is folded into `engagement/outreach-command/icp-outreach`.**
   It no longer builds `LinkedinUnipileMessagingService`,
   `WhatsappUnipileMessagingService`, `WorkspaceMemberArxService` or
   `SendEmailFunctionality` with `new`; all four are injected.
4. **`evaluation/search-models` was deleted** (2026-11-14). It had been metered
   during the move, but no caller ever invoked its routes; its prompts ran only
   in its own spec. `evaluation/` keeps `result-validation`.
5. **Unreferenced vendor controllers are gone** — `builtwith`, `theorg`,
   `serp-company-search`. Their services stay: `BuiltWithService`,
   `TheOrgService` and `SerpCompanySearchService` are used in-process by
   `org-graph` and `people-api`.

## Done after the move

1. **`discovery/search` is one module.** `search.module.ts` owns the four
   controllers; the data-source resolver is shared (`core/search-data-source.ts`)
   and jobs/posts/companies run through one `EntitySearchService`. Deleted:
   three services, three resolvers, three modules. `people-api` keeps its body.
2. **The org-chart build belongs to `org-graph`.** 49 files moved to
   `org-graph/org-chart/build/`: the seven `orgchart-*-build.processor.ts`, the
   chart-build/linkedin-search/query-router/shard-planner services, their utils,
   types, schema and prompt.
3. **The `org-graph -> planning` cycle is closed.** `org-graph` now imports
   nothing from `planning`. What moved where:
   - `candidate-search-request.type`, `search-parameter.utils`,
     `parsed-job-description.util`, `pick-blank-grade-manual-boolean-query-item`,
     `harvest-filter-ids`, `taxonomy-platform-maps` -> `discovery/query`
   - `linkedin-parameter-resolver` + its industry schema -> `discovery/transport`
   - `result-validation` -> `evaluation`
   - `apollo-io-rest`, `apollo-people-search-transformer` -> `discovery/providers/apollo`
   - `org-chart-intent`, `org-chart.schema`, `title-taxonomy-resolved-intent`
     -> `org-graph`
   - `stream-processing` + `token-tracking` -> `engine/core-modules/llm-chat-model`
   - `extractApiToken` -> `engine/core-modules/auth/utils`
   - the search-execution base -> `discovery/query/services/linkedin-search-execution.base.ts`
     (`LinkedinSearchExecutionBase`), now taking only the four dependencies it
     actually uses instead of twelve
   - the LinkedIn parameter catalogue -> `discovery/transport/.../linkedin-parameter-catalog.service.ts`,
     so the chart autocomplete no longer depends on the planner base
   - the uncalled `POST org-chart/generate-unresolved-search-parameters` route was
     deleted; the front end and the `generate_unresolved_search_parameters` tool
     already call `candidate-search/pipeline/...`
4. **Channel senders are one module.** `arx-chat/messaging.module.ts` provides and
   exports `LinkedinUnipileMessagingService`, `WhatsappUnipileMessagingService`,
   `WorkspaceMemberArxService`, `SendEmailFunctionality` and the WhatsApp
   outbound rate limiter — built once, injected, never `new`-ed per call site.
5. **ICP outreach is owned by `engagement`.** Files live in
   `engagement/outreach-command/icp-outreach/`, registered by
   `outreach-command.module`, which now imports `MessagingModule` instead of the
   files being parked in `arx-chat`.
6. **`evaluation/search-models` was deleted** (2026-11-14): zero callers on any
    branch, and its prompts were exercised only by its own spec.
7. **Unreferenced vendor controllers are gone** — `builtwith`, `theorg`,
   `serp-company-search`; their services remain because they are used in-process.

## Still open

1. **`contact-enrichment` and `wikidata` controllers must stay.** The front end
   calls `/contact-enrichment/{fetch,availability,jobs/:id}` and the
   `search_wikidata_companies` MCP tool calls `/wikidata/*` over REST.
2. **`arx-chat`** is still the god module (~46k LOC); `MessagingModule` is the
   first piece taken out of it.
3. **A few call sites still build senders by hand** —
   `candidate-sourcing` controllers `new WorkspaceMemberArxService(...)` for the
   current user. They can inject it from `MessagingModule` now.
4. **`LinkedInStrategySource` keeps one type-only import from `ingestion`**
   (`CandidateTableRow`). Erased at runtime; removing it means giving the
   strategy row its own contract type.
5. **Four tool layers** (`tool`, `tool-provider`, `arxena-tools`, `assistant`,
   `mcp-federation`) are intentionally untouched.

## Verification

`npx tsc --noEmit -p tsconfig.json` has ~1,007 pre-existing errors on this
branch, so it is a *delta* gate, not a pass/fail gate.

| | start of session | now |
| --- | --- | --- |
| total errors | 1,011 | 1,007 |
| `TS2307` cannot find module | 16 | 14 |
| errors in new or moved code | — | 0 |

All import specifiers resolve on disk; the five remaining unresolved ones predate
this work (`arx-chat`, `feature-flag`, `org-chart-search.live.spec.ts`).

Tests: the whole `src/domains` tree runs 1,926 passing / 23 failing across 9
suites. Every failure was checked by diffing the failing subject against its
pre-move copy in `.backup/`: the logic is byte-identical (only import lines
differ), so all 23 predate this work. The LLM call-site guard passes.
