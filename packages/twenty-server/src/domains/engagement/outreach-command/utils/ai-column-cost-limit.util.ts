export const AI_COLUMN_AUTO_RUN_MAX_USD_ENV = 'AI_COLUMN_AUTO_RUN_MAX_USD';
export const DEFAULT_AI_COLUMN_AUTO_RUN_MAX_USD = 5;

// What a full AI column run may cost before the user has to approve it. Under
// the limit the agent runs without asking; over it, run_ai_column refuses until
// it is given the amount the user approved. 0 means always ask.
export const getAiColumnAutoRunMaxUsd = (
  env: Record<string, string | undefined> = process.env,
): number => {
  const value = Number.parseFloat(
    (env[AI_COLUMN_AUTO_RUN_MAX_USD_ENV] ?? '').trim(),
  );

  return Number.isFinite(value) && value >= 0
    ? value
    : DEFAULT_AI_COLUMN_AUTO_RUN_MAX_USD;
};

// The cost of the rows a run will touch. A run limited to N rows costs at most
// N rows' worth, whatever the estimate for the whole table was.
export const estimateRunCostUsd = ({
  estimatedRunCostUsd,
  estimatedPerRowUsd,
  rowLimit,
}: {
  estimatedRunCostUsd: number | null | undefined;
  estimatedPerRowUsd: number | null | undefined;
  rowLimit?: number;
}): number | null => {
  if (estimatedRunCostUsd === null || estimatedRunCostUsd === undefined) {
    return null;
  }

  return rowLimit !== undefined &&
    estimatedPerRowUsd !== null &&
    estimatedPerRowUsd !== undefined
    ? Math.min(estimatedRunCostUsd, estimatedPerRowUsd * rowLimit)
    : estimatedRunCostUsd;
};

// Unknown cost (Jev, drafted messages) never blocks: there is nothing to approve
export const needsCostApproval = ({
  estimatedCostUsd,
  approvedCostUsd,
  limitUsd = getAiColumnAutoRunMaxUsd(),
}: {
  estimatedCostUsd: number | null;
  approvedCostUsd?: number;
  limitUsd?: number;
}): boolean =>
  estimatedCostUsd !== null &&
  estimatedCostUsd > limitUsd &&
  !(approvedCostUsd !== undefined && approvedCostUsd >= estimatedCostUsd);
