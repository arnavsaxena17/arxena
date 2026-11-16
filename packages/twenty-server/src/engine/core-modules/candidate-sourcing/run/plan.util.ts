import { BRIGHT_DATA_ESTIMATE_BUDGET_USD } from 'src/engine/core-modules/bright-data/ludicrous/constants/bright-data-ludicrous-pricing.const';
import {
  type SourcingAdapterId,
  type SourcingCandidate,
} from 'src/engine/core-modules/candidate-sourcing/run/sourcing-run.types';
import { type SourcingSourceKey } from 'src/engine/core-modules/candidate-sourcing/sources/registry';
import { type SourcingSpec } from 'src/engine/core-modules/outreach-command/utils/sourcing-spec.util';

// PLAN: spec -> candidates. No spend, and the same function is the preview the
// confirm card shows, so what the user approves is what runs.

// Sources the loop can fetch from today, by the adapter that drives them.
// LinkedIn and Harvest wait for the Python compiler (W3) to build their
// boolean queries; until then a run on them is planned without them.
const ADAPTER_BY_SOURCE: Partial<Record<SourcingSourceKey, SourcingAdapterId>> =
  {
    'internal-index': 'people_index',
    'bright-data': 'bright_data_people',
  };

// Without a source pick the free index goes first, then Bright Data
export const DEFAULT_LOOP_SOURCES: SourcingSourceKey[] = [
  'internal-index',
  'bright-data',
];

// Per company x role pair cap find_people_by_company spends by default
const PEOPLE_BY_COMPANY_PER_PAIR_USD = 0.1;

const wordsOf = (spec: SourcingSpec, field: string): string[] =>
  spec.hard
    .filter((constraint) => constraint.field === field)
    .map((constraint) => constraint.userWords);

// The words a search box gets: who, where, at what kind of employer
export const buildSearchQuery = (spec: SourcingSpec): string =>
  [
    ...wordsOf(spec, 'title'),
    ...wordsOf(spec, 'seniority'),
    ...wordsOf(spec, 'function'),
    ...wordsOf(spec, 'industry'),
    ...wordsOf(spec, 'location'),
  ]
    .join(' ')
    .trim();

const candidateOf = (
  adapter: SourcingAdapterId,
  source: SourcingSourceKey,
  query: string,
  index: number,
): SourcingCandidate => ({
  id: `${adapter}-${index + 1}`,
  source,
  adapter,
  query,
  fetched: 0,
  newRows: 0,
  qualified: 0,
  spentUsd: 0,
  exhausted: false,
});

export const planCandidates = ({
  spec,
  request,
  sources,
}: {
  spec: SourcingSpec;
  request: string;
  sources?: string[];
}): SourcingCandidate[] => {
  const companies = wordsOf(spec, 'company');

  // Named employers are company x role pairs: find_people_by_company runs its
  // whole cascade as one fetch round
  if (companies.length > 0) {
    return [
      candidateOf('people_by_company', 'bright-data', companies.join(' | '), 0),
    ];
  }

  const picked = (sources ?? DEFAULT_LOOP_SOURCES).filter(
    (source): source is SourcingSourceKey =>
      ADAPTER_BY_SOURCE[source as SourcingSourceKey] !== undefined,
  );

  return picked.map((source, index) =>
    candidateOf(
      ADAPTER_BY_SOURCE[source] as SourcingAdapterId,
      source,
      // Bright Data's planner reads the request as written; the index needs
      // the search words
      source === 'bright-data'
        ? request.trim()
        : buildSearchQuery(spec) || request.trim(),
      index,
    ),
  );
};

// The picked sources the loop cannot fetch from yet, so the card says so
// instead of rounding the request down to the sources it has
export const unplannedSources = (sources: string[] | undefined): string[] =>
  (sources ?? []).filter(
    (source) => ADAPTER_BY_SOURCE[source as SourcingSourceKey] === undefined,
  );

// Upper bound of what PROBE can spend before the user sees a yield number
export const estimateProbeCostUsd = (
  candidates: SourcingCandidate[],
  spec: SourcingSpec,
): number =>
  candidates.reduce((total, candidate) => {
    switch (candidate.adapter) {
      case 'bright_data_people':
        return total + BRIGHT_DATA_ESTIMATE_BUDGET_USD;
      case 'people_by_company':
        return (
          total +
          PEOPLE_BY_COMPANY_PER_PAIR_USD *
            Math.max(1, wordsOf(spec, 'company').length)
        );
      case 'people_index':
        return total;
    }
  }, 0);
