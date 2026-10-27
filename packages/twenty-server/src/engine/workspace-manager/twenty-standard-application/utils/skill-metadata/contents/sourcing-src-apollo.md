## Source: Apollo

<!-- search-apollo-people-source-section:start -->
### Source — Apollo (`search_apollo_people`)

Best for firmographic people search with contact data. Available in the `prospecting` pack.

- Use when the user names Apollo, or Bright Data is unavailable or returned nothing.
- Common filters: `person_titles`, `person_locations`, `q_keywords`, `organization_locations`, `organization_num_employees`.
- Returns name, title, company, location, and often email/phone — map to CRM candidate fields.

```
search_apollo_people({
  "personTitles": ["software engineer", "backend engineer"],
  "personLocations": ["New York, NY"],
  "keywords": "fintech",
  "perPage": 25
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
  "organizationName": "fintech",
  "organizationLocations": ["Mumbai, India"],
  "perPage": 25
})
```


<!-- search-apollo-companies-source-section:end -->
