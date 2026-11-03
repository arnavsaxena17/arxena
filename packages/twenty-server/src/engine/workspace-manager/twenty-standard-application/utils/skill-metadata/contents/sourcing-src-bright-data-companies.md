## Source: Bright Data, companies

{{sources: limits bright-data}}

<!-- search-bright-data-companies-source-section:start -->
### Source — Bright Data (`search_bright_data_business`)

`entity`: `"company"`. Requires `BRIGHT_DATA_API_KEY`; tell the user if it is missing.

{{include: bright-data-modes}}

### Instant recipe — one company by website or LinkedIn URL

Use this when the user gives a domain, website or LinkedIn company URL ("who is stripe.com", "enrich notion.so", "look up linkedin.com/company/abfrl"). The tool keeps only rows whose website host, or LinkedIn URL, matches.

1. Pass the bare host or URL with **no spaces** (`stripe.com`, `https://www.linkedin.com/company/abfrl`). Do not wrap it in a sentence.
2. Call once (no estimate, no budget ask):

```
search_bright_data_business({
  "entity": "company",
  "mode": "instant",
  "query": "stripe.com",
  "limit": 20
})
```

3. `count` and `companies` / `previewRows` are already filtered. If `count` is 0, say so, try an instant probe on the company name, then Wikidata (`search_wikidata_companies`). Never retry on ludicrous with the domain or URL: it has no such field.
4. Report name, domain, industry, LinkedIn URL, size. On Outreach Find the tab is written. A project is required; without one the tool refuses.

### Ludicrous query

**You pass one sentence and a budget. There is no filter argument.** The planner
compiles the sentence into the query, so every constraint you care about must be
in the words you write: *"glass manufacturing companies headquartered in Mumbai,
founded after 2010, excluding trading houses"*. A label you try to pass as an
argument is not a parameter and is dropped.

**What a query may say.** Only ideas the company data holds: what the company is (industry, about, specialties, name), where (country, city), organization type, founded year, employee size, funding, followers. Write "cosmetics and beauty retail companies in India", never "... with stores and outlets", "chain", "franchise", store counts, revenue or ad activity: those words are not in the data, so they break matching. Score those facts afterwards with enrichment columns (see **Scored lists**, then `ai-filter-enrich`).

**Before you fund it, read what it compiled.** The estimate returns
`intentSummary`, `relevanceCriteria` and the compiled `query` per slice, plus
each slice's `samplePrecision`. Check three things: the industry is the one you
wrote, there is no slice you did not ask for, and the precision is not low. If
any check fails, rewrite the sentence and estimate again — do not fund it.

{{include: bright-data-ludicrous-budget}}

```
// 1. estimate
search_bright_data_business({
  "entity": "company",
  "query": "Apparel brands in India"
})

// 2. after the user confirms $2
search_bright_data_business({
  "entity": "company",
  "query": "Apparel brands in India",
  "execute": true,
  "maxBudgetUsd": 2,
  "targetCount": 1000
})
```

A project is required: the estimate and the fetch both write that project's tab.

<!-- search-bright-data-companies-source-section:end -->
