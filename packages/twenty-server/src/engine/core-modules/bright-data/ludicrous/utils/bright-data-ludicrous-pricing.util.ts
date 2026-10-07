import {
  BRIGHT_DATA_COST_PER_RECORD_USD,
  BRIGHT_DATA_LUDICROUS_MAX_ROWS_PER_QUERY,
  BRIGHT_DATA_LUDICROUS_PAGE_SIZE,
} from 'src/engine/core-modules/bright-data/ludicrous/constants/bright-data-ludicrous-pricing.const';

// Floating point drift matters when 5,000 records are summed to the cent.
export const roundUsd = (value: number): number =>
  Math.round(value * 1_000_000) / 1_000_000;

export const costForRecordsUsd = (recordCount: number): number =>
  roundUsd(Math.max(0, recordCount) * BRIGHT_DATA_COST_PER_RECORD_USD);

export const recordsAffordableForBudget = (budgetUsd: number): number =>
  Math.max(0, Math.floor(budgetUsd / BRIGHT_DATA_COST_PER_RECORD_USD + 1e-9));

// One shard can only ever return 1,100 rows (offset <= 1000, limit <= 100).
export const fetchableRecordsForMatched = (matched: number): number =>
  Math.min(Math.max(0, matched), BRIGHT_DATA_LUDICROUS_MAX_ROWS_PER_QUERY);

export const planLudicrousPages = ({
  records,
  startOffset = 0,
}: {
  records: number;
  startOffset?: number;
}): Array<{ offset: number; limit: number }> => {
  const pages: Array<{ offset: number; limit: number }> = [];
  let offset = Math.max(0, startOffset);
  let remaining = Math.min(
    Math.max(0, records),
    Math.max(0, BRIGHT_DATA_LUDICROUS_MAX_ROWS_PER_QUERY - offset),
  );

  while (remaining > 0) {
    const limit = Math.min(BRIGHT_DATA_LUDICROUS_PAGE_SIZE, remaining);

    pages.push({ offset, limit });
    offset += limit;
    remaining -= limit;
  }

  return pages;
};

export const formatUsd = (value: number): string =>
  `$${value.toFixed(value < 1 ? 3 : 2)}`;
