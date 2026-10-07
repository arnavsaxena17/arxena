import { z } from 'zod';

import {
  BRIGHT_DATA_COMPANY_SIZE_FROM_VALUES,
  BRIGHT_DATA_FUNDING_STAGES,
  BRIGHT_DATA_ORGANIZATION_TYPES,
} from 'src/engine/core-modules/bright-data/ludicrous/constants/bright-data-ludicrous-field-registry.const';

// The model fills a flat, enum-constrained spec. It never writes the JSON query
// itself, so fixed-type fields cannot be misspelled and boolean operators can
// never reach the engine as plain words.

const sizeBucketSchema = z.enum(
  BRIGHT_DATA_COMPANY_SIZE_FROM_VALUES.map(String) as [string, ...string[]],
);

// Strict structured-output providers require every key, so nothing is optional:
// leave an array empty (or a number null) when a dimension is not used.
export const brightDataLudicrousShardFilterSchema = z.object({
  // people
  titles: z
    .array(z.string())
    .describe(
      'People only. Equivalent job titles, one per entry, lowercase, no AND/OR/quotes. Each becomes its own all-words clause. Empty for companies.',
    ),
  excludeTitleWords: z
    .array(z.string())
    .describe('Words that disqualify a title, e.g. assistant, intern'),
  booleanTitleExpression: z
    .string()
    .describe(
      'Only when the user wrote a boolean title string: copy it here verbatim and leave titles empty; code compiles it. Otherwise an empty string.',
    ),
  companyNames: z
    .array(z.string())
    .describe('Current employer names (people) or company names (company)'),
  skills: z.array(z.string()),
  // shared
  countryCodes: z
    .array(z.string())
    .describe('ISO 3166-1 alpha-2 codes, e.g. IN, US, GB (never UK)'),
  cities: z.array(z.string()).describe('City names in common English spelling'),
  // company
  industries: z
    .array(z.string())
    .describe('LinkedIn industry names, one phrase per entry'),
  organizationTypes: z.array(z.enum(BRIGHT_DATA_ORGANIZATION_TYPES)),
  fundingStages: z.array(z.enum(BRIGHT_DATA_FUNDING_STAGES)),
  sizeBuckets: z
    .array(sizeBucketSchema)
    .describe(
      'company_size_from bucket starts: 1,2,11,51,201,501,1001,5001,10001',
    ),
  foundedFrom: z.number().nullable(),
  foundedTo: z.number().nullable(),
  specialtiesAny: z
    .array(z.string())
    .describe('Words that may appear in specialties or about text'),
});

export type BrightDataLudicrousShardFilter = z.infer<
  typeof brightDataLudicrousShardFilterSchema
>;

export const brightDataLudicrousPlanLlmSchema = z.object({
  intentSummary: z.string(),
  // Plain-English definition of a relevant record, handed to the Jev judge
  relevanceCriteria: z.string(),
  needsSemanticCheck: z
    .boolean()
    .describe(
      'True when the request contains a concept LinkedIn fields cannot express (fintech, AI-first, B2B, early-stage vibe, seniority nuance). False when the structured filters fully capture it (country, size, industry name, exact titles).',
    ),
  rubric: z.object({
    titleIncludePatterns: z.array(z.string()),
    titleExcludePatterns: z.array(z.string()),
    industryIncludePatterns: z.array(z.string()),
    countryCodes: z.array(z.string()),
    companySizeFromBuckets: z.array(sizeBucketSchema),
  }),
  shards: z
    .array(
      z.object({
        key: z.string(),
        rationale: z.string(),
        priority: z.number().describe('1 = most relevant slice, fetched first'),
        filter: brightDataLudicrousShardFilterSchema,
      }),
    )
    .min(1),
});

export type BrightDataLudicrousPlanLlmOutput = z.infer<
  typeof brightDataLudicrousPlanLlmSchema
>;
