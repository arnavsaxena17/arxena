import { roundUsd } from 'src/domains/ingestion/candidate-sourcing/sources/adapter';

// SELECT: rank the probed candidates by expected unique-qualified rows per
// dollar, then split the budget down that ranking. Pure.

// A free source with no trustworthy count and no target would otherwise be
// given an endless round
export const SOURCING_SELECT_MAX_PAGES_PER_CANDIDATE = 10;

export type SelectCandidate = {
  id: string;
  // From the source's cost model; 0 for a free source
  costPerPageUsd: number;
  pageSize: number;
  // Rows the source says match. null when its count cannot be trusted.
  available: number | null;
  // Rows already pulled from this candidate, the probe page included
  fetched: number;
  // Of those, rows the project did not already have
  newUnique: number;
  // Set once rows from this candidate have been judged (a FIX round re-selects)
  judged?: number;
  qualified?: number;
};

export type SelectedCandidate = {
  id: string;
  pages: number;
  budgetUsd: number;
  expectedQualified: number;
  // null for a free source: there is no dollar to divide by
  qualifiedPerUsd: number | null;
};

type Ranked = {
  candidate: SelectCandidate;
  qualifiedPerPage: number;
  qualifiedPerUsd: number;
  pagesLeft: number;
};

// A candidate nobody has judged yet is assumed to qualify at the rate of the
// ones that have been, so one judged candidate does not lose to the unjudged
const pooledQualifiedShare = (candidates: SelectCandidate[]): number => {
  const judged = candidates.reduce(
    (total, candidate) => total + (candidate.judged ?? 0),
    0,
  );
  const qualified = candidates.reduce(
    (total, candidate) =>
      total + ((candidate.judged ?? 0) > 0 ? (candidate.qualified ?? 0) : 0),
    0,
  );

  return judged > 0 ? qualified / judged : 1;
};

const rank = (candidates: SelectCandidate[]): Ranked[] => {
  const prior = pooledQualifiedShare(candidates);

  return candidates
    .map((candidate): Ranked => {
      const uniqueShare =
        candidate.fetched > 0 ? candidate.newUnique / candidate.fetched : 0;
      const qualifiedShare =
        candidate.judged !== undefined && candidate.judged > 0
          ? (candidate.qualified ?? 0) / candidate.judged
          : prior;
      const qualifiedPerPage =
        candidate.pageSize * uniqueShare * qualifiedShare;

      return {
        candidate,
        qualifiedPerPage,
        qualifiedPerUsd:
          candidate.costPerPageUsd > 0
            ? qualifiedPerPage / candidate.costPerPageUsd
            : Number.POSITIVE_INFINITY,
        pagesLeft:
          candidate.available === null
            ? SOURCING_SELECT_MAX_PAGES_PER_CANDIDATE
            : Math.min(
                SOURCING_SELECT_MAX_PAGES_PER_CANDIDATE,
                Math.ceil(
                  Math.max(0, candidate.available - candidate.fetched) /
                    candidate.pageSize,
                ),
              ),
      };
    })
    .filter(
      (entry) =>
        entry.candidate.pageSize > 0 &&
        entry.qualifiedPerPage > 0 &&
        entry.pagesLeft > 0,
    )
    .sort(
      (first, second) =>
        second.qualifiedPerUsd - first.qualifiedPerUsd ||
        second.qualifiedPerPage - first.qualifiedPerPage ||
        first.candidate.id.localeCompare(second.candidate.id),
    );
};

export const selectCandidates = ({
  candidates,
  budgetUsd,
  need,
  maxCandidates,
}: {
  candidates: SelectCandidate[];
  // What is left of the run's one budget
  budgetUsd: number;
  // Qualified rows still wanted; null when the run has no target
  need: number | null;
  maxCandidates?: number;
}): SelectedCandidate[] => {
  const selected: SelectedCandidate[] = [];
  let budgetLeft = Math.max(0, budgetUsd);
  let needLeft = need ?? Number.POSITIVE_INFINITY;

  for (const entry of rank(candidates)) {
    if (
      needLeft <= 0 ||
      (maxCandidates !== undefined && selected.length >= maxCandidates)
    ) {
      break;
    }

    const cost = entry.candidate.costPerPageUsd;
    const pages = Math.min(
      entry.pagesLeft,
      Math.ceil(needLeft / entry.qualifiedPerPage),
      // The tolerance keeps 0.03 / 0.01 from flooring to 2
      cost > 0
        ? Math.floor(budgetLeft / cost + 1e-9)
        : Number.POSITIVE_INFINITY,
    );

    if (pages < 1) {
      continue;
    }

    const expectedQualified = pages * entry.qualifiedPerPage;

    selected.push({
      id: entry.candidate.id,
      pages,
      budgetUsd: roundUsd(pages * cost),
      expectedQualified: Number(expectedQualified.toFixed(2)),
      qualifiedPerUsd:
        cost > 0 ? Number(entry.qualifiedPerUsd.toFixed(2)) : null,
    });

    budgetLeft -= pages * cost;
    needLeft -= expectedQualified;
  }

  return selected;
};
