/**
 * Calls OpenAI with structured output: multiple LinkedIn people search request bodies.
 * searchTypeVariant: 1 = classic, 2 = sales_navigator, 3 = recruiter (matches product search types).
 *
 * Run from repo root:
 *   yarn workspace twenty-server exec npx tsx -r tsconfig-paths/register scripts/llm-linkedin-multi-search-requests.ts
 *
 * Requires OPENAI_KEY (or OPENAI_API_KEY). Optional: OPENAI_MODEL (default gpt-4o).
 */

import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import * as path from 'path';
import { z } from 'zod';

import { classicPeopleSearchSchema } from '../src/engine/core-modules/candidate-search/schemas/linkedin-classic-people-search.schema';
import { recruiterPeopleSearchSchema } from '../src/engine/core-modules/candidate-search/schemas/linkedin-recruiter-people-search.schema';
import { salesNavigatorPeopleSearchSchema } from '../src/engine/core-modules/candidate-search/schemas/linkedin-sales-navigator-people-search.schema';
import type { GeneratedSearchParameters } from '../src/engine/core-modules/candidate-search/types/candidate-search-request.type';
import { ParameterSanitizer } from '../src/engine/core-modules/candidate-search/utils/parameter-sanitizer.util';
import type { LinkedInAdvancedKeywordsFilter, LinkedInClassicPeopleSearchRequest } from '../src/engine/core-modules/linkedin-search/types/linkedin-search-request.type';

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true });
} catch {
  // optional
}

/**
 * Example recruiter search requirements — swap rawSearchQuery to test each one.
 *
 * A) "I am looking for someone who comes from an elite engineering college, has worked
 *    with a large manufacturing company on the shop floor, and has also been a founder /
 *    worked in a founding team. Job location: Mumbai."
 *
 * B) "We are looking for the CEO of an insulator manufacturing company. We prefer someone
 *    with an insulator manufacturing background but would accept cement / ceramics / glass
 *    backgrounds (shared kiln processes). 4000-employee company. Based in Abu Road, Rajasthan."
 *
 * C) "We are looking for the Head of HR of a waste management company based in Surat.
 *    Mid-to-large manufacturing companies, especially reporting to promoters. Long-term
 *    tenure preferred."
 *
 * D) "We are looking for Heads of R&D of consumer products companies in Mumbai."
 *
 * E) "We are looking for a Supplier Quality Manager for Ferrero in Mumbai. Supplier quality
 *    in food companies where quality is paramount, preferably MNC, in Mumbai."
 */
const rawSearchQuery =
  'I am looking for someone who comes from an elite engineering college (IIT/NIT/BITS), has worked with a large manufacturing company on the shop floor, and has also been a founder or worked in a founding team. Job location: Mumbai.';

/** 1 = classic, 2 = sales_navigator, 3 = recruiter */
const searchTypeVariant = 3 as 1 | 2 | 3;

function variantToSearchType(
  v: 1 | 2 | 3,
): 'classic' | 'sales_navigator' | 'recruiter' {
  if (v === 1) {
    return 'classic';
  }
  if (v === 2) {
    return 'sales_navigator';
  }
  return 'recruiter';
}

const searchType = variantToSearchType(searchTypeVariant);

const BASE_SYSTEM_PROMPT = `
You are an expert LinkedIn Recruiter search specialist. Given a raw recruiter requirement, generate
2–4 LinkedIn Recruiter People Search queries ordered from STRICTEST (highest quality, smallest pool)
to BROADEST (largest pool, needs manual screening).

═══════════════════════════════════════════════════
CORE PHILOSOPHY: CONCEPT STEMS OVER TITLE LISTS
═══════════════════════════════════════════════════

Use the shortest stem word that captures the broadest set of variations. Do NOT enumerate
synonymous titles or phrases when a single root word covers them all.

✓ CORRECT (concept stems):
  "founder OR founding"
    → catches: co-founder, founding team, founding engineer, founding member, founded
  "plant OR production OR factory OR manufacturing OR shopfloor"
    → catches: Plant Manager, Production Executive, Factory Head, Shop Floor Operator, Works Manager
  "IIT OR NIT OR BITS"
    → catches: IIT Bombay, IIT Delhi, NIT Trichy, BITS Pilani, IITian
  "CEO OR MD OR \"managing director\" OR \"chief executive\""
    → catches all C-suite CEO equivalents
  "kiln OR ceramic OR ceramics OR cement OR glass OR refractory"
    → catches all adjacent-process background types

✗ WRONG (over-enumerated title lists):
  "co-founder OR \"founding member\" OR \"founding team\" OR \"founding engineer\" OR \"early employee\""
  "Plant Manager OR Plant Head OR Factory Manager OR Works Manager OR Production Manager OR Plant Director"
  "\"manufacturing engineer\" OR \"process engineer\" OR \"industrial engineer\" OR \"plant manager\" OR ..."

The stems cast a wider net AND catch career-long signals even when a person's current title is
completely different (e.g., someone who was once a "Production Executive" now titled "VP Operations").

═══════════════════════════════════════════════════
FILTER ASSIGNMENT RULES
═══════════════════════════════════════════════════

## keywords field  — full-profile scan (searches everywhere: headline, summary, about, descriptions, education)
Use for signals that can legitimately appear ANYWHERE in the profile:
• Education / institution names:   "IIT OR NIT OR BITS"
• Domain context terms:            "insulator OR ceramic OR cement OR kiln"
• Methodologies / buzzwords:       "lean OR TPM OR OEE OR \"six sigma\""
• Industry signals NOT tied to a specific role:  "FMCG OR \"consumer products\""
ALWAYS populate keywords with at least one stem word — never leave it null.

## role filter  — work-history scan (searches only job title + company fields in experience entries)
Use for signals that must exist in WORK HISTORY:
• scope: "CURRENT_OR_PAST" → looks across the candidate's entire career timeline
• priority: "MUST_HAVE"   → this signal MUST appear somewhere in their work history
• priority: "CAN_HAVE"    → preferred but not required (relaxed tier)
• One role entry = one distinct signal cluster (what they have DONE professionally)
• Two MUST_HAVE role entries = LinkedIn confirms BOTH exist in their career history
• Use concept stems — never enumerate synonyms: "founder OR founding" not the full list

## location filter  — geographic targeting
• id:       LinkedIn geo ID string (see canonical list below — do NOT invent IDs)
• priority: "MUST_HAVE" (strict city) or "CAN_HAVE" (preferred, softer)
• scope:    "CURRENT" (only current location) or "CURRENT_OR_OPEN_TO_RELOCATE" (broader)
• title:    human-readable label; required when scope is "CURRENT_OR_OPEN_TO_RELOCATE"
• For senior / relocation-expected hires: use CAN_HAVE or omit location entirely on early tiers.

## company filter  — specific company or company-type targeting
Only use when the brief explicitly targets named companies or a specific company type:
• Use keywords variant: { "keywords": "Ferrero OR Nestle OR Mondelez", "priority": "CAN_HAVE", "scope": "CURRENT_OR_PAST" }
• For MNC signals: { "keywords": "MNC OR multinational", "priority": "CAN_HAVE", "scope": "CURRENT_OR_PAST" }

═══════════════════════════════════════════════════
MULTI-TIER QUERY STRATEGY
═══════════════════════════════════════════════════

Generate queries in this order, from strictest to broadest:

TIER 1 — Ideal Candidate
• All non-negotiable signal clusters as role MUST_HAVE
• keywords: domain / education signals
• Location: MUST_HAVE if the pool is expected to be reasonably sized
• Expected results: 50–300 (highest quality)

TIER 2 — Adjacent / Relaxed
• Drop one signal from MUST_HAVE → CAN_HAVE, OR broaden keywords OR relax location
• Alternative domain (e.g., adjacent materials instead of exact industry)
• Expected results: 200–1,000

TIER 3 — Broad Safety Net (include only when Tier 1+2 will likely yield <100 combined)
• Only the single most distinctive signal as MUST_HAVE
• Expected results: 500+

Always generate at least 2 queries. Never generate more than 4.

═══════════════════════════════════════════════════
REQUIREMENT DECOMPOSITION PROCESS
═══════════════════════════════════════════════════

Before constructing queries, mentally decompose the requirement into clusters:
1. NON-NEGOTIABLE background signals  → role MUST_HAVE
2. PREFERRED background signals       → role CAN_HAVE  OR  added to keywords
3. DOMAIN / EDUCATION signals         → keywords field
4. LOCATION requirement               → location filter (MUST_HAVE or CAN_HAVE based on pool size)
5. COMPANY TYPE signals               → company filter keywords OR folded into role keywords

═══════════════════════════════════════════════════
CANONICAL LOCATION IDs  (use these exactly — do not invent numeric IDs)
═══════════════════════════════════════════════════

Mumbai / Mumbai Metropolitan Region : "102713980"
Delhi / NCR                         : "102713516"
Bengaluru                           : "105556591"
Pune                                : "103560853"
Hyderabad                           : "103093800"
Chennai                             : "102264943"
Ahmedabad                           : "103027572"
Surat                               : "103439296"
Kolkata                             : "101994830"
Rajasthan (state, broad)            : "103227107"
India (national, use if no city)    : "102713516"
UAE / Dubai                         : "104305776"

If the location is not in this list, omit the location filter and add a note in keywords instead.

═══════════════════════════════════════════════════
WORKED EXAMPLES
═══════════════════════════════════════════════════

─── Example A ────────────────────────────────────
Requirement: "Elite engineering college grad (IIT/NIT/BITS), worked in large manufacturing on the
shop floor, AND been part of a founding team. Mumbai."

Decomposition:
• Non-negotiable 1: founder / founding experience           → role MUST_HAVE
• Non-negotiable 2: shop floor / manufacturing experience   → role MUST_HAVE
• Education signal: elite college                           → keywords
• Location: Mumbai                                          → location

Tier 1 — all MUST_HAVE, strict Mumbai:
{
  "keywords": "IIT OR NIT OR BITS",
  "role": [
    { "keywords": "founder OR founding OR \"early employee\"", "priority": "MUST_HAVE", "scope": "CURRENT_OR_PAST" },
    { "keywords": "plant OR production OR factory OR manufacturing OR shopfloor", "priority": "MUST_HAVE", "scope": "CURRENT_OR_PAST" }
  ],
  "location": [{ "id": "102713980", "priority": "MUST_HAVE", "scope": "CURRENT", "title": null }]
}

Tier 2 — manufacturing to CAN_HAVE, location to CAN_HAVE:
{
  "keywords": "IIT OR NIT OR BITS",
  "role": [
    { "keywords": "founder OR founding OR \"early employee\"", "priority": "MUST_HAVE", "scope": "CURRENT_OR_PAST" },
    { "keywords": "plant OR production OR factory OR manufacturing OR shopfloor", "priority": "CAN_HAVE", "scope": "CURRENT_OR_PAST" }
  ],
  "location": [{ "id": "102713980", "priority": "CAN_HAVE", "scope": "CURRENT", "title": null }]
}

─── Example B ────────────────────────────────────
Requirement: "CEO of insulator manufacturing company. Prefer insulator background; open to
cement / ceramics / glass (shared kiln process). 4000-employee company. Abu Road, Rajasthan."

Decomposition:
• Non-negotiable 1: CEO-level role                                    → role MUST_HAVE
• Non-negotiable 2: manufacturing-side career (not finance/HR)        → role MUST_HAVE
• Domain (Tier 1 ideal): insulator-specific                           → keywords
• Domain (Tier 2 adjacent): ceramics / cement / glass / refractory   → keywords (different tier)
• Location: senior hire will relocate → no location on Tier 1 & 2

Tier 1 — insulator domain, CEO level (no location — senior relocation hire):
{
  "keywords": "insulator OR insulators OR porcelain OR \"high voltage\"",
  "role": [
    { "keywords": "CEO OR MD OR \"managing director\" OR \"chief executive\"", "priority": "MUST_HAVE", "scope": "CURRENT_OR_PAST" },
    { "keywords": "plant OR production OR operations OR manufacturing OR works OR factory", "priority": "MUST_HAVE", "scope": "CURRENT_OR_PAST" }
  ],
  "location": null
}

Tier 2 — adjacent materials, CEO or one level below:
{
  "keywords": "ceramic OR ceramics OR cement OR glass OR refractory OR kiln",
  "role": [
    { "keywords": "CEO OR MD OR \"managing director\" OR COO OR \"business head\" OR \"plant head\"", "priority": "MUST_HAVE", "scope": "CURRENT_OR_PAST" },
    { "keywords": "plant OR production OR operations OR manufacturing OR works OR factory", "priority": "MUST_HAVE", "scope": "CURRENT_OR_PAST" }
  ],
  "location": null
}

Tier 3 — broad heavy manufacturing, CEO/COO only:
{
  "keywords": "manufacturing OR \"plant head\" OR \"unit head\" OR \"works head\"",
  "role": [
    { "keywords": "CEO OR MD OR \"managing director\" OR COO OR \"business head\"", "priority": "MUST_HAVE", "scope": "CURRENT_OR_PAST" }
  ],
  "location": null
}

─── Example C ────────────────────────────────────
Requirement: "Head of HR of a waste management company in Surat. Mid-to-large manufacturing
companies, especially reporting to promoters. Long-term tenure preferred."

Decomposition:
• Non-negotiable 1: head of HR / CHRO role                             → role MUST_HAVE
• Preferred: waste management / manufacturing background               → keywords
• Preferred: promoter-led / family business signal                     → keywords (hard to filter structurally)
• Location: Surat                                                       → location

Tier 1 — HR head with waste/manufacturing domain, Surat:
{
  "keywords": "waste OR \"waste management\" OR manufacturing OR industrial",
  "role": [
    { "keywords": "HR OR CHRO OR \"human resources\" OR \"people function\"", "priority": "MUST_HAVE", "scope": "CURRENT_OR_PAST" }
  ],
  "location": [{ "id": "103439296", "priority": "MUST_HAVE", "scope": "CURRENT", "title": null }]
}

Tier 2 — HR head, broader location (Gujarat state), any manufacturing:
{
  "keywords": "manufacturing OR industrial OR plant OR factory",
  "role": [
    { "keywords": "HR OR CHRO OR \"human resources\" OR \"people function\" OR \"people head\"", "priority": "MUST_HAVE", "scope": "CURRENT_OR_PAST" }
  ],
  "location": [{ "id": "103027572", "priority": "CAN_HAVE", "scope": "CURRENT", "title": null }]
}

─── Example D ────────────────────────────────────
Requirement: "Heads of R&D of consumer products companies in Mumbai."

Tier 1 — R&D head in consumer products, Mumbai:
{
  "keywords": "consumer OR FMCG OR \"consumer products\" OR \"consumer goods\"",
  "role": [
    { "keywords": "R&D OR research OR innovation OR product development OR \"new product\"", "priority": "MUST_HAVE", "scope": "CURRENT_OR_PAST" }
  ],
  "location": [{ "id": "102713980", "priority": "MUST_HAVE", "scope": "CURRENT", "title": null }]
}

Tier 2 — R&D head, broader domain (FMCG/personal care/food), location CAN_HAVE:
{
  "keywords": "FMCG OR \"personal care\" OR food OR beverage OR household",
  "role": [
    { "keywords": "R&D OR research OR innovation OR \"product development\" OR \"new product\"", "priority": "MUST_HAVE", "scope": "CURRENT_OR_PAST" }
  ],
  "location": [{ "id": "102713980", "priority": "CAN_HAVE", "scope": "CURRENT", "title": null }]
}

─── Example E ────────────────────────────────────
Requirement: "Supplier Quality Manager for Ferrero in Mumbai — supplier quality in food
companies where quality is paramount, preferably MNC."

Decomposition:
• Non-negotiable 1: supplier quality role          → role MUST_HAVE
• Preferred: food / FMCG / quality-critical domain → keywords
• Preferred: MNC / Ferrero company signal          → company filter CAN_HAVE
• Location: Mumbai                                  → location MUST_HAVE

Tier 1 — supplier quality in food/MNC, Mumbai:
{
  "keywords": "food OR FMCG OR \"consumer goods\" OR beverage OR confectionery",
  "role": [
    { "keywords": "\"supplier quality\" OR \"vendor quality\" OR \"supply quality\" OR SQA OR SQM", "priority": "MUST_HAVE", "scope": "CURRENT_OR_PAST" }
  ],
  "company": [
    { "keywords": "Ferrero OR Nestle OR Unilever OR \"Mondelez\" OR Mars OR \"ITC\" OR Britannia", "priority": "CAN_HAVE", "scope": "CURRENT_OR_PAST" }
  ],
  "location": [{ "id": "102713980", "priority": "MUST_HAVE", "scope": "CURRENT", "title": null }]
}

Tier 2 — quality in food companies, location CAN_HAVE, no company filter:
{
  "keywords": "food OR FMCG OR \"consumer goods\" OR beverage OR confectionery OR \"pharma\" OR FSSAI",
  "role": [
    { "keywords": "\"supplier quality\" OR \"vendor quality\" OR quality OR QA OR \"quality assurance\"", "priority": "MUST_HAVE", "scope": "CURRENT_OR_PAST" }
  ],
  "location": [{ "id": "102713980", "priority": "CAN_HAVE", "scope": "CURRENT", "title": null }]
}

═══════════════════════════════════════════════════
REMINDERS
═══════════════════════════════════════════════════
• keywords must NEVER be null — always include at least one stem word.
• Never invent location IDs not in the canonical list above.
• Never use more than 2 role filter entries per query (LinkedIn's engine handles 2 well; 3+ is noisy).
• Location IDs are STRINGS not numbers: "102713980" not 102713980.
• The role filter's "id" variant requires is_selection; always use the "keywords" variant instead.
• Output queries in Tier 1 → Tier 2 → Tier 3 order (strictest first).
`;

const classicPeopleRequestSchema = classicPeopleSearchSchema.extend({
  api: z.literal('classic'),
  category: z.literal('people'),
  /** Omit from model output unless using raw Unipile classic endpoint; nullable satisfies OpenAI structured outputs */
  useRawEndpoint: z.boolean().nullable(),
});

type ClassicPeopleParams = Omit<
  LinkedInClassicPeopleSearchRequest,
  'api' | 'category'
>;

type ClassicZodBody = Omit<
  z.infer<typeof classicPeopleRequestSchema>,
  'api' | 'category'
>;

function nullToUndef<V>(value: V | null | undefined): V | undefined {
  if (value === null) {
    return undefined;
  }
  return value;
}

function advancedKeywordsZodToFilter(
  raw: ClassicZodBody['advanced_keywords'],
): LinkedInAdvancedKeywordsFilter | undefined {
  if (raw === null || raw === undefined) {
    return undefined;
  }
  return {
    first_name: nullToUndef(raw.first_name),
    last_name: nullToUndef(raw.last_name),
    title: nullToUndef(raw.title),
    company: nullToUndef(raw.company),
    school: nullToUndef(raw.school),
  };
}

function classicZodBodyToParams(body: ClassicZodBody): ClassicPeopleParams {
  return {
    keywords: nullToUndef(body.keywords),
    industry: nullToUndef(body.industry),
    location: nullToUndef(body.location),
    profile_language: nullToUndef(body.profile_language),
    network_distance: nullToUndef(body.network_distance),
    company: nullToUndef(body.company),
    past_company: nullToUndef(body.past_company),
    school: nullToUndef(body.school),
    service: nullToUndef(body.service),
    connections_of: nullToUndef(body.connections_of),
    followers_of: nullToUndef(body.followers_of),
    open_to: nullToUndef(body.open_to),
    advanced_keywords: advancedKeywordsZodToFilter(body.advanced_keywords),
    useRawEndpoint: nullToUndef(body.useRawEndpoint),
  };
}

const salesNavPeopleRequestSchema = salesNavigatorPeopleSearchSchema.extend({
  api: z.literal('sales_navigator'),
  category: z.literal('people'),
});

const recruiterPeopleRequestSchema = recruiterPeopleSearchSchema.extend({
  api: z.literal('recruiter'),
  category: z.literal('people'),
});

const multiClassicSchema = z.object({
  searchRequests: z
    .array(classicPeopleRequestSchema)
    .min(2)
    .max(6)
    .describe('Distinct classic people search bodies (api+category included)'),
});

const multiSalesNavSchema = z.object({
  searchRequests: z
    .array(salesNavPeopleRequestSchema)
    .min(2)
    .max(6)
    .describe('Distinct Sales Navigator people search bodies'),
});

const multiRecruiterSchema = z.object({
  searchRequests: z
    .array(recruiterPeopleRequestSchema)
    .min(2)
    .max(6)
    .describe('Distinct Recruiter people search bodies'),
});

type MultiSchema =
  | typeof multiClassicSchema
  | typeof multiSalesNavSchema
  | typeof multiRecruiterSchema;

function getSchemaAndLabel(): {
  schema: MultiSchema;
  responseName: string;
  apiLabel: string;
} {
  if (searchType === 'classic') {
    return {
      schema: multiClassicSchema,
      responseName: 'linkedinClassicPeopleSearchRequests',
      apiLabel: 'LinkedIn Classic (main site) people search',
    };
  }
  if (searchType === 'sales_navigator') {
    return {
      schema: multiSalesNavSchema,
      responseName: 'linkedinSalesNavPeopleSearchRequests',
      apiLabel: 'LinkedIn Sales Navigator people search',
    };
  }
  return {
    schema: multiRecruiterSchema,
    responseName: 'linkedinRecruiterPeopleSearchRequests',
    apiLabel: 'LinkedIn Recruiter people search',
  };
}

function omitApiCategory<T extends { api: string; category: string }>(
  req: T,
): Omit<T, 'api' | 'category'> {
  const { api: _a, category: _c, ...rest } = req;
  return rest;
}

function toGeneratedSearchParams(req: ClassicPeopleParams): GeneratedSearchParameters {
  return { classicPeopleSearch: req };
}

function validateAgainstExecutionPipeline(
  sanitizer: ParameterSanitizer,
  parsed: z.infer<MultiSchema>,
): void {
  parsed.searchRequests.forEach((req, index) => {
    if (searchType === 'classic') {
      const zodBody: ClassicZodBody = omitApiCategory(
        req as z.infer<typeof classicPeopleRequestSchema>,
      );
      const body = classicZodBodyToParams(zodBody);
      const sanitized = sanitizer.sanitizeClassicPeopleSearchRequest(body);
      if (!sanitized.keywords?.trim()) {
        throw new Error(
          `searchRequests[${index}]: after sanitization, keywords is empty — classic search needs keywords (facet strings must be numeric IDs to survive sanitization).`,
        );
      }
      const gp: GeneratedSearchParameters = toGeneratedSearchParams(sanitized);
      if (!gp.classicPeopleSearch) {
        throw new Error(`searchRequests[${index}]: classicPeopleSearch missing`);
      }
      return;
    }
    if (searchType === 'sales_navigator') {
      const body = omitApiCategory(
        req as z.infer<typeof salesNavPeopleRequestSchema>,
      );
      const sanitized = sanitizer.sanitizeSalesNavigatorPeopleSearchRequest(body);
      if (!sanitized.keywords?.trim()) {
        throw new Error(
          `searchRequests[${index}]: after sanitization, keywords is empty — Sales Navigator sanitizer keeps string facets only when passed in shapes it recognizes; keywords must be non-empty for a reliable executeLinkedInSearch path.`,
        );
      }
      return;
    }
    const body = omitApiCategory(req as z.infer<typeof recruiterPeopleRequestSchema>);
    const sanitized = sanitizer.sanitizeRecruiterPeopleSearchRequest(body);
    if (!sanitized.keywords?.trim()) {
      throw new Error(
        `searchRequests[${index}]: after sanitization, keywords is empty — Recruiter search expects keywords (ParameterSanitizer).`,
      );
    }
  });
}

function printSuggestedTools(): void {
  console.log('\n--- Suggested tools for an agentic LLM (beyond structured output) ---');
  console.log(
    [
      '1. linkedin_search_parameters — GET Unipile /linkedin/search/parameters with type + keywords to retrieve facet IDs (locations, industries, titles) before building requests.',
      '2. resolve_linkedin_facets — Wrap LinkedinParameterResolver / workspace flows to turn human labels (e.g. "Mumbai", "Hospitals") into IDs expected by classic search and recruiter filters.',
      '3. dry_run_sanitize_search — Run ParameterSanitizer on a draft body and return dropped fields (mirrors SearchExecutionService / CandidateSearchBaseService.executeLinkedInSearch).',
      '4. optional_web_search — Expand specialty synonyms (e.g. pulmonologist vs chest physician) for keyword OR-groups within classic 6-term limits.',
    ].join('\n'),
  );
}

async function main(): Promise<void> {
  const apiKey = process.env.OPENAI_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OPENAI_KEY or OPENAI_API_KEY is required');
    process.exit(1);
  }

  const model = process.env.OPENAI_MODEL ?? 'gpt-4o';
  const { schema, responseName, apiLabel } = getSchemaAndLabel();

  const systemPrompt = [
    BASE_SYSTEM_PROMPT,
    '',
    `Output format: ${apiLabel} (searchTypeVariant=${searchTypeVariant}).`,
    'Generate the JSON searchRequests array now.',
  ].join('\n');

  const openai = new OpenAI({ apiKey });
  console.log('=== SYSTEM PROMPT ===\n%s\n', systemPrompt);
  console.log('=== RAW SEARCH QUERY ===\n%s\n', rawSearchQuery);

  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `RECRUITER REQUIREMENT:\n${rawSearchQuery}\n\nDecompose into signal clusters, assign each to the correct filter, then generate 2–4 tiered Recruiter People Search queries (Tier 1 strictest → Tier N broadest).`,
      },
    ],
    response_format: zodResponseFormat(schema, responseName),
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Empty LLM response');
  }

  const raw = JSON.parse(content) as unknown;
  const parsed = schema.parse(raw);

  console.log(`\nsearchTypeVariant=${searchTypeVariant} (${searchType})`);
  console.log(`model=${model}`);
  console.log(`\nGenerated ${parsed.searchRequests.length} queries (Tier 1 = strictest, last = broadest):\n`);
  parsed.searchRequests.forEach((req, i) => {
    console.log(`--- Tier ${i + 1} ---`);
    console.log(JSON.stringify(req, null, 2));
  });

  const sanitizer = new ParameterSanitizer();
  validateAgainstExecutionPipeline(sanitizer, parsed);

  console.log(
    '\nAssertions passed: JSON matches Zod schema and each request survives ParameterSanitizer with executable filters (same sanitization path as SearchExecutionService → executeLinkedInSearch).',
  );

  printSuggestedTools();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
