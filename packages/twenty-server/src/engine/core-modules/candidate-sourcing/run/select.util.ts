import { type SourcingCandidate } from 'src/engine/core-modules/candidate-sourcing/run/sourcing-run.types';

// SELECT: rank by expected unique qualified per dollar and split the budget.
// Pure; no spend.

// A free source still has a cost in rounds, so its yield is divided by this
const MIN_COST_USD = 0.01;
// A new row the judge has not settled is worth a fraction of a qualified one
const NEW_ROW_WEIGHT = 0.1;
// Candidates funded per round; the rest wait for a FIX or a later round
export const SELECT_TOP_K = 2;

export const yieldPerDollarOf = (candidate: SourcingCandidate): number => {
  const probe = candidate.probe;

  if (probe === undefined) {
    return 0;
  }

  const value = probe.qualified + probe.newRows * NEW_ROW_WEIGHT;

  return value / Math.max(probe.costUsd, MIN_COST_USD);
};

// Live candidates, best first. A candidate that returned nothing new on its
// probe ranks last but is not dropped: the stop rules decide when it is done.
export const rankCandidates = (
  candidates: SourcingCandidate[],
): SourcingCandidate[] =>
  candidates
    .filter((candidate) => !candidate.exhausted)
    .map((candidate, index) => ({ candidate, index }))
    .sort(
      (left, right) =>
        yieldPerDollarOf(right.candidate) - yieldPerDollarOf(left.candidate) ||
        left.index - right.index,
    )
    .map(({ candidate }) => candidate);

// Splits what is left of the budget across the top candidates in proportion
// to their yield. Each funded candidate gets at least an equal tenth, so a
// weak probe still gets one more page before it is judged exhausted.
export const splitBudget = (
  remainingUsd: number,
  ranked: SourcingCandidate[],
  topK: number = SELECT_TOP_K,
): Map<string, number> => {
  const funded = ranked.slice(0, topK);
  const shares = new Map<string, number>();

  if (funded.length === 0 || remainingUsd <= 0) {
    return shares;
  }

  const floor = remainingUsd / funded.length / 10;
  const weights = funded.map((candidate) => yieldPerDollarOf(candidate));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const spreadable = remainingUsd - floor * funded.length;

  funded.forEach((candidate, index) => {
    const proportional =
      totalWeight > 0
        ? (spreadable * weights[index]) / totalWeight
        : spreadable / funded.length;

    shares.set(candidate.id, floor + proportional);
  });

  return shares;
};
