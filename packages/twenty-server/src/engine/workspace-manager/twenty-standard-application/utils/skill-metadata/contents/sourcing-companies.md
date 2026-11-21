## Companies

### Provider map (choose by intent)

{{sources: provider-map companies}}

### What each source hands back

{{sources: returns companies}}

`returns` is a ceiling, not a promise: any field can be null on any row. For a
company hop, the key you need next is usually the **domain** (it feeds the
leadership page) or the **`linkedinUrl`** (it feeds the LinkedIn facets). Exa and
Wikidata hand back neither, so a row from them cannot be carried forward.

### What each source can filter on

{{sources: capabilities companies}}

Write the plan questions from the table above: it lists the filters each source really has. Never offer a filter a source does not have.

### learn_tools (companies)

Write and Save to CRM follow **Result lists** and **Write contract** in the head of this skill.

{{sources: learn-tools companies}}

The server dedupes on one key per row: domain, else LinkedIn company URL, else name alone (same-name companies without either merge). `against: "lists"` checks every list in the workspace. The CRM check uses the domain only: a row without one counts as new.

### Companies constraints

- Outlets on a map are "Places on a map" below, not this section.

- On Outreach Companies tab, a Find must write the tab before ending. Do not end on a chat-only list.
- Present results with name, domain, industry, location, size, and source so the user can assess quality.
- Save to CRM: `save_outreach_targets_to_crm` with `target: "companies"`.


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
