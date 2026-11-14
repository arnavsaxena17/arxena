// Bright Data bills Business Search per returned record, not per request.
export const BRIGHT_DATA_COST_PER_RECORD_USD = 0.002;

// Fast SERP / Google News: pay-as-you-go is $1.50 per 1K successful requests.
// Override with BRIGHT_DATA_SERP_COST_USD when the contract rate differs.
export const BRIGHT_DATA_SERP_COST_PER_REQUEST_USD = 0.0015;

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

// Fetched (paid) records stay available this long after the run
export const BRIGHT_DATA_DATASET_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// What the workspace is charged relative to Bright Data's list price.
export const BRIGHT_DATA_BILLING_MARGIN_MULTIPLIER = 1;

export const BRIGHT_DATA_LUDICROUS_MAX_SHARDS = 24;
export const BRIGHT_DATA_LUDICROUS_SHARD_CONCURRENCY = 4;
export const BRIGHT_DATA_LUDICROUS_MAX_RETRIES = 3;

// A page below this precision is judged row by row and only relevant rows are
// kept. Paging continues; novelty or budget is what ends a shard.
export const BRIGHT_DATA_MIN_PAGE_PRECISION = 0.6;
export const allowNextPage = true;
export const BRIGHT_DATA_MIN_NEW_ROW_SHARE = 0.2;
// Small pages are too noisy to stop a shard on
export const BRIGHT_DATA_MIN_JUDGED_ROWS_TO_STOP = 5;
// Shards below this on the paid estimate sample are skipped entirely
export const BRIGHT_DATA_MIN_SHARD_SAMPLE_PRECISION = 0.3;
export const BRIGHT_DATA_CLEARLY_GOOD_SAMPLE_PRECISION = 0.6;
export const BRIGHT_DATA_MIN_ROWS_FOR_NOVELTY_STOP = 20;
