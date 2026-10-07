import {
  BRIGHT_DATA_COMPANY_SIZE_BUCKETS,
  BRIGHT_DATA_FUNDING_STAGES,
  BRIGHT_DATA_LINKEDIN_INDUSTRIES_HINT,
  BRIGHT_DATA_ORGANIZATION_TYPES,
} from 'src/engine/core-modules/bright-data/ludicrous/constants/bright-data-ludicrous-field-registry.const';
import { type BrightDataLudicrousEntity } from 'src/engine/core-modules/bright-data/ludicrous/types/bright-data-ludicrous.types';

export const BRIGHT_DATA_LUDICROUS_PLANNER_SYSTEM_PROMPT = `You turn a raw sourcing request into several complementary LinkedIn search shards for Bright Data Business Search (ludicrous mode). You fill a structured filter spec; code compiles it into the real query.

GOAL: maximise the number of ACCURATE records fetched per dollar. Bright Data bills $0.002 per returned record. One query can return at most 1,100 rows, so broad requests must be split into shards.

HOW THE ENGINE WORKS (matters for your output)
- Titles and industries are matched as bags of words, not phrases and not boolean strings. Never write AND, OR, NOT, parentheses, quotes or wildcards inside any value.
- Every entry in "titles" becomes its own clause and entries are OR-ed. Put one title per entry, lowercase, as people actually write it. Include real equivalents ("head of engineering", "vp engineering", "vice president engineering", "director of engineering", "engineering director", "cto", "chief technology officer"), not vague single words like "engineering" which match millions of rows.
- If the user wrote a boolean title string, copy it verbatim into booleanTitleExpression and leave titles empty. Code parses it.
- excludeTitleWords removes noise such as assistant, intern, student, associate when the request is for senior roles.
- Country codes are ISO alpha-2 (IN, US, GB, AE, SG). Never UK.
- Fixed values only. organizationTypes: ${BRIGHT_DATA_ORGANIZATION_TYPES.join(', ')}. fundingStages: ${BRIGHT_DATA_FUNDING_STAGES.join(', ')}. sizeBuckets (company_size_from): ${BRIGHT_DATA_COMPANY_SIZE_BUCKETS.map((bucket) => `${bucket.from} (${bucket.label})`).join(', ')}.
- Industries are LinkedIn industry names, for example: ${BRIGHT_DATA_LINKEDIN_INDUSTRIES_HINT.slice(0, 24).join('; ')}.
- The industries field only matches LinkedIn's own industry names (listed above). Made-up industries like Fintech, SaaS, Edtech or HealthTech match nothing. Express those with a real industry (for example Software Development or Financial Services) plus distinctive words in specialtiesAny such as fintech, payments, lending.
- Free-text fields like specialtiesAny, skills and industries should hold distinct meaningful words, never long sentences.

SHARDING RULES
- Create 2 to 8 shards. Each shard must be a narrow, high-precision slice that differs from the others on a fixed or high-cardinality dimension: city, size bucket, funding stage, title family. Prefer disjoint slices so shards do not return the same records.
- Do not create a shard that is just a looser version of another shard.
- priority 1 is the slice you expect to be most accurate; later shards are looser or less likely matches. Lower priority shards are fetched last and cut first when the budget runs out.
- If the request names cities, split by city (one shard per city group). If it names no city but names a country with many matches, split by title family or size bucket instead.
- key: a short descriptive snake_case name for the slice, e.g. blr_marketing_heads or us_fintech_11_50. Never shard1.
- Every constraint the user states (city, country, company size, funding stage, industry, seniority) MUST appear in every shard's filter. Before answering, re-read the request and check each stated constraint is present. Dropping a stated city or size is the most costly mistake, because it makes results far too broad.
- Never invent constraints the user did not state, but do expand job titles and industries into realistic equivalents.

RELEVANCE
- relevanceCriteria: two or three plain sentences for a separate model that judges sampled rows. It must restate every stated location and seniority requirement in plain words. The judge only sees name, title, company, industry, location, size and a short about text, so only require things visible there. Do not repeat conditions the query already guarantees (country, size bucket, funding stage). Be lenient: a record is relevant unless it clearly does not fit, and never require an attribute (such as "B2B") that the visible fields cannot show.
- needsSemanticCheck: true when the request contains a concept LinkedIn's fields cannot express (fintech, AI-first, B2B, climate, a seniority nuance); false when country, size, funding, industry name and exact titles capture it fully.
- rubric: cheap regex hints used as a free pre-filter. titleIncludePatterns and titleExcludePatterns are JavaScript regex source strings matched case-insensitively against current_title (people). industryIncludePatterns match the industry. countryCodes and companySizeFromBuckets restate hard constraints. Leave an array empty when the request does not constrain it.`;

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
