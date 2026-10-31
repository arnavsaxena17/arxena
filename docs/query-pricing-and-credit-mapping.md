# Query pricing per generator, and the credit map

Verified 31 Oct 2026 against vendor pricing pages and the code in
`packages/twenty-server/src/engine/core-modules`. All USD, list price unless noted.

> The machine-readable source of truth is a single file,
> [pricing-catalog.json](../packages/twenty-server/src/engine/core-modules/billing/constants/pricing-catalog.json).
> Where this document and the JSON disagree, the JSON wins. The JSON carries every
> rate, every meter, the route cost models and the bundle proposal. No rate is
> written anywhere else: code imports this file and only maps an observed provider
> call to the meter that prices it.

## 1. What each source is actually billed on

The single most important fact: **the four sources do not share a billing unit.**
Two bill per *request*, one bills per *search block*, one bills per *page of 25*,
and one has no per-query price at all.

| Source | Vendor + product | Billed unit | Why |
| --- | --- | --- | --- |
| Google SERP | Bright Data **SERP API** (`serp_api` zone, `/request`, async `/serp/req`) | successful request | One query = one billable request, failed/errored not billed |
| AI-Overview questions | Bright Data SERP API (`serp_ai_overview` zone) | successful request | Same product, different zone |
| Bright Data (people) | Bright Data **Business Search** (`ludicrous` + `instant`) | search block (≤100 results) | Priced on `limit` requested, not rows returned |
| Harvest / Sales Nav | **HarvestAPI** `/linkedin/lead-search` | page of ≤25 leads | $0.10 per search page |
| Harvest enrichment | HarvestAPI `/linkedin/profile` | profile | $0.004 main, $0.0064 full |
| Arxena company index | Elasticsearch (`@elastic/elasticsearch`) | HTTP search request | $2.00 / 1K requests |
| LinkedIn-native ops | Unipile | request | $5/mo, 10 requests/day |

## 2. Price list

### Bright Data SERP API — Google/Bing query

| Plan | Rate | Effective per query |
| --- | --- | --- |
| Free | 5K requests/mo | $0 |
| Pay as you go | $1.50 / 1K successful requests | **$0.0015** |
| Scale ($499/mo) | 380K included, then $1.30 / 1K | **$0.0013** |
| Enterprise | custom | not published |

Parsing, unlocking, CAPTCHA handling and retries included. Async "collect" calls are
free — only the submit is billed. **Caveat:** if custom headers/cookies are set on the
zone, *every* request bills, including failures.

### Bright Data Business Search — people search

| Mode | Rate | Results included | Per search |
| --- | --- | --- | --- |
| `ludicrous` | $2.00 / 1K searches | 100 | **$0.002** |
| `instant` | $2.00 / 1K searches | 100 | **$0.002** |
| `smart` | $3.00 / 1K searches | 10 | **$0.003** |

Billed on the `limit` you *request*, not rows returned. A zero-match search that ran
is still billable; a rejected request is not. Each page of a paginated search is a
separate search.

### Bright Data Scraper API — LinkedIn profile record

| Plan | Rate | Per record |
| --- | --- | --- |
| Free | 5K records/mo | $0 |
| Pay as you go | $1.50 / 1K records | **$0.0015** |
| Scale ($499/mo) | 384K included, then $1.30 / 1K | **$0.0013** |

Only successful deliveries bill.

### HarvestAPI — Sales-Nav-equivalent lead search

**Contracted basis: $0.10 per whole lead-search page, $0.004 per individual
profile.** The rest of the rate card is catalogued but not on the default path.

| Endpoint | Rate | In use |
| --- | --- | --- |
| Lead search page (≤25 short leads) | **$0.10** | yes |
| Main profile (one `/linkedin/profile` fetch by URL) | **$0.004** | yes |
| Company / company search page | $0.004 | yes |
| Profile search page | $0.004 | no |
| Full profile | $0.0064 | no |
| Profile + email | $0.02 | no |
| Account search page | $0.10 | no |
| Job request | $0.001 | no |

Volume discounts on top-up: Basic $80 **−19%**, Pro $280 **−42%**,
Business $780 **−50%**. No subscription; credits expire in a year.

### LinkedIn Sales Navigator — reference only, not our cost basis

Listed for comparison. Arxena does not buy seats; LinkedIn-native access comes
through Unipile below.

| Plan | Monthly | Annual (effective/mo) |
| --- | --- | --- |
| Core | $119.99 | $1,079.88 ($89.99) |
| Advanced | $159.99 | $1,799.88 ($149.99) |
| Advanced Plus | quote only | not published |

Per seat, no per-query meter, no public search API. Programmatic use only exists
through scrapers, which is why HarvestAPI is the metered substitute here.

### LinkedIn-native access — Unipile, not a Sales Navigator seat

$5.00/month with a cap of 10 requests/day → 300 requests/month →
**$0.01666667 per request**.

That is 11× a Bright Data SERP request, and the cap binds harder than the price:
1,000 requests takes about 100 calendar days. Use it only where a real LinkedIn
identity is required, never as a people-search engine.

### Elasticsearch — company index

**$2.00 per 1,000 requests = $0.002 per HTTP search request**, charged on every
request sent. There is no assumed requests-per-lookup: a lookup that fans out costs
a multiple, and the multiple is measured, not modelled.

## 3. Cost per company, as the code actually issues queries

| Route | Queries issued | Cost |
| --- | --- | --- |
| Google SERP sweep | ≤12 requests (`MAX_SERP_QUERIES_PER_COMPANY`), no pagination | $0.018 |
| AI Overview | ≤3 questions × ≤3 attempts (`AI_OVERVIEW_QUERY_LIMIT` × `AI_OVERVIEW_ATTEMPTS`) | ≤$0.0135 |
| SERP route total | | **≈$0.021 typical, $0.0315 ceiling** |
| Bright Data route | 1 label per variant → ≤24 shards; per shard 1 estimate search + ≤11 fetch pages; `instant` adds 1–2 per cell | **≈$0.024 typical, $0.576 worst case** |
| Harvest route | 100 leads = 4 pages; 250 leads = 10 pages | **$0.40 – $1.00**, plus $0.004 per enriched profile |
| Elasticsearch lookup | every HTTP search request bills | **$0.002 × requests sent** |

The last row is the one to watch: at 2 requests a lookup already costs the same as a
14-event SERP sweep, and at 10 requests it costs more than the whole sweep. Request
count per lookup is an efficiency target, not just a metering detail.

## 4. Cost per 1,000 people (the number that should drive pricing)

| Path | Cost / 1K people | Note |
| --- | --- | --- |
| Bright Data Business Search | **$0.02** | 10 full pages at 100 rows |
| Bright Data scraper (full profile) | **$1.50** | one record per person |
| Harvest lead search only | **$4.00** | 40 pages × 25 |
| Harvest + main profile | **$8.00** | |
| Harvest + full profile | **$10.40** | |
| Unipile | **$16.67** | and 1,000 requests takes ~100 days |
| Google SERP | not per-person | ~$0.02/company, yields 10 organic results/query |

Harvest is ~200× Bright Data per lead, and 2.7× the price of a full Bright Data
profile scrape while returning only short-lead fields. That is a precision
purchase, not a coverage purchase — price it that way, don't hide it.

## 5. Audit: what is metered today vs what is spent

Credits are $1 = 1,000,000 micro-credits (`DOLLAR_TO_CREDIT_MULTIPLIER = 1e6`).

| Provider spend | Metered? | Where |
| --- | --- | --- |
| Business Search via ludicrous planner/executor | yes | `billRecords`, per **record** at $0.002 |
| SERP for company news | yes | `billSerpRequest`, per request at $0.0015 |
| SERP for `find_people_by_company` (≤12/company) | **no** | — |
| AI Overview zone | **no** | — |
| Business Search `instant` engine inside `find_people_by_company` | **no** | calls `brightDataBusinessSearchService` directly |
| HarvestAPI lead-search + profile enrichment | **no** | — |
| Bright Data LinkedIn profile scrape | **no** | — |
| Elasticsearch company index | n/a | infra |

Two errors that currently cancel each other:

1. **Over-bill:** `billRecords` charges $0.002 per *row*, but Business Search bills
   $0.002 per *search of up to 100 rows*. A full 100-row page costs $0.002 and is
   charged $0.20 — 100× over.
2. **Under-bill:** the `instant` half of every Bright Data cell, the whole SERP
   fan-out, the AI-Overview pass, Harvest and profile scrapes are free to the
   workspace while costing real money.

## 6. Credit map — per provider event, 1.25 margin

Charged on every billable provider event, at 1.25× provider cost.
`charged = round(usdPerUnit * 1.25 * 1_000_000)` in micro-credits, one rounding step.

| Meter | Unit | At cost | Charged (1.25) | Charge when |
| --- | --- | --- | --- | --- |
| `SERP_REQUEST` | successful request | 1,500 | **1,875** | response returned |
| `AI_OVERVIEW_REQUEST` | successful request | 1,500 | **1,875** | response returned |
| `BD_SEARCH_PAGE` | search block ≤100 | 2,000 | **2,500** | every search that ran, incl. zero-match |
| `BD_SEARCH_PAGE_SMART` | search block ≤10 | 3,000 | **3,750** | every search that ran |
| `BD_PROFILE_RECORD` | record | 1,500 | **1,875** | record delivered |
| `HARVEST_LEAD_PAGE` ✓ | ≤25 leads | 100,000 | **125,000** | page requested |
| `HARVEST_PROFILE_MAIN` ✓ | profile | 4,000 | **5,000** | profile returned |
| `HARVEST_COMPANY` ✓ | company | 4,000 | **5,000** | company returned |
| `HARVEST_COMPANY_SEARCH_PAGE` ✓ | page | 4,000 | **5,000** | page requested |
| `HARVEST_PROFILE_SEARCH_PAGE` | page | 4,000 | **5,000** | page requested |
| `HARVEST_PROFILE_FULL` | profile | 6,400 | **8,000** | profile returned |
| `HARVEST_PROFILE_WITH_EMAIL` | profile | 20,000 | **25,000** | profile returned |
| `HARVEST_ACCOUNT_SEARCH_PAGE` | page | 100,000 | **125,000** | page requested |
| `HARVEST_JOB_REQUEST` | request | 1,000 | **1,250** | request made |
| `UNIPILE_REQUEST` | request | 16,667 | **20,833** | request made |
| `ES_SEARCH_REQUEST` | HTTP search request | 2,000 | **2,500** | request sent |

✓ marks the contracted Harvest rates actually in use. The other Harvest meters are
catalogued so the code does not have to invent a price if a path starts using them.

A 1 micro-credit cache hit charges 0. A failed provider request charges 0, because
the provider does not bill it.

### What a run now costs the customer

These are sums of events for forecasting and display only — the ledger keeps and
charges each event separately.

| Run | Events | Charged |
| --- | --- | --- |
| Company sweep, SERP route (typical) | 14 | **$0.02625** |
| Company sweep, SERP route (ceiling) | 21 | **$0.039375** |
| Company sweep, Bright Data route (typical) | 12 | **$0.03** |
| Company sweep, Bright Data route (ceiling) | 288 | **$0.72** |
| Company index lookup | 1 / 2 / 5 / 10 requests | **$0.0025 / $0.005 / $0.0125 / $0.025** |
| 100 Harvest leads | 4 | **$0.50** |
| 1,000 people, Business Search | 10 | **$0.025** |
| 1,000 full profiles | 1,000 | **$1.875** |

### Implementation notes

- One credit record per provider call, carrying `meterId`, provider, quantity and unit.
- Replace `costForRecordsUsd` with a per-page unit; the ludicrous executor already
  knows its page `limit`, so quantity = pages.
- Route `find_people_by_company`'s `instant` calls through `BrightDataBillingService`.
- Meter the SERP sweep and AI-Overview pass in `find-people-google-search.service.ts`.
- Count Elasticsearch HTTP requests at the client, not logical lookups; every request
  is chargeable, including variant and retry requests.
- Aggregate per-event charges per tool call for display; keep the events in the ledger.
- Keep one rounding rule and never charge below one micro-credit.

## 7. Gaps

Resolved by the 31 Oct 2026 pricing decision, and baked into the JSON:

1. **Margin** is 1.25 on provider cost.
2. **Granularity** is per provider event, not per bundle.
3. **AI Overview** bills at the SERP rate, $1.50/1K.
4. **No free tier.** Every provider request is marginal cost.
5. **Elasticsearch** is metered at $2.00/1,000 requests, charged per request.
6. **LinkedIn-native access** is the Unipile subscription, not a Sales Navigator seat.
7. **Harvest contracted rate** is the published rate: $0.10 per whole lead-search
   page, $0.004 per individual profile.

Still open:

1. **Production mix.** Observed averages for queries per company, shards per company,
   Harvest page fill and cache hit rate. Cache rate is the cheapest lever available.
2. **Elasticsearch requests per lookup.** The rate is settled, the count is not. Each
   request is $0.0025, so the count is now a pure efficiency metric: 2 requests equals
   a whole SERP sweep, 10 requests exceeds it.
3. **Unipile headroom.** Whether 10 requests/day is hard or raisable.
4. **Margin on a fixed subscription.** Unipile is $5/month whether or not the 10/day is
   consumed. Charging 1.25 per request only recovers the subscription if the cap is
   actually used, so underuse silently under-recovers.

## 8. Reporting cost to the agent

`get_project_costs` answers "what did this project spend?" from the request ledger,
not from an estimate.

- **Source of truth for requests:** the `providerCall` table, one row per provider
  request, carrying `projectId`, `runId`, `toolName`, `stage`, `provider`,
  `operation`, `cacheStatus`, `success`.
- **Source of truth for rates:** the pricing catalog JSON above.
- **Computation:** `ProviderCallLogService.getProjectCost` groups the ledger by
  provider/operation/cache status, maps each group to a meter, and multiplies by the
  meter's charged micro-credits. Cached and failed requests are counted but priced at
  zero, because the provider does not bill them.
- **Output:** total charged and provider cost, split by request type, split by step,
  and an `unrated` list for any call the catalog does not cover — so an incomplete
  total is visible as incomplete rather than silently short.

Coverage of the ledger, after the tracking added to each source:

| Source | Logged | Operation string |
| --- | --- | --- |
| Google SERP / AI Overview | yes | `serp-zone:<zone>` |
| Bright Data Business Search | yes (added) | `business-search:<entity>` |
| Harvest lead search / profile | yes (added) | `lead-search`, `profile`, `company-search` |
| Elasticsearch company index | yes (added) | `search` |
| Bright Data profile scrape | not yet | — |
| Unipile | partial | caller-defined |

Two consequences worth stating plainly:

1. A tool call that fans out over companies aggregates to one project cost, because
   every request inherits `projectId` from the provider call context.
2. The report is only as complete as the ledger. Profile scrapes and some Unipile
   paths are still unlogged, so they are missing from the total rather than wrong in it.
