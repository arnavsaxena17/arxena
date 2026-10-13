## Build a target list (loop: fetch → filter → enrich → filter → fetch more)

Use this section when the user wants a **finished list of about N companies** that must be both *found* and *judged* ("build a list of 600 multi-store retail brands in India that run digital marketing"). A single search is never enough: the sources hold broad categories, not the user's criteria (store count, revenue and marketing activity are not on the rows). So you run rounds until the filtered list reaches the target. Companies are the unit; for people lists use the People section.

Load `ai-filter-enrich` as well (`load_skills(["search", "ai-filter-enrich"])`) and `learn_tools` once for every tool in both skills, plus `ask_questions`.

**You run this loop yourself.** You decide how many queries to write, which ones, in which order, and when to fetch, filter, enrich or stop. The steps below are the tools and the guardrails (caps, order of cost), not a script with fixed counts.

### Step 0. Brief, rubric, one approval

1. Resolve `projectId` first (see the write contract). Results go to that project's Companies tab, so every round lands in one working set.
2. Turn the request into a **rubric** and show it in three lines: *hard criteria* (country, minimum outlets, categories), *soft signals* (runs digital marketing, inventory-heavy), and the **target N**. Do not ask about anything you can default or the user already stated (if the request names caps, a store threshold or a target, use them and skip that question).
3. State the economics before asking: Bright Data bills $0.002 per record, and only a share of what you fetch will survive the filters. Assume roughly **15%** until round 1 measures the real rate, so the first guess at the raw volume is `N / 0.15` records (600 → about 4,000 ≈ $8), plus the enrichment cost the previews show.
4. Ask **once** with `ask_questions`: "I will run fetch → filter → enrich rounds until about N companies match. Caps: fetch up to $X, enrichment up to $Y. Go?" (options: Go with these caps / Change the caps / Cancel). A yes is the approval for every estimate, fetch and column run **inside those caps**, so do not ask again per round. Ask again only to go past a cap or to change the rubric.

### Step 1. Query plan (yours to design)

You decide how many queries, which ones, and when to run them. Start with a first batch broad enough to measure the survival rate, then let each round's results decide the next batch (more of what produced matches, none of what did not).

**A Bright Data query can only use ideas the company data exposes.** Every word of your sentence is turned into a search on one of these fields, and topic words must all appear, so a word the data never contains makes the query return nothing or junk. The queryable company fields are:

- `industry` (LinkedIn's own industry names, such as Restaurants, Food and Beverage Services, Retail, Retail Apparel and Fashion, Retail Health and Personal Care Products, Retail Luxury Goods and Jewelry, Retail Furniture and Home Furnishings), `about`, `specialties`, `name`, `slogan`: words a company uses to describe itself
- `headquarters_country_code`, `offices_country_codes`, `headquarters_city`, `offices_cities`, `headquarters_location`: where
- `organization_type`, `founded_year`, `employees_in_linkedin`, `company_size_from` / `company_size_to` (LinkedIn size buckets), `funding_stage`, `funding_raised`, `linkedin_followers`

So write each query as **what the company is + where**: "cosmetics and beauty retail companies in India", "quick service restaurant and fast food companies in India", "apparel and fashion retail companies in India". Never put these in a query, because the data does not hold them and the words break matching: number of stores or outlets ("with stores and outlets", "more than 30 stores"), "chain", "franchise", revenue, whether the company runs ads, or any other fact that only enrichment can find. Do not write "with stores", "outlets" or "chains" at all. Multi-store scale is judged later by the enrichment columns; the size bucket (for example 201+ employees) is the only scale signal a query can carry.

Ways to get more rows and fewer overlaps from the same topic (one query returns at most 1,100 rows):

- one query per city (Mumbai, Delhi NCR, Bengaluru, Hyderabad, Chennai, Pune, Kolkata) or per size bucket (51–200, 201–500, 501–1,000, 1,000+ employees)
- one query per synonym of the category noun ("restaurants", "fast food", "cafe", "bakery", "quick service restaurant"; "cosmetics", "skincare", "beauty", "salon")
- one query per LinkedIn industry that holds the category

**Sweeping a priority category completely.** Topic words ("quick service restaurant", "fast food") only match companies whose about text or specialties use those words, and a fetch stops a slice early when its relevance drops, so well-known companies whose profile is worded differently are missed (Wow! Momo is filed under "Food and Beverage Services" and does not say "quick service restaurant"). To get all of a category, sweep the data instead of searching words: one query per LinkedIn industry that holds it (for food: Restaurants, Food and Beverage Services, Food and Beverage Retail, plus Retail for cafes and bakeries) × India × each employee size bucket from 51 up, with no topic words, then let the gate column remove the non-fits. Large size buckets are small, so fetch them whole. After the sweep, spot-check three or four well-known names of the category (for QSR: Wow! Momo, Haldiram's, Faasos, Barbeque Nation) against the list; if one is missing, the sweep is not complete, so add the slice that should have held it.

Categories for a retail brief: apparel, footwear and accessories, beauty and cosmetics, salons and wellness, food and beverage, grocery and supermarkets, pharmacy and health, jewellery, eyewear, electronics and mobile retail, home and furniture, kids and toys, sports and fitness. If the user names a priority category, fetch **all** of it first (every city and size slice, every synonym) before spending on others.

Keep a **ledger** and show it after each round as one table: query → planId → records fetched → survived the filters. Copy each `planId` exactly, next to its query; a fetch with another query's `planId` fails or fetches the wrong slice.

### Step 2. Estimate queries (cheap)

Call `search_bright_data_business` with **no `planId` and no `projectId`** for the queries you intend to run. Each costs a few cents and writes nothing. Estimate in batches, and only the queries you may actually fetch, so estimate spend stays small. Then handle weak queries. A query whose slices all matched 0 is almost always over-worded (a word the data does not hold, several conjunctive terms, a rare noun), not an empty category: for a category the brief names, rewrite it simpler (one concept, common words such as "fashion brand" or "clothing retail chain", fewer conditions) and estimate again, up to twice, before dropping it. Drop a query only when its `samplePrecision` stays low after rewording. Rank the rest by `samplePrecision` and `fetchableRecords`, and show a ranked table, not every estimate.

### Step 3. Fetch (inside the approved cap)

Fetch the best queries first, each with its `planId`, the `projectId`, `maxBudgetUsd` (what you choose for that query from the remaining fetch cap, at most 10) and `targetCount`. Choose the size of a round yourself, but keep it small enough that the enrichment bill of Step 4 stays well inside its cap. Rows go to the Companies tab and duplicates across queries are dropped, so do not upsert and do not re-fetch the same query.

### Step 4. Filter funnel, cheapest first

The sources are LinkedIn-derived, so **store count, revenue and marketing activity are never in the data**: they are enrichment columns. The server picks the engine from the description you give `preview_ai_column`:

| Question | Engine | Cost |
| --- | --- | --- |
| Judged from what is on the row (is it a consumer retail/F&B/beauty brand, a marketplace, a manufacturer) | jev, else gpt-4o-mini | cents for the whole list |
| Language work and stable knowledge a model already has | gpt-4o-mini | cheap |
| Facts a model cannot reliably know: current store count, revenue | OpenAI web search (one search per company) | about $0.04 per company, **by far the most expensive step** |

Web search is the last and smallest step, never the first. Every company you search costs money, so cut the list with free information before any search:

1. **Gate (cheap, row-answerable).** `preview_ai_column` with `subject: "company"` and a description like "is this a consumer-facing brand or retailer that sells through its own physical stores or outlets in India (not a marketplace, manufacturer, agency, software or service firm)". The model reads the whole record, including about and specialties, which often state store counts. Run it, then `generate_table_view` ("only the ones marked yes") and `apply_table_view`.
2. **Proxy filter (free).** Every Bright Data row already carries LinkedIn size signals as columns: Employees On Linkedin, Linkedin Followers, Size Band, Office Address Count. A company with 20+ stores is almost always large on LinkedIn, so keep the larger ones and leave the small ones out of the search. Pick the cut-off from the data, not by guess: read the distribution with `get_outreach_working_set({ ..., summarize: ["employeesOnLinkedin", "linkedinFollowers"], onlyViewMatches: true })` (never page through rows to tally them), and use any store counts already on the rows to see which employee or follower level keeps most of the 20+ store companies (a typical cut is employees 100 or more, or followers 20,000 or more, which kept about two thirds of known 20+ store companies in a quarter of the rows). Apply it with `generate_table_view` ("employees on linkedin at least 150 or linkedin followers at least 20000") and `apply_table_view`. Choose the threshold so that (rows left) × $0.04 fits the remaining enrichment cap with room to spare, and say in one line what the cut-off was and what share of known qualifying companies it keeps.
3. **Enrich the survivors, once.** One web-search column that returns **all** the web facts for a company in a single search: store count in India, annual revenue in INR crore, and whether it runs paid digital marketing (a yes/no with the source). Several fields in one column cost one search; several columns cost several. Run it with `run_ai_column({ ..., onlyViewMatches: true })` so only the proxy survivors are searched. Pass the domain and employees so look-alike brands are not confused. The preview must show a web-search engine and an estimated cost; check that cost against the remaining cap and against what finished runs really cost per row. If it would exceed the cap, tighten the proxy filter (a higher cut-off) instead of asking for more money. A company already answered is never searched again.
4. **Final filter.** `generate_table_view` with the hard criteria in the user's words ("store count at least 20 and runs digital marketing, India"), then `apply_table_view` unchanged. `matchCount` is the number that counts toward the target.

**Check the engine before you run a column.** A fact outside the row must come back from the preview with a web-search engine. If it previews on `jev` or a plain model with no search, the answers are guesses from the row: do not run it. Preview again with a description that says it is looked up on the web ("look up on the web ... and give the source").

**Sanity-check web numbers before the final filter**: a store count that is implausible for the company (hundreds of stores for a company with a handful of employees, a count that matches a different, bigger brand with a similar name) is not a match. Read the extremes with `get_outreach_working_set`, treat implausible ones as unknown, and say how many you set aside. Empty or "unknown" means no credible answer: never fill it in yourself.

**Reuse columns.** Every step above fills one fixed set of columns: the gate/classification column, the brand category, store count and revenue. A later round, a new threshold or a better engine fills or updates those same columns (see **One column per fact** in the AI Filter & Enrich skill); it never creates a second store count or a second revenue column.

Rows are never deleted: the view hides non-matches, and later runs skip rows that already have an answer, so nothing is paid for twice. Because the applied view scopes `onlyViewMatches`, apply the proxy-filter view (not the final one) before enriching a batch of newly fetched rows, and run the gate on new rows first.

### Step 5. Decide the next round (the loop)

After each round report one line: `matchCount of N`, spent vs cap, survival rate this round. Then decide:

- **matchCount ≥ N** (or within about 5%): stop and hand over (Step 6).
- **below N, caps left:** recompute the need as `(N − matchCount) / measured survival rate`. Change the plan, do not repeat it: write the next queries from what produced survivors (their categories, cities, size buckets, wording), drop what produced almost none, and say so when a whole category stays under about 5%. Go back to Step 2, or straight to Step 3 for queries already estimated.
- **caps reached short of N:** stop, report the real count, what each category yielded, and what extra budget would likely add. Never exceed a cap.
- **two rounds in a row add fewer than about 5% new matches:** the sources are exhausted for this brief. Say so, and suggest loosening the rubric (for example 15+ stores) rather than fetching more.

Keep chat short during the loop: one status line per round, the ledger table, no row dumps.

### Step 6. Hand over

Report: final count, total spent (fetch and enrichment), per-category counts from the `summary` and the ledger, which engine answered each column, and where the rows are (the project's Companies tab, filtered view applied). Offer `outreach_list` `export` (CSV) and `save_to_crm`; do neither without the user's go-ahead.
