# Logistics Heads — AI Overview pass and LinkedIn URL resolver

Last updated: 2026-10-30
Author: agent session (DeepSeek Harness)
Status: implemented locally, verified live; **not committed and not deployed to prod**

This is the handoff note for the work on the "Logistics Heads List for 6 Client Partners"
chat. Read this before touching `find_people_by_company`, the SERP fan-out, the LinkedIn
profile resolver, or the two new tools.

## 1. Context

| Item | Value |
| --- | --- |
| Local GUI | `http://arxena-5.localhost:3001/outreach-home?projectId=b47222b6-e181-48c3-b7b9-7811800c4288` |
| Backend | `http://arxena-5.localhost:3000` (core GraphQL `/graphql`, metadata GraphQL `/metadata`) |
| Project | `b47222b6-e181-48c3-b7b9-7811800c4288` — "Logistics Partners · Supply Chain & Procurement Heads" |
| Chat | `cfe034b1-6085-4992-8d78-3fafa8fbe7d4` — "Logistics Heads List for 6 Client Partners" |
| Companies | Akshayakalpa, Shadowfax, Milky Mist, Jubilant Foodworks, Hatsun Agro, Zomato |
| Roles | Head of Supply Chain & Logistics, Procurement Head, Purchase Head, Chief Procurement Officer |

Auth is a bearer token stored in the browser's `localStorage` under `tokenPairState`
(`accessOrWorkspaceAgnosticToken.token`). **Do not paste the token into this file.**

## 2. What happened, in order

1. The original chat had already run a first pass (13 people, 6/12 pairs, $0.166).
   Google failed on every company; only Bright Data and Harvest contributed.
2. A "redo the whole search with the newly changed code" message was sent. The run
   went 13 → 22 rows (9 new), 24 pairs, $0.122, with Google/web now working.
3. Investigation showed the names in the user's Chrome AI Overview
   (Veeramani M P, Suresh N, Ganesh Pawar, …) were never in the organic top-10,
   and the people search did not request or parse `ai_overview` at all.
4. The AI Overview pass was implemented on top of Bright Data's dedicated
   `serp_ai_overview` zone and run. The tab went 22 → 28 rows: 7 new unique
   people, the duplicate Naveen Srivastava row removed.
5. The four web-only rows were still without LinkedIn URLs. The existing
   `LinkedinProfileResolverService` was found to be effectively dead on the
   Bright Data side (`mode: 'instant'` returned 0 for name+company, even for a
   person whose URL was already known). It was rewritten to use exact-name
   ludicrous queries with current/past company fallback.
6. `resolve_linkedin_url` (read-only) and `write_linkedin_url` (writes to the row)
   tools were added. The four URLs were resolved and written to the rows.

## 3. Final data state (as of this note)

- People tab: **28 rows**.
- 7 people added by the AI Overview pass:
  Ganesh Pawar, Deepak Palanisamy, VEERAMANI M P, Suresh N (Akshayakalpa);
  Amrita Chakraborty, Swarup Pradhan (Shadowfax); Sasikumar Paramasivam (Milky Mist).
- Duplicate Naveen Srivastava row removed (one remains, the Google row).
- LinkedIn URLs written to four rows, with `otherFields.linkedinResolution`:

| Person | URL | Relation |
| --- | --- | --- |
| Suresh N | `https://www.linkedin.com/in/suresh-n-693181154` | current — Purchase lead, Akshayakalpa Organic |
| VEERAMANI M P | `https://www.linkedin.com/in/veeramani-m-p-54675467` | current — Head of Extension Services & Procurement |
| Swarup Pradhan | `https://ro.linkedin.com/in/swarup-pradhan-8ab67b137` | current — Shadowfax |
| Deepak Palanisamy | `https://www.linkedin.com/in/deepak-palanisamy-a7993a188` | **past** — Purchase Specialist at CATERSPOINT |

Deepak is an alumnus, not the current Akshayakalpa procurement owner. Swarup's
profile is on the `ro.` subdomain; company field is Shadowfax, worth a visual check.

Spend across the passes is roughly **$0.33** total (search $0.166 + retries $0.01 +
AI rerun $0.122 + resolver $0.034). No full profiles were fetched for the four rows.

## 4. Code changes (authored in this session)

All paths are under `packages/twenty-server/src/engine/`.

### 4.1 AI Overview pass

| File | Change |
| --- | --- |
| `org-chart/utils/map-google-serp-organic.util.ts` | `buildGoogleSerpSearchUrl(query, limit, { country, aiOverview, brdJson })`; adds `gl`, `brd_ai_overview=2`, `brd_json=1`. 2-arg callers unchanged. |
| `bright-data/services/bright-data-serp.service.ts` | New `requestSerpGoogleJsonInZone(searchUrl, zone, { signal, timeoutMs })` — API-key route, `format: "raw"`, treats an empty body as a miss and throws. Bypasses the shared proxy/cache on purpose. |
| `tool/tools/find-people-by-company-tool/find-people-google-search.service.ts` | Country pin from `location` / `FIND_ROLE_SERP_COUNTRY` on every query. New AI pass: designation-first queries, 2 attempts each, 35 s per request, 60 s overall, zone from `BRIGHT_DATA_SERP_AI_OVERVIEW_ZONE` (default `serp_ai_overview`). Merges `ai_overview` text and the organic results of a hit. Warns per company when every attempt misses. |
| `tool/tools/find-people-by-company-tool/google-result-extraction.service.ts` | Accepts `aiOverview` text, adds it to the extraction prompt, allows `resultIndex: 0` for a person only named there, includes the overview in the name-check haystack. |
| `tool/tools/find-people-by-company-tool/find-people-cascade.service.ts` | Passes `aiOverviewTexts` through, passes `title` to the resolver, skips `past` profiles when mapping a person. (This file also contains pre-existing uncommitted work — see §9.) |
| `arx-web-search/utils/extract-serp-evidence.util.ts` | `collectText` now descends into `list`; Bright Data returns overview bullets as `texts[].list[]`, which the old code dropped. |

AI overview query forms that actually returned an overview in live probes
(2 attempts each, ~50% hit rate):

- `Supply Chain Head <company>`
- `Head of Procurement <company>`
- `Purchase Head <company>`

The old natural form `<Company> <Role as typed>` was the one that reliably did
**not** trigger it. A miss returns an **empty body**, not organic-only, so the
zone is a supplementary pass and never replaces `serp_api`.

The `serp_ai_overview` zone works through the **API key route**. Its proxy
password is different from the other zones (the known passwords return 407).

### 4.2 LinkedIn URL resolver

| File | Change |
| --- | --- |
| `tool/tools/find-people-by-company-tool/linkedin-profile-resolver.service.ts` | Bright Data lookup rewritten from `mode: 'instant'` string queries to `mode: 'ludicrous'` structured queries: `name` text with `mode: "all"`, `current_company_name` first, then `past_company_names`, then name-only. **Both text filters need `mode: "all"`** — the validator rejects a bare company string. Added `companyRelation: 'current' \| 'past' \| 'unknown'` and `title` input; Google gets a third `name company title` query after the plain and `linkedin` ones. Ordering prefers current, then Google, then past, then name-only. |
| `tool/tools/fetch-profiles-tool/fetch-profiles.service.ts` | Passes `title`; skips `past` profiles as current contacts. |
| `outreach-command/services/outreach-tab.service.ts` | New `updateEphemeralPersonLinkedinUrl` — updates one People row by id, sets `linkedinUrl`, records `otherFields.linkedinResolution`, writes through `OutreachPeopleCacheService.set(..., { writtenRows })`. |
| `tool/tools/resolve-linkedin-url-tool/` (new) | `resolve_linkedin_url(name, company, alternateCompanies?, title?)` → candidates with URL/relation/via/evidence, `bestLinkedinUrl`, current/past counts. Read-only. |
| `tool/tools/write-linkedin-url-tool/` (new) | `write_linkedin_url(personId, linkedinUrl, relation, evidence?, source?)` → writes the URL onto the row without fetching a profile. |
| `tool/tool.module.ts`, `tool-provider/providers/action-tool.provider.ts` | Registered both tools (providers + exports + map + descriptors). |

Why the rewrite was necessary: `instant`/`smart` name+company searches returned
**0 documents for all seven probed names**, including Amrita Chakraborty whose
URL was already known. The ludicrous exact-name query returned the exact profile
for Veeramani, Suresh, Swarup, Amrita and (via `past_company_names`) Deepak.

## 5. Tests and checks

- Find-people / fetch-profiles / tool-provider suites: **35 suites, 322 tests pass**.
- The broader `outreach-command` run: 94/95 suites pass. The one failure,
  `outreach-message-persist.service.spec.ts` (2 tests, `messageObj` shape), is
  pre-existing and unrelated.
- `oxlint` on all touched files: 0 errors.
- `tsgo -p tsconfig.json`: no errors in the touched files. The package already
  reports ~1,035 unrelated baseline errors (migrations, scripts, setupTests).
- Live probes before the resolver run confirmed the ludicrous queries and the
  AI overview zone.

## 6. Environment and flags

Local `packages/twenty-server/.env` (gitignored):

```
FIND_ROLE_AI_OVERVIEW=true
```

Optional:

```
# BRIGHT_DATA_SERP_AI_OVERVIEW_ZONE=serp_ai_overview   # default
# FIND_ROLE_SERP_COUNTRY=in                           # default derived from location
```

Production `app.arxena.com`: `/home/ubuntu/twenty/packages/twenty-server/.env`
was backed up to `.env.bak.20261030T113147Z` and `FIND_ROLE_AI_OVERVIEW=true`
was appended. **Prod is on commit `f1bf9c3492`, which does not contain any of
these changes**, so the flag is inert there until this branch is committed,
deployed, and the process restarted. No prod restart was performed.

## 7. How to run / verify

Local backend is `nest start --watch` → `dist/main`; saving TS triggers a rebuild
and restart. The AI overview pass logs a warning per company when every attempt
misses, e.g.:

```
AI Overview zone returned none for "Acme" after 3 queries x 2 attempts
```

Data stores used for verification (workspace `91a39322-7e06-4547-89a0-dfd00c2dec21`):

```bash
# People tab cache (Redis)
redis-cli GET 'engine:outreach-command:gtm-people:91a39322-7e06-4547-89a0-dfd00c2dec21:b47222b6-e181-48c3-b7b9-7811800c4288'

# Chat messages (metadata GraphQL)
curl -s -X POST 'http://arxena-5.localhost:3000/metadata' \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"query":"query($t: UUID!){chatMessages(threadId:$t){id role status createdAt parts{type toolName toolInput toolOutput}}}","variables":{"t":"cfe034b1-6085-4992-8d78-3fafa8fbe7d4"}}'

# Thread stream state (Postgres, core schema)
psql "$PG_DATABASE_URL" -c 'select "activeStreamId" from core."agentChatThread" where id = '\''cfe034b1-6085-4992-8d78-3fafa8fbe7d4'\'';'
```

If the chat appears stuck, `stopAgentChatStream(threadId: ...)` on `/metadata`
clears `activeStreamId`. A queued user message may then need resending.

## 8. Known issues / caveats

- AI Overview is probabilistic (~50% per attempt in these probes). The pass runs
  only the three designation-first queries per company, two attempts each.
- The `serp_ai_overview` zone is API-only with the current credentials; the proxy
  password is unknown and the known passwords return 407.
- `fetch_profiles` is slow and scrapes the top rows by `rowLimit`; it timed out
  at 2/10 after ~171 s during this session and was stopped. It has no `rowIds`
  filter. The direct `write_linkedin_url` path was used instead. Full profiles
  for the four rows have **not** been fetched.
- Google queries were previously not geo-pinned; Bright Data rotated egress
  across Vietnam, Netherlands, Brazil, etc. `gl` is now set from `location`, but
  it is a market signal, not a hard egress pin.
- AI overview names can be stale or misattributed (Deepak is the example); the
  company/role judge and the `current`/`past` relation must stay in the loop.
- The AI Overview zone returns an empty body on a miss, so any caller must retry
  and must not cache it as a valid answer.

## 9. Pre-existing uncommitted work (not authored here)

The working tree also contains changes from earlier work that this session did
not write and should not be conflated with the above:

- `title-taxonomy/title-expansion.service.ts`, `title-taxonomy-remote.service.ts`
  and their tests
- `find-people-serp-sources.service.ts` (TheOrg / The Official Board) and its test
- parts of `find-people-by-company-tool.ts`, `find-people-by-company.types.ts`,
  `find-people-company-plan-and-run.spec.ts`, `find-people-by-company-tool.spec.ts`
- the `FindPeopleCascadeService` diff is a mix of the above and this session's
  `aiOverviewTexts` / `title` / `past` edits

## 10. Next steps

1. Decide whether to fetch full profiles for the three `current` rows (the
   `past` Deepak row is skipped by the fetch filter).
2. Add a `rowIds` (or `personIds`) input to `fetch_profiles` if targeted fetches
   are wanted; the top-N-by-row behaviour is the current limitation.
3. Commit and deploy this branch to prod before expecting the prod flag to work.
4. Consider a dedicated `resolve_linkedin_url` batch pass over all rows that have
   no URL, with a per-row budget and the `current`/`past` distinction surfaced
   in the UI.

## 11. Evidence and artifacts

- `artifacts/chat-run-cfe034b1/` — first rerun: 13 → 22 rows, chat final state.
- `artifacts/ai-overview-rerun/` — AI pass: 22 → 28 rows, run summary.
- `artifacts/linkedin-resolver/` — resolver results JSON, resolved URLs screen,
  URLs written to rows screen.
