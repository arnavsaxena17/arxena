## Industry search

Use this when the request names an industry, sector or segment: "pharma companies", "electrical goods makers", "people in fintech", "peers of Tetra Pak".

### Turn the user's words into industry labels

Each company page picks **one** industry, and the company chooses it, so a segment is spread over several labels.

- **Map the segment to every label its companies might pick.** Include the industry itself, its parent group and the sibling labels that sell the same thing. For example, "electrical goods" covers:
  - Electrical Equipment Manufacturing
  - Electric Lighting Equipment Manufacturing
  - Appliances, Electrical, and Electronics Manufacturing
  - Wholesale Appliances, Electrical, and Electronics
  - Retail Appliances, Electrical, and Electronic Equipment

  Add the old (V1) label wherever one exists.
- **A label alone is weak evidence.** It is chosen by the company and is broad. Pair it with product words found in the about and specialties text, then score segment fit from what the company sells.
- **Some words are not industries.** "Sales", "D2C", "startup", "MNC" and "listed" are channels or attributes, never industry labels. Score them as criteria.
- **Say the label list in one line** in the plan, so the user can correct it before any paid search.

### Sources, cheapest first

Use only the sources the user picked for this run.

| Step | Source | How the industry is matched |
| --- | --- | --- |
| 1 | Arxena index (`search_companies_index`, `industry`) | Free and fast, but shallow: name, website, LinkedIn URL, industry, size. Build the first pool here. Companies only |
| 2 | Bright Data companies (`search_bright_data_business`, `entity: "company"`) | `industry` is a text field (bag of words); the planner also matches about and specialties. Use it to top up the pool and to get the fields filtering needs. Estimate first |
| 3 | Harvest or the user's Sales Navigator | Industry facet by id; resolve the ids with `generate_linkedin_query_set`. Can be multi-select |
| 4 | Apollo, Exa, Wikidata | Only when the workspace has them switched on |

Go to the next step only when the pool is not adequate. That means it is far below the expected size from the probe, or it lacks a field the company rubric needs (size, location, about). Say which of the two it was.

### By kind of search

| Search | Do this |
| --- | --- |
| Companies in an industry | The steps above, with every label from the mapping, unioned and deduped |
| People whose employer is in an industry | Build the companies first (`playbook-company-first`). Bright Data people `current_company_industry` and the Sales Navigator / Harvest industry facet also work, but they match the employer's self-chosen label. LinkedIn Classic has no reliable industry filter |
| Peers of a named company | Same label and sibling labels, similar size band and geography; then look-alikes from the about text |
| Adjacent industries (shortfall) | Sibling labels under the same parent first, then the parent sector. Never jump sectors without saying so |
| Industry plus size or revenue | The industry finds the pool; size and revenue are separate criteria (size from the row, revenue from a web column) |

### Labels

The full label list, the exact spelling rules and the old-to-new renames are in `industry-labels`. Load it when you are not sure of the exact labels for a sector, before the first search that uses them.
