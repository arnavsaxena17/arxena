# Company identity keys

One company, however its legal wrapper is spelled. `"Jubilant Foodworks"` and
`"Jubilant FoodWorks Ltd."` are one firm, so they must cost one provider call
and produce one ledger line.

## Why this needed its own concept

The repository had eleven company-name normalisers that disagreed with each
other. The most aggressive one is a port of the arxena-site
`DataCleaning.clean_company_names` pipeline, and it is a **search** cleaner: it
drops industry and geographic words to widen an Elasticsearch match. Used as an
identity it merges different companies:

| Input | Site cleaner output |
| --- | --- |
| `Bank of America` | `of` |
| `Bank of India` | `of` |
| `Tata Chemicals` | `tata` |
| `Tata Industries` | `tata` |
| `Campbell Soup Company` | `cbell soup` (`amp` is stripped as a substring) |
| `Société Générale` | `soci tgn rale` (non-ASCII is dropped) |

It also has no company abbreviation table: the abbreviation machinery in
arxena-site (`abbreviations.py`, `or_abbrev_aliases.py`) is job-title side.
Company aliases such as `L&T` → `Larsen & Toubro` are entity resolution, not
string normalisation.

So there are three jobs, and they get three functions.

## The three keys

| Function | Contract | Used for |
| --- | --- | --- |
| `companyIdentityKey(name)` | Conservative. Case-folded, NFKD-folded, punctuation-free, apostrophes deleted, `&` → `and`, trailing legal-suffix **run** removed. Never drops `group`, `holdings`, `industries`, `bank` or country words. | Cache keys, dedupe, cross-source joins |
| `companySearchQuery` (server-side) | Aggressive, lossy, tuned for recall. Stays in `org-chart/utils/clean-raw-company-name.util.ts`. | Building the Elasticsearch resolve query only |
| `companyCacheKeyOf({ id, linkedinUrl, name })` | `company:<id>` → `linkedin:company:<slug>` → `name:<identityKey>` | The key once the resolver has an entity |

`companyIdentityKey` and `companyCacheKeyOf` live in
`packages/twenty-shared/src/arx/companyName.ts` and are mirrored in
`arxena-site/arxenas3/model_arxena/data_standardization/company_identity.py`.
Both test files carry the same matrix.

## What must and must not collapse

Collapse:

- `Jubilant Foodworks` = `Jubilant FoodWorks Ltd.` = `Jubilant FoodWorks Limited` = `Jubilant FoodWorks Pvt. Ltd.`
- `Société Générale` = `Societe Generale`
- `Haldiram's` = `Haldirams`
- `Larsen & Toubro` = `Larsen and Toubro`

Do **not** collapse (these are the old cleaner's collisions):

- `Bank of America` ≠ `Bank of India`
- `Tata Chemicals` ≠ `Tata Industries`
- `Jubilant FoodWorks` ≠ `Jubilant FoodWorks Group`
- `Jubilant FoodWorks` ≠ `Jubilant FoodWorks Holdings`
- `Acme` ≠ `Acme Robotics`

A collision here is a correctness bug: the wrong company's answer is served
from cache. Both test files assert the negative cases.

## Where it is applied

`ProviderQueryCacheService.getOrFetch` grew an optional `keyParts` argument, so
the **key** can be canonical while the **recorded request** stays exactly as the
user wrote it. The ledger keeps the raw request for replay and audit; the cache
and the history dedupe on the key.

| Call site | Prefix | Canonical field |
| --- | --- | --- |
| `wikidata-company-search.service.ts` | `wikidata-name:v2` | `name` |
| `linkedin-search.service.ts` | `unipile-search:v2` | `company`, `past_company` and their filters, via `canonicalizeLinkedInSearchRequest` |
| `harvest-linkedin.service.ts` | `harvest-search:v2` | `company`, and `search` on the company-search path only |

Prefixes that changed behaviour were bumped to `:v2`. The old digests are
unreachable and expire on their own TTL; the S3 objects under
`provider-query-cache/<prefix>/` are no longer written.

Not changed on purpose:

- `bright-data-serp` and `bright-data-business-search` key on a query string
  built from `CompanyIdentity.canonicalName`, which the resolver has already
  canonicalised. Rewriting the query would change what Google/Bright Data
  answer, which is a different decision from deduping the key.
- `company-name-resolver` already collapses spellings (it cleans before
  keying). Its remaining problem is the opposite one — the search cleaner can
  *over*-merge (`Bank of America` and `Bank of India` both key to `of`). Fixing
  that means keying on `companyIdentityKey` while still querying with the
  search cleaner; it is the first item of phase 2.

## Ledger history

`provider-call:trace --thread <id> --requests` now groups rows by the same
signature it uses for `--compare`, printing `xN` beside a repeated request.
Combined with the canonical cache key, a company searched under two spellings
appears once with a repeat count instead of twice.

## Phase 2

1. Key `company-name-resolver` on `companyIdentityKey(raw)` while keeping the
   search cleaner for the ES query, and bump its prefix to `v2`.
2. Prefer `companyCacheKeyOf` in the providers once the resolver returns an
   id, LinkedIn company or domain — that also merges `L&T` with
   `Larsen & Toubro`, which no string key can do.
3. Retire the duplicate normalisers: `person-identity.util.ts`,
   `resolve-people-company-ids.util.ts` (it also drops `india`),
   `score-company-name-match.util.ts` (it drops `group`/`holdings`, which
   contradicts `person-identity`), `harvest-company-name-match.util.ts`,
   `match-bright-data-company-name.util.ts` and the local copies in
   `outreach-company-resolver.util.ts` and `keep-one-person-per-company.util.ts`.
