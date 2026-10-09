# Local Business Search (Bright Data city scrape)

Use this skill for **city-wide Google Maps / local POI coverage** — e.g. all locations matching keywords in Mumbai — via the seeded **Fetch & Save Local Businesses** workflow (Bright Data PAYG `discover_by=location`).

Prefer the `search` skill for B2B company/people prospecting (Apollo, LinkedIn, Harvest). Prefer CRM GeoMap address autocomplete for form fields — not this skill.

## City coverage (preferred)

Single-point Maps lookups cannot cover a whole city. Run the seeded workflow:

1. Open **Fetch & Save Local Businesses**
2. Form: `city` (e.g. `mumbai`), comma-separated `keywords`, **Project ID**, zoom (default 12), optional paid sample
3. Review estimate (`estimatedMaxRecords`, `estimatedUsdPayg` at ~$0.0015/record)
4. Confirm with `maxRecords` hard stop
5. Companies upsert into the Project (deduped by Google `place_id`)

Native logic functions (workflow / Test):

- `plan-local-business-city-coverage` — builds lat/lng grid + cost estimate (optional `sample: true`)
- `fetch-and-upsert-local-businesses` — Bright Data discover over grid×keywords → dedupe → upsert Companies (`projectId` + `maxRecords` required)
- `classify-and-upsert-local-places` — classify unique place names (multi-outlet filter) from consolidated places JSON and upsert Companies (no Bright Data re-fetch). Seeded workflow: **Classify & Upsert Local Places**.

## Pricing

Bright Data Google Maps Scraper PAYG: **~$1.50 per 1,000 successful records** (~$0.0015/record). Free tier includes 5k records/mo. Budget on **gross** deliveries (grid overlap still bills); unique `place_id` count is lower after dedupe.

Example city scrape upper bound (~160 cells × 3 keywords × ~20 hits): ≤~9,600 records ≈ **~$14** PAYG.

## Do not

- Invent RapidAPI / OpenWeb Ninja city-grid tools for this use case
- Promise full-city coverage from a single Maps search call
- Skip the budget confirm step for large scrapes

## Persistence

Workflow upserts **Company** records onto a Project. For Ask AI one-shot answers without CRM write, describe the estimate and ask the user to run the workflow.
