export type BrightDataLudicrousEntity = 'company' | 'people';

export type BrightDataLudicrousTextMode = 'all' | 'any' | 'top-bm25';

export type BrightDataLudicrousRangeBounds = {
  '>'?: number;
  '>='?: number;
  '<'?: number;
  '<='?: number;
};

export type BrightDataLudicrousTextValue =
  | string
  | { value: string; mode?: BrightDataLudicrousTextMode; 'top-k'?: number };

export type BrightDataLudicrousQuery =
  | { and: BrightDataLudicrousQuery[] }
  | { or: BrightDataLudicrousQuery[] }
  | { not: BrightDataLudicrousQuery }
  | { equals: Record<string, string | number> }
  | { in: Record<string, Array<string | number>> }
  | { range: Record<string, BrightDataLudicrousRangeBounds> }
  | { text: Record<string, BrightDataLudicrousTextValue> };

export type BrightDataLudicrousFieldKind =
  | 'text'
  | 'string'
  | 'integer'
  | 'array';

export type BrightDataLudicrousFieldDefinition = {
  kind: BrightDataLudicrousFieldKind;
  operators: ReadonlyArray<'equals' | 'in' | 'range' | 'text'>;
  // Values the API actually matches. Anything else silently returns 0 rows.
  fixedValues?: ReadonlyArray<string | number>;
  description: string;
};

export type BrightDataLudicrousQueryIssue = {
  path: string;
  message: string;
};

export type BrightDataLudicrousValidationResult = {
  query: BrightDataLudicrousQuery;
  issues: BrightDataLudicrousQueryIssue[];
  // Fixes applied silently (casing, country aliases, city spelling variants)
  normalizations: string[];
};

// Relevance rubric produced once by the LLM at plan time and scored by code on
// every sampled page, so the decay loop costs no extra model calls.
export type BrightDataLudicrousRubric = {
  titleIncludePatterns: string[];
  titleExcludePatterns: string[];
  industryIncludePatterns: string[];
  countryCodes: string[];
  companySizeFromBuckets: number[];
};

export type BrightDataLudicrousShard = {
  key: string;
  rationale: string;
  // Lower number = expected to be more relevant, fetched first
  priority: number;
  query: BrightDataLudicrousQuery;
};

export type BrightDataLudicrousShardEstimate = {
  shardKey: string;
  rationale: string;
  priority: number;
  matched: number;
  coveragePercent: number;
  fetchableRecords: number;
  estimatedCostUsd: number;
  sampleSize: number;
  samplePrecision: number | null;
  error?: string;
};

export type BrightDataLudicrousSampleDocument = {
  brightId: string;
  data: Record<string, unknown>;
};

export type BrightDataLudicrousPlan = {
  planId: string;
  workspaceId: string;
  entity: BrightDataLudicrousEntity;
  rawQuery: string;
  intentSummary: string;
  relevanceCriteria: string;
  needsSemanticCheck: boolean;
  rubric: BrightDataLudicrousRubric;
  shards: BrightDataLudicrousShard[];
  estimates: BrightDataLudicrousShardEstimate[];
  // Rows already paid for during the estimate. The executor starts each shard
  // after them, so nothing is bought twice.
  sampleDocuments: Record<string, BrightDataLudicrousSampleDocument[]>;
  fields: string[];
  totalFetchableRecords: number;
  // Fetchable records after removing rows several shards would both return
  estimatedUniqueRecords: number;
  estimatedAccurateRecords: number;
  totalEstimatedCostUsd: number;
  // What the estimate itself already cost
  estimateCostUsd: number;
  createdAt: string;
};

export type BrightDataLudicrousShardRunReport = {
  shardKey: string;
  fetched: number;
  newRecords: number;
  duplicates: number;
  keptRecords: number;
  costUsd: number;
  // Precision of each judged page in order: the decay curve for this shard
  pagePrecision: Array<number | null>;
  stoppedReason:
    | 'exhausted'
    | 'low_precision'
    | 'mostly_duplicates'
    | 'budget'
    | 'target_reached'
    | 'error';
  error?: string;
};

export type BrightDataLudicrousRunResult = {
  planId: string;
  entity: BrightDataLudicrousEntity;
  documents: BrightDataLudicrousSampleDocument[];
  spentUsd: number;
  budgetUsd: number;
  shardReports: BrightDataLudicrousShardRunReport[];
};
