## Source: Wikidata

<!-- search-wikidata-companies-source-section:start -->
### Source — Wikidata (`search_wikidata_companies`)

Structured enrichment from Wikidata (no API key). Best when you have a **domain** or need firmographic facts.

- Prefer `domain` lookup; optional `name` via `wbsearchentities`.
- Use to enrich Apollo/Exa/LinkedIn rows before save — not as a broad industry crawler.

```
search_wikidata_companies({
  "domain": "clariant.com"
})
```

<!-- search-wikidata-companies-source-section:end -->
