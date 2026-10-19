## Source: Exa

### Limits and exhaustion

The cap for this source is not documented here yet. Treat a page or batch that adds no new rows (all duplicates) as exhausted, and report that.

<!-- search-exa-people-source-section:start -->
### Source — Exa (`exa_web_search`)

Web/AI search for niche or public-profile people (speakers, authors, founders).

- `category`: `"people"`. Returns title/url/snippet only — extract name + profile hints from snippet.
- Requires `EXA_API_KEY` (tell the user if missing).

```
exa_web_search({
  "query": "backend engineers at fintech startups in Mumbai who speak at conferences",
  "category": "people",
  "numResults": 15
})
```

<!-- search-exa-people-source-section:end -->

<!-- search-exa-companies-source-section:start -->
### Source — Exa (`app_exa_web_search` / `exa_web_search`)

Web/AI search for new, niche, or poorly-covered companies.

- Prefer `app_exa_web_search` when preloaded; otherwise `exa_web_search`.
- Requires `EXA_API_KEY` (tell the user if missing).
- `category`: `"company"`. Returns title/url/snippet only — extract **name** from title and **domain** from URL host.
- Exa results go to a list like every other provider (see **Result lists**); you only get a `listId` and counts.

```
app_exa_web_search({
  "query": "Series B fintech startups in Mumbai hiring engineers",
  "category": "company",
  "numResults": 15
})
```

<!-- search-exa-companies-source-section:end -->
