## Companies

### Provider map (choose by intent)

{{sources: provider-map companies}}

### learn_tools (companies)

{{sources: learn-tools companies}}

Dedup across sources **by normalized name + domain** before saving.

### Outreach ephemeral save (default on /outreach-home)

Follow **Ephemeral write contract** (the head of this skill). Steps:

1. Collect + dedupe rows (normalize name; compare on **domain host**).
2. Map to `{ name, domain, industry, employees, segment, icpFit, status: "new" }` — domain = URL host without protocol.
3. Search tools in **Result lists** return a `listId`: show the rows with `outreach_list` `attach`. For a tool that still returns rows, build `companies[]` and make one `execute_tool` upsert. Never upsert from the sandbox.
4. Tell the user the Companies tab count (UI refreshes within a few seconds).

### Save to CRM (only when the user asks)

1. Normalize and dedupe on **domain host** or normalized name.
2. `save_outreach_targets_to_crm` with `target: "companies"`. Omit ids to save the whole tab. This creates Company records and does not start outreach.

### Places on a map

Use this when the user wants outlets they can walk into (hotels, restaurants, clinics, stores, plumbers) across a city. A firmographic set ("apparel brands in India") skips this and starts at Bright Data. A raw employer string with no map step is only `resolve_company_from_raw_name`.

A single `search_local_businesses` call does not cover a city. Run the seeded workflow:

1. `plan-local-business-city-coverage` builds the lat/lng grid and the cost estimate (optional `sample: true`).
2. `fetch-and-upsert-local-businesses` discovers over that grid and upserts Companies. `projectId` and `maxRecords` are required. Confirm the estimate first (`estimatedMaxRecords`, about $0.0015 per record).
3. `resolve_company_from_raw_name` on each place or brand name, so "Wow! Momo" becomes the canonical company.
4. `search_bright_data_business` with `entity: "company"` on that canonical name for the firmographic profile Maps does not have.

Bright Data Google Maps PAYG is about $1.50 per 1,000 records. Budget on gross deliveries. Do not invent another city-grid tool, and do not promise full-city coverage from one Maps search.

### Companies constraints

- On Outreach Companies tab, a Find must write the tab before ending: `search_bright_data_business` with `projectId`, or `outreach_list` `attach`, or `upsert_outreach_target_companies`. Do not end on a chat-only list.
- Present results with name, domain, industry, location, size, and source so the user can assess quality.
