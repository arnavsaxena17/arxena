## Source: Wikidata

### Limits and exhaustion

The cap for this source is not documented here yet. Treat a page or batch that adds no new rows (all duplicates) as exhausted, and report that.

<!-- search-wikidata-companies-source-section:start -->
### Source — Wikidata (`search_wikidata_companies`)

Structured enrichment from Wikidata (no API key). Best when you have a **domain** or need firmographic facts.

- Prefer `domain` lookup; optional `name` via `wbsearchentities`.
- Use to enrich Apollo/Exa/LinkedIn rows before save — not as a broad industry crawler.

```
search_wikidata_companies({ "domain": "clariant.com" })
```

<!-- search-wikidata-companies-source-section:end -->
