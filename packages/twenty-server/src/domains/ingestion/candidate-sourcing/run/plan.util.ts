import {
  type PlannedQuery,
  type RunCandidate,
} from 'src/domains/ingestion/candidate-sourcing/run/sourcing-run.types';
import {
  pageCostUsd,
  type SourceSpec,
  type SourceSpecKind,
} from 'src/domains/ingestion/candidate-sourcing/sources/adapter';
import {
  resolveSource,
  type LinkedInSearchType,
  type SourceAlias,
} from 'src/domains/ingestion/candidate-sourcing/sources/registry';

// PLAN: queries x sources -> candidates. Free, and the same function is the
// preview the agent reads before anything is spent.

export const DEFAULT_SOURCING_PAGE_SIZE = 25;

const quoted = (value: string): string =>
  /\s/.test(value) ? `"${value.replace(/"/g, '')}"` : value;

// One query in the shape a source accepts: the three spec kinds say the same
// thing three ways
export const specFor = (
  kind: SourceSpecKind,
  query: PlannedQuery,
): SourceSpec => {
  const facets = {
    ...(query.jobTitle !== null && { jobTitle: query.jobTitle }),
    ...(query.companies.length > 0 && { companies: query.companies }),
    ...(query.locations.length > 0 && { locations: query.locations }),
  };

  switch (kind) {
    case 'facets':
      return {
        kind,
        filters: {
          ...facets,
          ...(query.keywords !== null && { keywords: query.keywords }),
        },
      };
    case 'boolean':
      return { kind, query: query.keywords ?? '', facets };
    case 'string':
      return {
        kind,
        query: [
          query.jobTitle,
          query.keywords,
          ...query.companies.map(quoted),
          ...query.locations.map(quoted),
        ]
          .filter((part): part is string => part !== null && part !== '')
          .join(' '),
      };
  }
};

const newCandidate = (
  fields: Pick<
    RunCandidate,
    'id' | 'source' | 'label' | 'spec' | 'costPerPageUsd' | 'pageSize'
  > & { searchType?: LinkedInSearchType },
): RunCandidate => ({
  ...fields,
  pages: 0,
  fetched: 0,
  newUnique: 0,
  available: null,
  live: true,
});

export type PlanResult = {
  candidates: RunCandidate[];
  // Sources the brief named that cannot be run, with the reason, so the
  // agent reports them instead of the run quietly ignoring them
  unusable: Array<{ source: string; reason: string }>;
};

export const planCandidates = ({
  queries,
  sources,
  searchType,
  pageSize = DEFAULT_SOURCING_PAGE_SIZE,
  idPrefix = 'c',
  rejects,
}: {
  queries: PlannedQuery[];
  sources: string[];
  searchType?: LinkedInSearchType;
  rejects?: (source: SourceAlias, spec: SourceSpec) => string | undefined;
  pageSize?: number;
  idPrefix?: string;
}): PlanResult => {
  const candidates: RunCandidate[] = [];
  const unusable: PlanResult['unusable'] = [];

  for (const name of sources) {
    const descriptor = resolveSource(name);

    if (descriptor === undefined) {
      unusable.push({ source: name, reason: 'not a source the loop knows' });
      continue;
    }

    const costPerPageUsd = pageCostUsd(descriptor.costModel, pageSize);

    // Unpriced is not free: a run cannot keep to a budget on a price it does
    // not know
    if (costPerPageUsd === null) {
      unusable.push({
        source: descriptor.alias,
        reason: 'no price is recorded for it',
      });
      continue;
    }

    for (const query of queries) {
      const spec = specFor(descriptor.kinds[0], query);
      const rejection = rejects?.(descriptor.alias, spec);

      if (rejection !== undefined) {
        // Once per source and reason, however many queries hit it
        if (
          !unusable.some(
            (entry) =>
              entry.source === descriptor.alias && entry.reason === rejection,
          )
        ) {
          unusable.push({ source: descriptor.alias, reason: rejection });
        }
        continue;
      }

      candidates.push(
        newCandidate({
          id: `${idPrefix}${candidates.length + 1}`,
          source: descriptor.alias,
          ...(descriptor.countReliability === 'by_search_type' &&
            searchType !== undefined && { searchType }),
          label: query.label,
          spec,
          costPerPageUsd,
          pageSize,
        }),
      );
    }
  }

  return { candidates, unusable };
};

// A candidate the source cannot serve in one search (LinkedIn stops at 2,500
// rows) becomes smaller candidates. This is all an org-chart "shard" is.
export const needsSplit = (
  candidate: RunCandidate,
  maxRowsPerSearch: number | undefined,
): boolean =>
  maxRowsPerSearch !== undefined &&
  candidate.available !== null &&
  candidate.available > maxRowsPerSearch;

export const splitCandidate = (
  candidate: RunCandidate,
  parts: SourceSpec[],
): RunCandidate[] =>
  parts.map((spec, index) =>
    newCandidate({
      id: `${candidate.id}.${index + 1}`,
      source: candidate.source,
      ...(candidate.searchType !== undefined && {
        searchType: candidate.searchType,
      }),
      label: `${candidate.label} (${index + 1}/${parts.length})`,
      spec,
      costPerPageUsd: candidate.costPerPageUsd,
      pageSize: candidate.pageSize,
    }),
  );
