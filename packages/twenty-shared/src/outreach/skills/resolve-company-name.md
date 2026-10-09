# Resolve Company Name

Use this skill when the user has a **raw / messy employer string** (resume company, LinkedIn experience text, spreadsheet cell) and needs the **standardized company profile** from Arxena's `std_company_data_scores` index.

Prefer the broader `search` skill for firmographic discovery (Apollo / LinkedIn / Harvest). Prefer `search_companies_index` for free-text company search across indices. Prefer this skill for **one best standardized match** from a noisy name.

## Cleaning

Before ES lookup, raw names are cleaned with the DataCleaning pipeline (lowercase, drop corporate/geo/industry stopwords, strip symbols, merge single-letter tokens) then CompanyCollector uppercase. Example: `Nestle India Ltd` → `NESTLE`.

## Tool

```
learn_tools({ toolNames: ["resolve_company_from_raw_name"] })

execute_tool({
  toolName: "resolve_company_from_raw_name",
  arguments: {
    companyName: "Larsen & Toubro (L&T)"
  }
})
```

Batch:

```
execute_tool({
  toolName: "resolve_company_from_raw_name",
  arguments: {
    companyNames: [
      "Torrent Power",
      "Zydus Lifesciences Ltd.",
      "Nestle India Ltd"
    ]
  }
})
```

## Output fields

Each result includes:

- `cleanedQuery` — suffix-stripped uppercase query sent to ES
- `resolved` — whether a best hit was found
- `name`, `id`, `website`, `linkedinUrl`, `countOrg`, `size`, `industry`
- `editDistance` — Levenshtein distance between cleaned query and resolved name

## Do not

- Invent company metadata when `resolved` is false (e.g. "Confidential", "Self Employed")
- Use this for Google Maps / local POI lookups (`local-business-search`)
- Skip `learn_tools` before the first call
