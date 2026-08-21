# Search People Skill

You source people for the user across Arxena's connected data providers, dedupe them, and **route the winners to the correct destination** (GTM ephemeral People tab vs CRM Candidates).

## When to load this skill

Load this skill when the user wants to:

- "Find people who…" / "List candidates for <role/company/location>" / "Find MD/CEO at these companies"
- Build a talent pool or shortlist for a project / req / **GTM Command People tab**
- Enrich existing CRM people, or discover new candidates to add
- Search people by properties: job title, company, location, seniority, skills, school
- Turn a natural-language hiring brief ("senior TypeScript engineers at Series B fintechs in NYC") into a candidate list

## Destination routing (choose first)

| Context | Destination | Tool |
| --- | --- | --- |
| User is on **GTM Command** (`/gtm-home`) / browsing context `type=gtmCommand` / `projectId` present / asks to find people for this run | **Ephemeral GTM People tab** (Redis) | `upsert_gtm_target_people` |
| User wants a **workflow** that enrolls ICP people on `company.created` | CRM Person + Candidate (`QUEUED`) | Load `gtm-outreach-workflows` + `workflow-building`; native `upload-profiles` — do **not** Redis-upsert for that automation |
| User explicitly asks to **save to CRM** / create Candidates / "add these people to the project as candidates" **after confirming** | CRM `candidate` / `person` | `create_candidate` / `create_one_person` / update |

On GTM Command **People tab / Find people**: **never** end after a chat-only table. Persist with `upsert_gtm_target_people({ projectId, mode: "merge", people })` first, then summarize. Do **not** `create_candidate` / `create_one_person` **for that tab**. Workflow enroll (`upload-profiles`) is the exception in the table above.

`upsert_gtm_target_people` person shape:

```json
{
  "name": "Rajendra V Agarwal",
  "title": "CEO & Managing Director",
  "companyId": "",
  "companyName": "Donear Industries Limited",
  "linkedinUrl": "https://www.linkedin.com/in/example",
  "warmPath": "—",
  "stage": "queued",
  "email": ""
}
```

Prefer `companyId` from the ephemeral Companies tab when known; otherwise set `companyName`.

## Provider map (choose by intent)

| Source | Tool(s) | Best for | Requires |
| --- | --- | --- | --- |
| **Apollo** | `search_apollo_people` | Firmographic people search: title, company, headcount, location, keywords; emails/phones | Apollo connected (server config) |
| **LinkedIn / Unipile** | `search_linkedin_people` | Live LinkedIn people from a connected account (classic / Sales Nav / Recruiter) | Connected LinkedIn Unipile account |
| **Harvest** | People API (`dataSource: "harvest"`) | People search without a LinkedIn session; taxonomy-backed role/function/grade filtering | Harvest configured |
| **Exa** | `exa_web_search` (logic function) | Web/AI search for hard-to-find people, speakers, authors; `category: "people"` | `EXA_API_KEY` set |
| **Internal index** | `search_people_index` | Search people already in the workspace Elasticsearch index / dedupe against CRM | Index populated |

Always prefer the **internal index** first when the user may already have the person (CRM path), to avoid re-creating duplicates.

## Plan → Learn → Execute

1. Load this skill (`load_skills(["search-people"])`).
2. Choose destination from the routing table above (GTM ephemeral vs CRM).
3. Decide source(s) from the provider table.
4. For **LinkedIn / Unipile** and **Harvest** paths, load the `linkedin-search` sub-skill **in the same call** so its facet-resolution, Harvest People API, and `searchParameters` rules are available before you search: `load_skills(["search-people", "linkedin-search"])`. Skip `linkedin-search` only when the user's request needs no LinkedIn/Harvest source.
5. `learn_tools` once with every tool you will use. On GTM Command include `upsert_gtm_target_people` and **omit** `create_candidate` unless the user explicitly confirmed CRM save:

```
# GTM Command (default)
learn_tools([
  "search_apollo_people",
  "search_linkedin_people",
  "search_people_index",
  "exa_web_search",
  "upsert_gtm_target_people"
])

# Explicit CRM save only
learn_tools([
  "search_apollo_people",
  "search_linkedin_people",
  "create_candidate",
  "find_candidate_in_arxena_internal"
])
```

6. Run searches with `limit` small (10–25) unless the user wants a big list.
7. Dedup across sources **by normalized name + email/linkedin** before writing.
8. **GTM path:** `upsert_gtm_target_people({ projectId, mode: "merge", people })` then summarize. Stop — wait for user confirmation before any CRM write.
9. **CRM path (only when user asked to save to CRM):** `find_candidate_in_arxena_internal` / `arxena.lookup_by('candidates', 'email', …)` → update if present, `create_candidate` if missing.
10. If the user asked for a CSV / project (CRM path), load `data-manipulation` + `code-interpreter`, write `/home/user/output/`, and report references.

## GTM ephemeral save workflow (default on /gtm-home)

1. Confirm browsing context has `projectId`.
2. Search people (LinkedIn / Harvest / Apollo…).
3. Map hits to the person shape above.
4. `learn_tools({ toolNames: ["upsert_gtm_target_people"] })`.
5. `execute_tool({ toolName: "upsert_gtm_target_people", arguments: { projectId, mode: "merge", people } })` — `arguments` is an object.
6. Summarize. Do **not** create CRM Candidates until the user confirms.

## Source 1 — Apollo (`search_apollo_people`)

Best for firmographic people search with contact data. Available in the `prospecting` pack.

- Prefer this tool whenever the user names Apollo, or wants title / company / headcount / geo filtering on people.
- Pass a structured filter object (person params) — do not invent Apollo field names; `learn_tools` returns the live schema.
- Common filters: `person_titles`, `person_locations`, `q_keywords`, `organization_locations`, `organization_num_employees`, linked company filters.
- Keep `page_size` / `limit` modest; paginate with the returned cursor if the user wants more.
- Returns name, title, company, location, and often email/phone — map these to CRM candidate fields.

Example call shape (verify field names via `learn_tools`):

```
search_apollo_people({
  "person_titles": ["software engineer", "backend engineer"],
  "person_locations": ["New York, NY"],
  "q_organization_keywords": "fintech",
  "page_size": 25
})
```

## Source 2 — LinkedIn / Unipile (`search_linkedin_people`)

Live LinkedIn people from a connected Unipile account. **Delegate to the `linkedin-search` skill** for the full facet workflow — this is a summary:

- `searchType`: `classic`, `sales_navigator`, or `recruiter`. Check **Connected Accounts** in the system prompt for which types are available.
- Resolve facet IDs first with `search_linkedin_parameters` (`LOCATION`, `INDUSTRY`, `JOB_TITLE`, `COMPANY`, `SKILL`, `SCHOOL`).
- For Sales Navigator / Recruiter people, use `role` / `{ include: [...] }` shapes — never classic flat `job_title` or bare arrays.
- Classic people body example:

```json
{
  "searchType": "classic",
  "searchParameters": {
    "api": "classic",
    "category": "people",
    "keywords": "product manager",
    "location": ["102277331"],
    "industry": ["6"],
    "network_distance": [1, 2, 3]
  },
  "limit": 10
}
```

- `search_linkedin_from_url` works for a pasted LinkedIn / Sales Nav / Recruiter people search URL.
- Reject mismatched facet titles; drop the filter rather than using a wrong ID.
- Do **not** call `search_linkedin_with_query` (not active in MCP).

## Source 3 — Harvest (People API, `dataSource: "harvest"`)

Harvest is taxonomy-backed people search. Use it when no LinkedIn session is available or the user wants Harvest specifically.

Load the `linkedin-search` skill's Harvest section and use these People API tools:

- `list_people_data_sources` — confirm Harvest is configured before assuming it.
- `search_people_api` — preferred: `naturalLanguage` such as "CEO at StayVista" or "CHRO at Apple" (company may be in the phrase).
- `search_people_by_job_title` — alias of `search_people_api` (`jobTitle` maps to `naturalLanguage`).
- Always pass `dataSource: "harvest"`.

```
search_people_api({
  "naturalLanguage": "Head of Engineering at Acme",
  "dataSource": "harvest",
  "limit": 20
})
```

Never invent Harvest HTTP paths or `harvest_*` tool names — only these People API tools reach Harvest. Prefer `search_people_api` with `naturalLanguage` for role strings so you don't invent taxonomy codes.

## Source 4 — Exa (`exa_web_search`)

Web/AI search via the `twenty-exa` logic function. Best for niche or public-profile people (speakers, authors, founders) that Apollo/LinkedIn miss.

- Tool name: `exa_web_search`. Requires `EXA_API_KEY` (returns a clean "Exa is not configured" error if missing — tell the user).
- `query` (string, required): be specific — include role + company + location + signal ("founder", "speaker", "hiring").
- `category` (optional enum): use `"people"` for person profiles; also `company`, `news`, `research paper`, `financial report`, `pdf`, `personal site`.
- `numResults` (optional, 1–30, default 10).
- Returns `{ success, message, result: [{ title, url, snippet }] }` — title/url/snippet only. Extract the person's name + any profile/email from the snippet; no structured person object.
- Good for "find ML engineers who publish on LLMs" type queries.

```
exa_web_search({
  "query": "backend engineers at fintech startups in Mumbai who speak at conferences",
  "category": "people",
  "numResults": 15
})
```

## Source 5 — Internal people index (`search_people_index`)

- Searches people/candidates already indexed in the workspace (Elasticsearch).
- Use first when the user may already have the person, or to dedupe before saving sourced results.
- Returns existing CRM people so you can update instead of create.

## Dedupe + CRM save workflow (only when the user asks to save to CRM)

On GTM Command this section does **not** apply until the user confirms Add to CRM / Enroll after seeing the People tab.

1. Collect rows from every source you queried.
2. Normalize: lowercase name, strip whitespace; match on **email** first, then **LinkedIn URL**, then normalized name + company. Treat two rows as the same person if email matches OR LinkedIn URL matches.
3. Load `data-manipulation` + `code-interpreter`; `learn_tools` for the CRM write tools.
4. In `code_interpreter`, resolve existing candidates:

```python
existing = arxena.lookup_by('candidates', 'email', [r['email'] for r in people_records if r.get('email')])
```

   Or use `find_candidate_in_arxena_internal` for a single lookup.
5. `create_candidate` for missing, update for present. Use the returned **CRM UUID** as the canonical id — never a provider's id (Apollo person id, LinkedIn facet id, Harvest profile id).
6. Map fields (verify against live candidate schema):

| Source field | CRM field |
| --- | --- |
| first_name / last_name | `name.firstName` / `name.lastName` |
| headline / title | `jobTitle` (or current title) |
| company | resolve company by name → `companyId` (CRM UUID) |
| location | `address` (city) |
| email | `email` |
| phone | `phone` |
| LinkedIn URL | `linkedinLink.primaryLinkUrl` (from `public_profile_url`) |
| Exa URL | keep as note / personal site |

7. If asked for CSV + project: write `/home/user/output/` from the **same parsed rows**, then report download + record references. Finish all three (search → CRM → CSV) before ending the turn. When a project is referenced, also attach candidates via `list_candidates_for_project` / project candidate link tools.

## Constraints

- Never invent provider field names or tool names — always `learn_tools` first and use what the schema returns.
- Respect rate limits; avoid large bulk scrapes unless the user explicitly asks.
- Prefer the internal index to avoid duplicate CRM people (CRM path).
- For LinkedIn/Harvest, follow the `linkedin-search` skill's facet and shape rules (load it as a sub-skill).
- Dedup by email/LinkedIn before any write.
- On GTM Command People tab, persistence to `upsert_gtm_target_people` is mandatory before ending the turn; never `create_candidate` until the user confirms. Scheduled enroll is `gtm-outreach-workflows` (`upload-profiles`), not this skill.
- Present results with name, title, company, location, and source (Apollo / LinkedIn / Harvest / Exa) so the user can judge quality; note when Recruiter results hide public identifiers.
