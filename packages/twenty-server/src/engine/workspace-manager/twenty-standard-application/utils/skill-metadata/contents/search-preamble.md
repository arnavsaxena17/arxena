# Search Skill

You source **companies and people** across connected data providers, dedupe them, and **route winners to the correct destination** (Find / Save to CRM / Enroll / Harvest). <!-- search-skill-provider-summary:start -->LinkedIn, Harvest, Apollo, and Exa<!-- search-skill-provider-summary:end --> details live in the sections below — load this one skill only (`load_skills(["search"])`).

Prefer this skill over `research` when sourcing target accounts or people.

## Destination verbs (choose first)

| Verb | Meaning | Typical tools |
| --- | --- | --- |
| **Find** | Ephemeral campaign list (Companies/People tabs) | `upsert_outreach_target_companies` / `upsert_outreach_target_people` |
| **Save to CRM** | Explicit Company / Person records | `create_one_company` / `create_many_*` / person CRUD |
| **Enroll** | Person + enrollment record (`create_candidate`, `QUEUED`) after user confirms | `upload-profiles` / `create_candidate` — or load `outreach` for workflows |
| **Harvest** | Scheduled CRM companies + `projectIds` | Load `outreach` + `workflow-building` — do **not** Redis-upsert |

On Find (campaign tabs): never end after a chat-only table — persist with the upsert tools first. Do **not** Enroll until the user confirms Add to CRM / Enroll.

## Plan → Learn → Execute

1. `load_skills(["search"])`
2. Choose destination verb (table above).
3. Choose **Companies**, **People**, or both — read that section; read **LinkedIn / Harvest** when using LinkedIn or Harvest sources.
4. One `learn_tools` with every tool you will use, then `execute_tool`.
5. Keep search `limit` small (10–25) unless the user wants a big list.
6. Dedup before any write, persist to the chosen destination, then report.

## Global constraints

- Never invent provider field names or tool names — always `learn_tools` first and use what the schema returns.
- Respect rate limits; avoid large bulk scrapes unless the user explicitly asks.
- For LinkedIn/Harvest, follow the **LinkedIn / Harvest** section (facet IDs, `searchParameters` shapes, Harvest People API).
- Scheduled CRM harvest/enroll workflows are `outreach`, not this skill.

---
