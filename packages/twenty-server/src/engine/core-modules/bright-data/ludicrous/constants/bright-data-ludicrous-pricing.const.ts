// Bright Data bills Business Search per returned record, not per request.
export const BRIGHT_DATA_COST_PER_RECORD_USD = 0.002;

// Bright Data caps a single ludicrous query at 100 rows per page and offset 1000.
export const BRIGHT_DATA_LUDICROUS_PAGE_SIZE = 100;
export const BRIGHT_DATA_LUDICROUS_MAX_OFFSET = 1000;
export const BRIGHT_DATA_LUDICROUS_MAX_ROWS_PER_QUERY =
  BRIGHT_DATA_LUDICROUS_MAX_OFFSET + BRIGHT_DATA_LUDICROUS_PAGE_SIZE;

// Estimating costs one record per shard, so the estimate budget is tiny.
export const BRIGHT_DATA_ESTIMATE_BUDGET_USD = 0.5;
export const BRIGHT_DATA_MAX_BUDGET_PER_QUERY_USD = 10;
export const BRIGHT_DATA_ESTIMATE_SAMPLE_SIZE = 5;
export const BRIGHT_DATA_JUDGE_SAMPLE_PER_PAGE = 10;
export const BRIGHT_DATA_PLAN_TTL_MS = 60 * 60 * 1000;

// What the workspace is charged relative to Bright Data's list price.
export const BRIGHT_DATA_BILLING_MARGIN_MULTIPLIER = 1;

export const BRIGHT_DATA_LUDICROUS_MAX_SHARDS = 24;
export const BRIGHT_DATA_LUDICROUS_SHARD_CONCURRENCY = 4;
export const BRIGHT_DATA_LUDICROUS_MAX_RETRIES = 3;

// Decay loop: stop a shard once a fetched page falls below this precision, and
// stop everything for a shard once fewer than this share of rows are new.
export const BRIGHT_DATA_MIN_PAGE_PRECISION = 0.6;
export const BRIGHT_DATA_MIN_NEW_ROW_SHARE = 0.2;
// Small pages are too noisy to stop a shard on
export const BRIGHT_DATA_MIN_JUDGED_ROWS_TO_STOP = 5;
// Shards below this on the paid estimate sample are skipped entirely
export const BRIGHT_DATA_MIN_SHARD_SAMPLE_PRECISION = 0.3;
export const BRIGHT_DATA_CLEARLY_GOOD_SAMPLE_PRECISION = 0.6;
export const BRIGHT_DATA_MIN_ROWS_FOR_NOVELTY_STOP = 20;
