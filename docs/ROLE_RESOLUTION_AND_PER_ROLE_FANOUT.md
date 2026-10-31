# Role resolution and per-role fan-out in `find_people_by_company`

Status: implemented. Phases 1-4 done (§0); phases 5-6 are the model text and a taxonomy data fix.
Last updated: 2026-10-30
Trigger: project `b47222b6-e181-48c3-b7b9-7811800c4288`, chat
`cfe034b1-6085-4992-8d78-3fafa8fbe7d4`, run at 18:49.

## 0. Implemented

Phases 1-4 are implemented and tested; the model-facing text (§10) is not yet changed.

| Change | File | Tests |
| --- | --- | --- |
| Root query is the fallback even when the function is its own root (§3.3) | `title-expansion.service.ts` `getCuratedQuery` | "should use the root query when the function is its own root"; "should prefer the function query over the root when both exist" |
| A sibling function under the same root scores 1 (rung 3), not 0 (§3.5) | `role-title-matching.util.ts` `scoreRoleMatch` | "should keep a sibling function under the same root as a related role"; "should not treat another root as a sibling" |
| The judge names a combined role's functions as related, so its verdict does not override the sibling rule (§3.5) | `candidate-judge.service.ts`, `bright-data-person-fit-filter.service.ts` | judge and fit-filter suites pass |
| Term budget for every curated expression, frequency-ordered (§4.1) | `boolean-expression-budget.util.ts`, `title-expansion.service.ts` | budget util suite; "should cap a long curated query to the term budget" |
| Google gets its own clause, trimmed to 28 words instead of dropped at 30 (§4.1) | `title-expansion.service.ts` `getGoogleQuery` | "should bring a root query under the Google word ceiling instead of dropping it" |
| Coordinated mentions split into one role per function (§7) | `role-mention-split.util.ts`, `title-expansion.service.ts` `resolveRoles` | splitter suite; "should split a coordinated mention into one role per function"; "should keep a compound mention whole" |
| One search per role class, per-role budget, per-candidate evidence (§8) | `role-search-plan.util.ts`, `find-people-cascade.service.ts` | role-search suite; cascade fan-out suite |

Effect on the original run (verified live against the taxonomy service): the mention becomes
`Head of Supply Chain` + `Head of Logistics`, so five roles are searched as three classes —
supply chain, logistics and procurement (Procurement Head, Purchase Head and CPO share one
search). Bright Data and Harvest now run the logistics search that never happened, a logistics
head is kept at rung 3 and binds to its own pair, and each expression is inside a term budget:
the supply chain Google clause drops `"general manager"` (31 -> 28 words) instead of being
thrown away by Google's 30-word gate.

Verification: 11 focused suites, 110 tests. The large `find-people-by-company-tool.spec.ts` has 50
pre-existing 5 s timeouts in this working tree; they reproduce with the phase-2 change reverted,
so they are unrelated to this diff.

## 1. What was asked and what was passed

User prompt:

> We need connect with **Head of Supply Chain / Logistics** and **Procurement Heads** for the
> following clients ... Akshayakalpa, Shadowfax, Milky Mist, Jubilant Foodworks, Hatsun Agro, Zomato

The agent called:

```json
roles: [
  "Head of Supply Chain & Logistics",
  "Procurement Head",
  "Purchase Head",
  "Chief Procurement Officer"
]
```

and the tool logged:

```
Using manual boolean title filter(s) for [...]:
((procurement OR purchasing OR sourcing) AND (head OR director OR VP OR president OR chief ...))
```

That log line is the whole failure in one string: **the only title filter that reached the
search was the procurement one.** `supply chain`, `logistics` and `purchase` appear nowhere in
it. The run produced 24 pairs (6 companies x 4 roles) but searched for roughly one and a half
functions.

## 2. Reproduction (local taxonomy at `localhost:5050`)

`TitleExpansionService.resolveRoles` simulated against the live taxonomy, with the exact code
path in this repo:

### What the agent sent

| Role as typed | function | grade | curated boolean for it |
| --- | --- | --- | --- |
| `Head of Supply Chain & Logistics` | `supply chain` (root `supply chain`) | leadership | **none** |
| `Procurement Head` | `procurement` (root `supply chain`) | leadership | procurement clause |
| `Purchase Head` | *unclassified* | leadership | **none** |
| `Chief Procurement Officer` | `procurement` (root `supply chain`) | leadership | procurement clause (dup) |

Boolean used: `(procurement OR purchasing OR sourcing) AND (head OR ...)` — matches the
production log exactly.

### What splitting the mention would have produced

| Role as typed | function | curated boolean for it |
| --- | --- | --- |
| `Head of Supply Chain` | `supply chain` (root `supply chain`) | **none** (same bug) |
| `Head of Logistics` | `logistics` (root `supply chain`) | `(logistics OR freight OR transportation) AND (head OR ...)` |
| `Procurement Head` | `procurement` | procurement clause |
| `Chief Procurement Officer` | `procurement` | procurement clause (dup) |

Boolean: `(logistics OR freight OR transportation) AND (head ...)` **OR** `(procurement ...)`.

So splitting fixes the logistics half immediately but **supply chain is still lost** until the
root-query bug in §3.3 is fixed, which would then add
`("Supply Chain" OR procurement OR logistics OR SCM) AND (head ...) OR CSCO`.

### Word order does not help

`Head of Logistics & Supply Chain`, `Supply Chain and Logistics Head` and
`Head of Supply Chain, Logistics` all classify as `supply chain`. A conjoined title is
therefore *always* lossy in the same direction, not randomly lossy.

## 3. Five separate defects

The club is not one bug; five independent things each drop a role. Fixing any one alone leaves
the run wrong.

### 3.1 The agent was never told roles are atomic

`find-people-by-company-tool.schema.ts:82-88`:

> Roles the user asked for, in their words (CEO, MD, ...). **Pass every role the user named.**

Nothing says one designation per entry, or what to do with `/`, `&`, `and`. The model did
exactly what the schema asks: it copied the user's phrase and normalized the separator to `&`.
`Head of Supply Chain / Logistics` is ambiguous English — it can be one combined function
(common in Indian mid-market orgs) or two roles. With no instruction, the model chose one.

The skill (`sourcing-people-by-company.md`) only checks the "role reading" *after* the pilot,
i.e. after the search has already been narrowed.

### 3.2 The taxonomy is single-label, and `supply chain` absorbs `logistics`

`Head of Supply Chain & Logistics` -> function `supply chain`, confidence 0.75, stable across
runs. The taxonomy maps one title to one function; there is no "two functions" representation.
Because the supply-chain root contains procurement and logistics as children, the root's
curated query *would* cover logistics — but only if it is reached (see 3.3).

### 3.3 The root query is skipped when the function **is** the root

`title-expansion.service.ts:251-266`:

```ts
const specific = await this.fetchCuratedQuery({ kind: 'std_function', label: titleClass.functionId, ... });
const byRoot =
  specific === null &&
  titleClass.functionRoot !== null &&
  titleClass.functionRoot !== titleClass.functionId   // <-- blocks the fix
    ? await this.fetchCuratedQuery({ kind: 'std_function_root', label: titleClass.functionRoot, ... })
    : null;
const value = specific ?? byRoot;
```

`supply chain` has **no** `std_function` row at leadership (`count: 0`), and its function id
equals its root, so the `std_function_root` row —
`("Supply Chain" OR procurement OR logistics OR SCM) AND (head ...) OR CSCO` — is never
looked up. The role contributes nothing to `titleExpressions`, silently.

This is the single highest-value fix in the chain: it costs one condition, and it makes even
the *un-split* conjoined role search logistics and supply chain on Bright Data and Harvest.

### 3.4 One boolean replaces all titles in Bright Data and Harvest

`find-people-cascade.service.ts:545` builds one title list for the whole company, capped at
`MAX_TITLES_IN_QUERY = 8`, and `:1215-1229` sends **one** Bright Data search with the merged
`booleanTitleExpression`. In `bright-data-ludicrous-shard-compiler.util.ts:98-106` the boolean
*wins*: when it is non-empty, `titles` is ignored.

So the four roles are represented by however many distinct curated clauses exist (here: one),
and any role whose class has no clause (`supply chain`, `purchase`) is absent from the search
entirely. `Purchase Head` survives only as a literal string in the Google query text.

### 3.5 The verify gate treats a sibling function as a mismatch

`role-title-matching.util.ts:77-91`:

```ts
const sameClass =
  candidateClass !== null &&
  requestedClasses.some((requested) => requested.functionId === candidateClass.functionId && ...);
...
if (!sameClass && !containsTypedRole) return 0;   // 0 = rejected
```

`Head of Logistics` -> class `logistics`; requested classes are `supply chain` + `procurement`;
the title does not literally contain `Head of Supply Chain & Logistics`. Score 0, rejected as
`role_mismatch`.

The LLM judge can rescue it (`find-people-cascade.service.ts:1869-1878` prefers the judge's
verdict when present), but the judge only sees the merged role string and may answer `related`
or `none`; and even when a `related` person is kept, `roleMatchesOf` scores per role with the
same functionId gate, so the person carries **no** role match and the conjoined pair is
reported `none_found / profile_gaps` while the person sits on the People tab.

**Consequence: even a logistics head that reached the candidate list would not have been
counted for the role.**

## 4. Term limits on root queries

### 4.1 What existed, and what did not

The arxena-site taxonomy already selects OR terms by frequency, in three places:

| Mechanism | What it does | Used by |
| --- | --- | --- |
| `select_leaf_representative_or_terms` / `boolean_query_from_std_function` (`arxenas3/query_generators/linkedin_truth_keywords.py`) | ranks terms by job-title frequency from `sg_job_title_term_frequencies.csv`; one representative per child function for a root; caps at `max_terms`; prefers the precomputed `std_function_or_queries` / `std_function_root_or_queries` CSV with phrase-preserving truncation | the query-set path and `generate_keywords` |
| `POST /api/title-taxonomy/keywords` | ranked terms with counts for one function or root (`max_terms`) | `generate_keywords` |
| `POST /api/query-generator/linkedin/query-set` | function + grade terms chunked into several queries of `max_terms_per_query` each | the LinkedIn query-set path |

What did **not** use any of it is the path this tool takes: `GET /api/title-taxonomy/manual-boolean-queries`
returns the hand-curated CSV row verbatim. Root rows run 26-32 words
(`operations` 32, `supply chain`/`sales`/`human resources` 31), and Nest had only two gates:

- Google: `isGoogleTitleClauseUsable` drops a clause over 30 words **entirely**. Measured on the
  curated rows: `operations` root is 31 words after AND removal and was dropped; supply chain is
  exactly 30 and only just survived.
- Bright Data / Harvest: no limit at all, and the combined expression OR-ed every role's clause,
  so a four-role call sent one ~120-word filter.

So: frequency selection existed, term limits for the manual/root path did not.

### 4.2 What was added

`title-taxonomy/boolean-expression-budget.util.ts` parses a boolean expression, ranks its OR
terms by frequency, and caps it by terms and words without dropping an AND branch:

- `DEFAULT_BOOLEAN_TERM_BUDGET` = 20 terms, 45 words, 12 per OR group (provider filter).
- `GOOGLE_TITLE_TERM_BUDGET` = 16 terms, 28 words, 10 per group (Google clause).
- Rank comes from `POST /api/title-taxonomy/keywords` (`getRankedKeywords`), i.e. the same
  frequency ranking the taxonomy's own generator uses. A curated phrase is ranked by its words
  when the list holds them separately ("Supply Chain" by "supply"), and the class's own label is
  pinned first so the root's name is never the term dropped.
- Unknown terms keep their curated order and are trimmed from the end, which is how `AVP`, `GM`
  and `"general manager"` leave an over-long grade group first.

`resolveRoles` now returns `titleExpressions` (provider budget) and `googleTitleExpressions`
(Google budget), and the cascade gives Google the latter instead of letting it drop the clause.

### 4.3 Other gaps found on the way

- `Purchase Head` classified as `unclassified` in one probe batch and as `procurement` in
  another (the classifier reads the batch), while `Purchasing Head`, `Buyer` and
  `Head of Procurement` are always `procurement`. If it lands unclassified it still gets a
  search (its typed title), but no boolean clause. Worth a fixture test in arxena-site.
- The cache key and the pair key are built from the role strings as typed
  (`find-people-cascade.service.ts`, `outreach-people-found.util.ts:55`), so rewording a role
  creates a new pair and re-searches. Roles are now canonicalised before the run, which keeps
  the split parts stable, but a user re-wording a role still starts a new pair.
- `AI_OVERVIEW_QUERY_LIMIT` stays 3: the overview is a slow, probabilistic pass and one question
  per function class is the point of diminishing returns.

## 5. What "correct" looks like

For this prompt, before any spend:

```
roles:
  1. Head of Supply Chain        (supply chain / leadership)
  2. Head of Logistics           (logistics / leadership)
  3. Procurement Head            (procurement / leadership)
  4. Chief Procurement Officer   (procurement / leadership)
```

and per company, per role, a query built from *that* role:

| role | Bright Data / Harvest filter | Google natural query |
| --- | --- | --- |
| Head of Supply Chain | `("Supply Chain" OR procurement OR logistics OR SCM) AND (head ...) OR CSCO` | `Akshayakalpa Head of Supply Chain` |
| Head of Logistics | `(logistics OR freight OR transportation) AND (head ...)` | `Akshayakalpa Head of Logistics` |
| Procurement Head | `(procurement OR purchasing OR sourcing) AND (head ...)` | `Akshayakalpa Procurement Head` |
| Chief Procurement Officer | same as above (dedupe search, keep both role bindings) | `Akshayakalpa Chief Procurement Officer` |

Dedupe by role *class* before searching (procurement twice = one search), but keep both role
labels on the pair states.

## 6. Should there be a separate tool called first?

**Not as the primary fix, and not first.**

A model-facing `resolve_roles` tool cannot fix 3.3, 3.4 or 3.5 — they are deterministic code
paths that run after the role list exists. If the tool only rewrites the input string, the run
still searches procurement-only. Adding a mandatory pre-step also adds a compliance risk to a
13-step skill that the model already skips parts of (this turn had 109 messages).

The deterministic work belongs in `TitleExpansionService`, where every caller already goes:
`find_people_by_company`, `expandTitles`, and the Bright Data ludicrous planner.

**But** there is a real use for a thin read-only tool once the resolver exists:

- It shows the atomic roles, their classes, the boolean each will use, and the pair count
  **before** the pilot spends anything.
- It is the natural place for `ask_questions` when a coordinator is genuinely ambiguous
  ("Sales & Marketing Head" at a 40-person company may really be one role).
- It gives the brief and the People tab canonical role labels, so pair keys stay stable across
  turns.

So: **resolver in code, exposed as an optional preview tool.** The tool must call the same
function the search calls; it must not be a second implementation.

## 7. Role resolution (implemented)

Extend `TitleExpansionService.resolveRoles` to return a per-role plan:

```ts
type ResolvedRolePlan = {
  role: string;                 // atomic label, canonical case
  sourceMention: string;        // the user's original phrase
  titleClass: TitleClass | null;
  searchTitles: string[];       // [role, ...similarJobTitles] capped per role
  titleExpression: string | null; // this role's curated boolean
};

type ResolvedRoles = {
  rolePlans: ResolvedRolePlan[];
  // back-compat, derived from rolePlans
  searchTitles: string[];
  requestedClasses: TitleClass[];
  booleanTitleExpression?: string;
  roleClasses?: Record<string, TitleClass | null>;
};
```

`resolveRoles(roles)`:

1. `atomicRoles = roles.flatMap(splitRoleMention)`.
2. Classify all mentions in one call (unchanged).
3. For each atomic role, resolve class + curated expression + up to N similar titles.
4. Dedupe identical `(functionId, grade)` **for searching**, keep every role label.

`splitRoleMention` rules:

- Split on `/`, `&`, `+`, `|`, ` and `, ` or ` between two designation-like fragments.
- Carry the shared head: `Head of Supply Chain / Logistics` -> `Head of Supply Chain`,
  `Head of Logistics`; `Supply Chain / Logistics Head` -> `Supply Chain Head`,
  `Logistics Head`; `Procurement & Logistics Head` -> `Procurement Head`, `Logistics Head`.
- Do **not** split known compounds: `Research & Development`, `Health, Safety & Environment`,
  `Mergers & Acquisitions`, `Sales & Operations Planning`, `M&A`.
- Do **not** split when both sides classify to the same function: keep one role (the taxonomy
  answers this, so the guard is data-driven, not a word list).
- If the parts do not classify, keep the original mention, so nothing is lost when the split
  was wrong. A part that classifies stays as its own role, so `Purchase Head` keeps its typed
  label even while the taxonomy cannot place it.

The `functionRoot !== functionId` condition in `getCuratedQuery` is gone: the root is tried
whenever the specific row is missing (`title-expansion.service.ts`).

`splitRoleMention` lives in `title-taxonomy/role-mention-split.util.ts`; the collapse decision
(one function or two) and the per-role plan are in `TitleExpansionService.resolveRoles`.

## 8. Per-role fan-out (implemented)

`buildRoleSearches` (`role-search-plan.util.ts`) groups `resolvedRoles.rolePlans` by taxonomy
class and `lookupCompany` runs the cascade per group:

- **Bright Data**: one `searchNaturalLanguage` per role class, with that role's boolean and
  that role's titles; tag every candidate with `queriedRole` and `queriedTitleExpression`.
- **Harvest**: one lead search per role class (it takes a boolean title filter).
- **Google**: `buildCompanyQueries` already builds one natural query per role; remove the
  3-role cap in favour of a per-company query budget (e.g. 10-12), ordered so every role gets
  its natural query before any role gets a second phrasing. AI Overview: one question per
  role class, not per role.
- **Dedupe classes, not roles**: four roles with two distinct classes = two Bright Data
  searches, four pair states.
- **Evidence**: `evidenceOf(person, query, ...)` currently records the single merged query.
  With fan-out each candidate must carry the query that returned it.
- **Budget (decided)**: the per-pair cap applies per company x role, as documented. A class
  serving two roles gets both shares; a company's total is `perPairUsd x roles`. `applyRunBudget`
  now divides the run cap by that company cost, so `deferredByBudget` stays honest, and each
  search is capped by its own share so one role cannot spend another's.
- **Concurrency**: `withBrightDataPeopleSlot` is capped at `getCompanyConcurrency()` (50).
  Run roles sequentially *within* a company and companies in parallel, so provider load stays
  flat and a company stops as soon as its cap is spent. Expect ~Nx per-company latency
  (13s -> ~50s for four roles at 50 companies) and a smaller per-batch company count if that
  matters.
- **Canonical roles**: `applyPlan` resolves the roles and stores the atomic list on the input,
  so pairs, cache keys and the budget all use the split roles rather than the typed phrase.

## 9. Design C — scoring fixes

- `scoreRoleMatch`: same `functionRoot`, different `functionId` -> score **1** (rung 3), not 0.
  A logistics head is a related role to a supply-chain request, not a stranger. Exact
  function+grade stays 2.
- Bind a candidate to the role whose query returned it (`queriedRole`) at score 1 when the
  judge is silent or says `unknown`.
- `roleMatchesOf` then produces a role match for the split role, so the pair reports `found`
  at rung 3 instead of `none_found`.
- `leadsRequestedFunction` already passes on `logi`/`supp` and stays as the rung-3 guard.
- Judge prompt (done): a title that leads one function of a combined role is `related`, so the
  verdict agrees with the deterministic sibling rule instead of overriding it with `none`.

## 10. Design D — agent surface

Schema (`roles` description):

> One designation per entry, in the user's words. Split a coordinated phrase into one entry
> per function: "Head of Supply Chain / Logistics" -> ["Head of Supply Chain", "Head of
> Logistics"]; "Procurement & Logistics Head" -> ["Procurement Head", "Logistics Head"].
> Never merge two functions into one entry: a combined title classifies as one function and
> the other side is silently dropped.

Skill (`sourcing-people-by-company.md`, before the pilot):

> Read the roles back in one line before the pilot. If an entry joins two functions with /, &,
> +, "and" or "or", split it first and say so.

Optional tool `resolve_roles({ roles })` -> `{ roles: [{ role, function, grade, boolean,
searchTitles, sourceMention }], pairsPerCompany, notes }`, read-only, no spend, backed by the
same `resolveRoles`. Skill: call it when any role joins two functions or when there are three
or more roles; show the list and ask once only if two readings are plausible.

## 11. Rollout order

| Phase | Change | Risk | Payoff |
| --- | --- | --- | --- |
| 1 | Root-query fallback in `getCuratedQuery` (§3.3) — **done** | low, one condition + tests | even un-split roles get supply chain + logistics on Bright Data/Harvest |
| 2 | Same-root sibling = rung 3 in `scoreRoleMatch` (§3.5) — **done** | low | a found logistics head is kept and binds to a role |
| 3 | `splitRoleMention` + per-role plan (§7) — **done** | medium, changes pair keys and cache | correct role list from any phrasing |
| 4 | Per-role fan-out with a per-pair cap per role (§8) — **done** | medium, Nx searches | correct recall per role, honest pair states |
| 5 | Schema + skill text + optional `resolve_roles` (§10) | low | fewer bad calls from the model |
| 6 | Taxonomy: teach `purchase` (noun) -> procurement | external (arxena-site) | `Purchase Head` gets a boolean |

Phases 1-4 are in. Phase 5 is the model-facing text, which the deterministic split now makes
optional rather than load-bearing. Phase 6 is a taxonomy data fix in arxena-site.

## 12. Tests

Unit:

- `title-expansion.service.spec.ts`
  - "uses the root query when the function is the root" (`supply chain` -> `("Supply Chain"
    OR procurement OR logistics OR SCM) ...`).
  - "splits 'Head of Supply Chain / Logistics' into two roles, each with its own class and
    expression".
  - "keeps 'Health & Safety' as one role" and "keeps 'Research & Development' as one".
  - "keeps the original mention when a split part does not classify".
- `role-title-matching.util.spec.ts`
  - "scores a sibling function in the same root as related (1), not a mismatch".
- `find-people-by-company-tool.spec.ts` / cascade spec
  - "runs one Bright Data search per role class, each with that role's boolean".
  - "binds a person found by the logistics query to the logistics role".
  - "charges the per-pair cap per role, not per company".
  - "uses canonical roles in the cache key".

Eval scenario (mirrors this chat): `logistics-heads-six-companies.scenario.md`, asserting four
atomic roles, no merged mention, and one query per role class.

## 13. Decisions and what is left

1. **Budget semantics — decided**: per-pair cap per role (up to 4x spend per company, bounded by
   the run cap). Each class search sees its own share and a company's affordable count divides by
   `perPairUsd x roles`.
2. **`Purchase Head` — open**: fix in the taxonomy (right place, different repo) or add a local
   synonym in `ROLE_SYNONYMS` (fast, duplicates knowledge)? Until then it is searched as typed
   but contributes no boolean clause.
3. **Auto-split vs confirm — decided for now**: split by default (recall-safe) and surface the
   reading in the `Split role mention ...` log line and in `rolePlans.sourceMention`. The pilot
   still shows the people, and phase 5 can read the list back before the spend.
4. **Cap policy — decided**: per role search (`MAX_TITLES_PER_ROLE_QUERY = 6`), with the
   company-wide union cap kept only for the merged fallback path.
5. **Still open**: the schema and skill text (phase 5) and the optional `resolve_roles` preview
   tool. The deterministic split means the model no longer has to split by hand, but it should
   still pass one designation per entry so the pair labels read the way the user wrote them.
