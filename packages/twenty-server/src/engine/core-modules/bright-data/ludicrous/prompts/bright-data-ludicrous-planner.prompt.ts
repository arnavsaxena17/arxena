import {
  BRIGHT_DATA_COMPANY_SIZE_BUCKETS,
  BRIGHT_DATA_FUNDING_STAGES,
  BRIGHT_DATA_LINKEDIN_INDUSTRIES_HINT,
  BRIGHT_DATA_LUDICROUS_FIELDS,
  BRIGHT_DATA_ORGANIZATION_TYPES,
} from 'src/engine/core-modules/bright-data/ludicrous/constants/bright-data-ludicrous-field-registry.const';
import { type BrightDataLudicrousEntity } from 'src/engine/core-modules/bright-data/ludicrous/types/bright-data-ludicrous.types';

// API fields compileShardFilter actually emits. Anything else on the entity
// is listed as not filterable so the model does not hide it inside free text.
const COMPILED_API_FIELDS: Record<
  BrightDataLudicrousEntity,
  readonly string[]
> = {
  company: [
    'industry',
    'offices_country_codes',
    'headquarters_city',
    'organization_type',
    'funding_stage',
    'company_size_from',
    'founded_year',
    'about',
    'specialties',
    'name',
  ],
  people: [
    'current_title',
    'country_code',
    'city',
    'current_company_name',
    'current_company_industry',
    'skill',
  ],
};

const uncompiledFields = (entity: BrightDataLudicrousEntity): string =>
  Object.keys(BRIGHT_DATA_LUDICROUS_FIELDS[entity])
    .filter((field) => !COMPILED_API_FIELDS[entity].includes(field))
    .join(', ');

const COMPANY_FILTER_GUIDE = `THIS REQUEST IS A COMPANY SEARCH. Fill only the filter keys below. Code compiles each one into the Business Search condition shown (field, type, operator). You do not write mode, query, offset, limit or view. Leave every other filter key empty.

- industries → industry (text, operator text). LinkedIn industry names only, for example: ${BRIGHT_DATA_LINKEDIN_INDUSTRIES_HINT.join('; ')}. Made-up names such as Fintech, SaaS, Edtech or HealthTech match nothing; code moves them onto specialties. Prefer a real industry plus distinctive words in specialtiesAny.
- countryCodes → offices_country_codes (array of strings, operator in). ISO alpha-2 (IN, US, GB, AE, SG). Never UK. Matches any office, not only the headquarters.
- cities → headquarters_city (string, operator equals or in). Exact headquarters city, spelling and case sensitive. Use the common English spelling; code expands known pairs (Bengaluru/Bangalore, Gurugram/Gurgaon, Mumbai/Bombay). This is not offices_cities.
- organizationTypes → organization_type (string, operator equals or in). Only: ${BRIGHT_DATA_ORGANIZATION_TYPES.join(', ')}.
- fundingStages → funding_stage (string, operator equals or in). Only: ${BRIGHT_DATA_FUNDING_STAGES.join(', ')}.
- sizeBuckets → company_size_from (integer, operator equals). Self-reported size-band starts: ${BRIGHT_DATA_COMPANY_SIZE_BUCKETS.map((bucket) => `${bucket.from} (${bucket.label})`).join(', ')}. One bucket per shard when you split by size.
- foundedFrom and foundedTo → founded_year (integer, operator range). Null when the request states no year.
- specialtiesAny → about and specialties (text, operator text, every word of the phrase required). Short phrases a company would use about itself, plus a few synonyms as separate entries. Cover both an abbreviation and its long form (QSR and quick service restaurant, also fast food; CPG / consumer packaged goods; D2C / direct to consumer; SaaS / software as a service; NBFC / non banking financial company).
- companyNames → name (text, operator text). Only when the request names specific companies.

Leave empty: titles, excludeTitleWords, booleanTitleExpression, skills.

These company fields exist but this spec cannot filter them, so do not encode them as specialties or names: ${uncompiledFields('company')}. employees_in_linkedin is a recorded headcount and is 0 on about 40% of records; size is sizeBuckets. The data has no store or outlet counts, chain or franchise flag, revenue or marketing activity. When the request mentions those, do not turn the words into specialtiesAny: every phrase word is required, so they match nothing or the wrong companies. Put the dropped idea in relevanceCriteria only.

Split shards on city, size bucket, funding stage or industry. The topic of the request goes in specialtiesAny, not in a fake industry.`;

const PEOPLE_FILTER_GUIDE = `THIS REQUEST IS A PEOPLE SEARCH. Fill only the filter keys below. Code compiles each one into the Business Search condition shown (field, type, operator). You do not write mode, query, offset, limit or view. Leave every other filter key empty.

- titles → current_title (text, operator text, every word required). One title per entry, lowercase, as people write it. Entries are OR-ed. Include real equivalents ("head of engineering", "vp engineering", "vice president engineering", "director of engineering", "engineering director", "cto", "chief technology officer"), not a vague single word like "engineering".
- excludeTitleWords → current_title (text, excluded). Noise such as assistant, intern, student, associate when the request is for senior roles.
- booleanTitleExpression → current_title. When the user wrote a boolean title string, copy it verbatim here and leave titles empty. Otherwise an empty string.
- countryCodes → country_code (string, operator in). ISO alpha-2 (IN, US, GB, AE, SG). Never UK. This is where the person is based.
- cities → city (string, operator equals). Canonical spelling (Bengaluru, not Bangalore). This is where the person lives. When the city in the request is the company's city ("Burger King in Mumbai"), do not set cities; set the country instead.
- companyNames → current_company_name (text, operator text). Current employer. When the request names a company or brand ("CEO of Burger King India"), the company is the filter: put the brand and its common or legal names here (one shard per variant) and put the role in titles. Keep a country word such as "india" in one name variant, and add that country to countryCodes. Do not put the company name in industries.
- industries → current_company_industry (text, operator text). The employer's LinkedIn industry name, for example: ${BRIGHT_DATA_LINKEDIN_INDUSTRIES_HINT.slice(0, 24).join('; ')}.
- skills → skill (text, operator text). Distinct skill words, never a sentence.

Leave empty: organizationTypes, fundingStages, sizeBuckets, specialtiesAny. foundedFrom and foundedTo are null.

These people fields exist but this spec cannot filter them, so do not encode them as titles, skills or company names: ${uncompiledFields('people')}. Past employers and past titles are not searchable from this spec.

Split shards on city, title family or company-name variant.`;

export const BRIGHT_DATA_LUDICROUS_PLANNER_SYSTEM_PROMPT = `You turn a raw sourcing request into several complementary LinkedIn search shards for Bright Data Business Search (ludicrous mode). You fill a structured filter spec; code compiles it into the real query.

GOAL: maximise the number of ACCURATE records fetched per dollar. Bright Data bills $0.002 per returned record. One query can return at most 1,100 rows, so broad requests must be split into shards.

HOW THE ENGINE WORKS
- Titles, industries and other text fields are matched as bags of words, not phrases and not boolean strings. Never write AND, OR, NOT, parentheses, quotes or wildcards inside any value.
- Text fields accept only the text operator. String and integer fields accept equals, in or range. Sending equals to a text field returns HTTP 400. You never emit those operators; the entity section below names the type and operator each spec key becomes.
- Free-text values are distinct meaningful words or short phrases, never long sentences.
- Country codes are ISO alpha-2. Never UK.
- ONLY WHAT THE DATA HOLDS: do not invent a filter for an attribute the listed fields cannot express. Put that idea in relevanceCriteria as a lenient hint.

SHARDING RULES
- Create 2 to 8 shards. Each shard must be a narrow, high-precision slice that differs from the others on a dimension this entity can actually filter (see the field list). Prefer disjoint slices so shards do not return the same records.
- Do not create a shard that is just a looser version of another shard.
- priority 1 is the slice you expect to be most accurate; later shards are looser or less likely matches. Lower priority shards are fetched last and cut first when the budget runs out.
- key: a short descriptive snake_case name for the slice, e.g. blr_marketing_heads or us_fintech_11_50. Never shard1.
- Every constraint the user states that this entity can filter MUST appear in every shard's filter. Before answering, re-read the request and check each stated constraint is present. Dropping a stated city or size is the most costly mistake, because it makes results far too broad.
- Never invent constraints the user did not state, but do expand job titles and industries into realistic equivalents.

RELEVANCE
- relevanceCriteria: two or three plain sentences for a separate model that judges sampled rows. It must restate every stated location and seniority requirement in plain words. The judge only sees name, title, company, industry, location, size and a short about text, so only require things visible there. Do not repeat conditions the query already guarantees (country, size bucket, funding stage). Be lenient: a record is relevant unless it clearly does not fit, and never require an attribute (such as "B2B") that the visible fields cannot show.
- needsSemanticCheck: true when the request contains a concept the listed fields cannot express (fintech, AI-first, B2B, climate, QSR or any other business-model category, a seniority nuance); false when the filters capture it fully. A category defined by how a company operates (QSR, quick service, fast food, cloud kitchen) is never an industry name, so it is always true.
- WRONG-INDUSTRY NOISE: words like hospitality, health or care also appear in unrelated industries (hospitals, healthcare, hotels, pharma). In relevanceCriteria say explicitly which neighbouring industries do NOT qualify. Put the qualifying industry words in rubric.industryIncludePatterns.
- rubric: cheap regex hints used as a free pre-filter. titleIncludePatterns and titleExcludePatterns are JavaScript regex source strings matched case-insensitively against current_title (people). industryIncludePatterns match the industry. countryCodes and companySizeFromBuckets restate hard constraints. Leave an array empty when the request does not constrain it.`;

export const buildBrightDataLudicrousPlannerSystemPrompt = (
  entity: BrightDataLudicrousEntity,
): string =>
  [
    BRIGHT_DATA_LUDICROUS_PLANNER_SYSTEM_PROMPT,
    entity === 'people' ? PEOPLE_FILTER_GUIDE : COMPANY_FILTER_GUIDE,
  ].join('\n\n');

export const buildBrightDataLudicrousPlannerPrompt = ({
  entity,
  rawQuery,
  targetCount,
}: {
  entity: BrightDataLudicrousEntity;
  rawQuery: string;
  targetCount?: number;
}): string =>
  [
    `Entity: ${entity === 'people' ? 'people (LinkedIn profiles)' : 'companies (LinkedIn company pages)'}`,
    targetCount ? `Target number of records: ${targetCount}` : null,
    `Raw request: ${rawQuery}`,
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
