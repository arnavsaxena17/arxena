## Places on a map

Use this when the user wants outlets they can walk into (hotels, restaurants, clinics, stores, plumbers) across a city. A firmographic set ("apparel brands in India") is `companies`, not this. A raw employer string with no map step is only `resolve_company_from_raw_name`.

A single `search_local_businesses` call does not cover a city. Run the seeded workflow:

1. `plan-local-business-city-coverage` builds the lat/lng grid and the cost estimate (optional `sample: true`).
2. `fetch-and-upsert-local-businesses` discovers over that grid and upserts Companies. `projectId` and `maxRecords` are required. Confirm the estimate first (`estimatedMaxRecords`, about {{fact: google-maps.costPerRecord}} per record).
3. `resolve_company_from_raw_name` on each place or brand name, so "Wow! Momo" becomes the canonical company.
4. `search_bright_data_business` with `entity: "company"` on that canonical name for the firmographic profile Maps does not have.

Bright Data Google Maps PAYG is about {{fact: google-maps.costPerThousand}} per 1,000 records. Budget on gross deliveries. Do not invent another city-grid tool, and do not promise full-city coverage from one Maps search.

### learn_tools (places)

```
learn_tools({
  "toolNames": [
    "plan-local-business-city-coverage",
    "fetch-and-upsert-local-businesses",
    "resolve_company_from_raw_name",
    "search_bright_data_business",
    "get_outreach_tab"
  ]
})
```

Pass `projectId` so the tab is written. Save to CRM follows **Write contract** in the head of this skill.
