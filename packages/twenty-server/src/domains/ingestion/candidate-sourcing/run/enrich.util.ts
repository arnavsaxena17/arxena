import { type JudgeEnrichLevel } from 'src/domains/ingestion/candidate-sourcing/run/judge.util';
import {
  type EnrichmentStep,
  type JudgedRow,
} from 'src/domains/ingestion/candidate-sourcing/run/sourcing-run.types';
import { roundUsd } from 'src/domains/ingestion/candidate-sourcing/sources/adapter';

// ENRICH: buy evidence for undecided rows only. A row that failed, qualified
// or is waiting on the candidate is never enriched: nothing a source sells
// would change its outcome.

// Per row. A profile is the cheaper of the two, so it is tried first.
export const SOURCING_ENRICH_COST_USD: Readonly<
  Record<JudgeEnrichLevel, number>
> = {
  profile: 0.02,
  company_web: 0.03,
};

export type EnrichmentPlan = {
  steps: EnrichmentStep[];
  costUsd: number;
  // Undecided rows the budget did not reach
  unfunded: number;
};

export const planEnrichment = ({
  rows,
  budgetUsd,
  costUsd = SOURCING_ENRICH_COST_USD,
}: {
  rows: JudgedRow[];
  budgetUsd: number;
  costUsd?: Readonly<Record<JudgeEnrichLevel, number>>;
}): EnrichmentPlan => {
  const byLevel = new Map<JudgeEnrichLevel, string[]>();
  let budgetLeft = Math.max(0, budgetUsd);
  let unfunded = 0;

  // One level per row per pass: the cheapest that can settle it. If that does
  // not settle it, the re-judge names the next level and it queues again.
  const undecided = rows
    .filter((row) => row.outcome === 'unknown' && row.enrich.length > 0)
    .sort(
      (first, second) => costUsd[first.enrich[0]] - costUsd[second.enrich[0]],
    );

  for (const row of undecided) {
    const level = row.enrich[0];

    // The tolerance keeps 0.06 - 3 x 0.02 from reading as less than zero
    if (costUsd[level] > budgetLeft + 1e-9) {
      unfunded += 1;
      continue;
    }

    budgetLeft -= costUsd[level];
    byLevel.set(level, [...(byLevel.get(level) ?? []), row.rowId]);
  }

  const steps = [...byLevel.entries()].map(
    ([level, rowIds]): EnrichmentStep => ({
      level,
      rowIds,
      costUsd: roundUsd(rowIds.length * costUsd[level]),
    }),
  );

  return {
    steps,
    costUsd: roundUsd(steps.reduce((total, step) => total + step.costUsd, 0)),
    unfunded,
  };
};
