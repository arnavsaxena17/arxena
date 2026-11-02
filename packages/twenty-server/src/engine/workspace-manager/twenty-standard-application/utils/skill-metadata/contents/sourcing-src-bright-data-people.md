## Source: Bright Data, people

{{sources: limits bright-data}}

<!-- search-bright-data-people-source-section:start -->
### Source — Bright Data (`search_bright_data_business`)

`entity`: `"people"`. Requires `BRIGHT_DATA_API_KEY`; tell the user if it is missing.

{{include: bright-data-modes}}

A role at companies already named is `people-by-company`, not this estimate.

### Ludicrous query

**You pass one sentence and a budget. There is no filter argument.** The planner
compiles the sentence, so every constraint must be in the words: *"sales heads at
pharmaceutical companies in Mumbai, excluding contractors"*.

**What a query may say.** Only ideas the people data holds: title (current or past), employer (current or past), the employer's industry, skills, certifications, location (country, city), name. A people search cannot filter on company attributes such as funding, size or headquarters; for those, search companies first, then people. Score facts that are not fields (years of experience, team size) afterwards with enrichment columns.

**Before you fund it, read what it compiled.** The estimate returns
`intentSummary`, `relevanceCriteria` and the compiled `query` per slice, plus
each slice's `samplePrecision`. Check that the titles and the employer industry
are what you wrote, that there is no slice you did not ask for, and that the
precision is not low. If a check fails, rewrite the sentence and estimate again.

{{include: boolean-title-strings}}

{{include: bright-data-ludicrous-budget}}

```
// 1. estimate
search_bright_data_business({
  "entity": "people",
  "query": "MD or CEO of QSR restaurants in India"
})

// 2. after the user confirms $2
search_bright_data_business({
  "entity": "people",
  "query": "MD or CEO of QSR restaurants in India",
  "execute": true,
  "maxBudgetUsd": 2,
  "targetCount": 1000
})
```

A project is required: the estimate and the fetch both write that project's tab.

<!-- search-bright-data-people-source-section:end -->
