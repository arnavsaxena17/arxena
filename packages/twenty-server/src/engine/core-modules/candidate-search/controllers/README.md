# Candidate Search Controllers

## Overview

| Controller | Route | Endpoints | Purpose |
|------------|--------|-----------|---------|
| **CandidateSearchController** | `candidate-search` | parse-job-description, parameters/:type, resolve-parameters, :searchFilterId/history, compute-tokens, linkedin-request-status, cache/results, expand-companies, expand-job-titles, generate-search-parameters, **orgchart** | Core API: JD parsing, LinkedIn params, cache, expanders, chat history, org chart search |
| **CandidateSearchChatController** | `candidate-search` | message/stream | SSE streaming for conversational search (single long-lived endpoint) |
| **CandidateSearchPipelineController** | `candidate-search/pipeline` | 24 step endpoints (cleanup-query, requirement-analyzer, job-title-expander, company-expander, query-constructor, resolve-parameters, execute-search, validate, score, etc.) | Step-by-step pipeline for scripts, Search Models UI, and MCP tools |

## Why three controllers?

- **Main** – All JSON request/response and simple GET/POST/PUT under `candidate-search`. Orgchart is a single feature endpoint and lives here.
- **Chat** – One endpoint that uses `@Res()` and Server-Sent Events; keeping it separate avoids mixing streaming and abort-handling logic into the main controller.
- **Pipeline** – Many endpoints under `candidate-search/pipeline` with a different consumer set (scripts, testing, MCP); separate file keeps the pipeline API discoverable and maintainable.

## Overlap

- **resolve-parameters**: Main controller and pipeline both expose it. Main uses `searchParameters` (used by frontend/MCP); pipeline uses `unresolvedParameters` (used by test flow). Same underlying resolver, different request shapes.
- **expand-companies / expand-job-titles**: Main has these for direct API use; pipeline has company-expander and job-title-expander for the script flow. Same services, different entrypoints.

Consolidating these would require a single request shape and updating all callers; current split keeps script/MCP and app API clear.
