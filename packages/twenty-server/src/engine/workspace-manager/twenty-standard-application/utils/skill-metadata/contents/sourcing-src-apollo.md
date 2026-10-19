## Source: Apollo

### Limits and exhaustion

The cap for this source is not documented here yet. Treat a page or batch that adds no new rows (all duplicates) as exhausted, and report that.

<!-- search-apollo-people-source-section:start -->
### Source — Apollo (`search_apollo_people`)

Best for firmographic people search with contact data. Available in the `prospecting` pack.

- Use when the user names Apollo, or Bright Data is unavailable or returned nothing.
- Common filters: `person_titles`, `person_locations`, `q_keywords`, `organization_locations`, `organization_num_employees`.
- Returns name, title, company, location, and often email/phone — map to CRM candidate fields.

```
search_apollo_people({
  "person_titles": ["software engineer", "backend engineer"],
  "person_locations": ["New York, NY"],
  "q_organization_keywords": "fintech",
  "page_size": 25
})
```

<!-- search-apollo-people-source-section:end -->

<!-- search-apollo-companies-source-section:start -->
### Source — Apollo (`search_apollo_companies`)

Best for firmographic company search. Available in the `prospecting` pack.

- Use when the user names Apollo, or Bright Data is unavailable or returned nothing.
- Pass a structured filter object (organization params) — do not invent Apollo field names; `learn_tools` returns the live schema.
- Common filters: `organization_num_employees` ranges, `organization_industries`, `q_organization_keywords`, `organization_locations`.
- Keep `page_size` / `limit` modest; paginate with the returned cursor if the user wants more.
- Returns company name, domain, employee count, industry, location, and often LinkedIn URL — map these to CRM fields.

```
search_apollo_companies({
  "q_organization_keywords": "fintech",
  "organization_num_employees": ["51", "200"],
  "organization_locations": ["Mumbai, India"],
  "page_size": 25
})
```

<!-- search-apollo-companies-source-section:end -->
