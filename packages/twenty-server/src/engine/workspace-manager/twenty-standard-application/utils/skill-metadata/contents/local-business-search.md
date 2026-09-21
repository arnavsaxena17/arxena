# Local Business Search

Use this skill for **Google Maps / local POI / brick-and-mortar** business lookup — plumbers, hotels, restaurants, clinics, gyms, etc.

Prefer the `search` skill for B2B company/people prospecting (Apollo, LinkedIn, Harvest). Prefer CRM **GeoMap / Google Places** address autocomplete for form address fields — not this skill.

## Credits

OpenWeb Ninja Local Business Data charges **per business (or review/photo) returned**, not per HTTP request. Setting `extractEmailsAndContacts: true` costs **extra** for each business whose website is scraped.

Keep `limit` small (e.g. 5–20) unless the user asks for more.

## Tools

1. `learn_tools` with:
   - `search_local_businesses`
   - `search_local_businesses_nearby`
   - `get_local_business_details`
   - `autocomplete_local_businesses`
2. `execute_tool` with a JSON **object** for `arguments`.

### search_local_businesses

Default Google Maps search.

```json
{
  "query": "Hotels in San Francisco, USA",
  "limit": 10,
  "language": "en",
  "region": "us",
  "extractEmailsAndContacts": false
}
```

Optional: `lat`, `lng`, `zoom`, `verified`, `businessStatus`, `subtypes`.

### search_local_businesses_nearby

Requires `query`, `lat`, `lng`.

```json
{
  "query": "coffee shops",
  "lat": 37.7749,
  "lng": -122.4194,
  "limit": 10
}
```

### get_local_business_details

Pass up to 20 `businessIds` (`business_id`, `google_id`, or `place_id` from a prior search).

```json
{
  "businessIds": ["0x8085808b287f3b3b:0xa49802f84f7ddb35"],
  "extractEmailsAndContacts": true
}
```

### autocomplete_local_businesses

Query suggestions while typing a local search.

```json
{
  "query": "Hilton San Fran"
}
```

## Persistence

This skill is **return-only**. Do not invent upsert tools.

- User wants CRM Company/Person records → load `data-manipulation` (or use workflow `CREATE_RECORD` / `UPSERT_RECORD`).
- User wants Find / Enroll / Harvest → load `search` / `outreach` after clarifying destination verbs.

## Response style

Summarize name, address, phone, website, rating, and `place_link`. Mention when contacts were requested and whether emails/socials came back.
