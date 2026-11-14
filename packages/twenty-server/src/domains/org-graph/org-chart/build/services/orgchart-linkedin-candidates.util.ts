import { extractLinkedinProfileUrlFromOrgChartCandidateRow } from 'src/domains/org-graph/org-chart/utils/orgchart-candidate-linkedin-url.util';
import { filterOrgChartCandidatesByCountryAndFunctionRoot } from 'src/domains/org-graph/org-chart/utils/orgchart-filter.util';
import {
  filterOrgChartCandidatesByNodeStdLabels,
  type OrgChartNodeStdScope,
} from 'src/domains/org-graph/org-chart/utils/orgchart-node-scope-filter.util';

import { type OrgchartStrategyResult } from 'src/domains/org-graph/org-chart/build/types/orgchart-linkedin-search.types';

// One row per person: the profile URL when the row carries one, else the id
// or name it has.
export const dedupeOrgchartCandidates = (candidates: unknown[]): unknown[] => {
  const seen = new Set<string>();
  const deduped: unknown[] = [];

  for (const candidate of candidates) {
    const row = candidate as Record<string, unknown>;
    const key =
      extractLinkedinProfileUrlFromOrgChartCandidateRow(row)?.toLowerCase() ||
      String(row.id ?? row.linkedin_url ?? row.public_identifier ?? '').trim();

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(candidate);
  }

  return deduped;
};

// DEDUPE AND RETURN: every strategy's transformed rows, one per person, then
// the scope filters the request asked for. A business-division request is
// filtered the same way, because its keywords already narrow the search.
export const dedupeAndReturnCandidates = (input: {
  strategyResults: OrgchartStrategyResult[];
  // The request carried a country, function, location or leadership filter
  hasSubsetScopeFilters: boolean;
  // A business division refines country and function itself
  businessDivisionRequested: boolean;
  country: string;
  functionRoot: string;
  mode?: string;
  stdFunction?: string;
  stdGrade?: string;
  selectedNodeStdScopes?: OrgChartNodeStdScope[];
}): unknown[] => {
  const allCandidates = dedupeOrgchartCandidates(
    input.strategyResults.flatMap(
      (strategyResult) => strategyResult.result?.transformedCandidates || [],
    ),
  );

  const scoped =
    input.hasSubsetScopeFilters || input.businessDivisionRequested
      ? filterOrgChartCandidatesByCountryAndFunctionRoot(
          allCandidates,
          input.country,
          input.functionRoot,
        )
      : allCandidates;

  return filterOrgChartCandidatesByNodeStdLabels(scoped, input.mode, {
    stdFunction: input.stdFunction,
    stdGrade: input.stdGrade,
    selectedNodeStdScopes: input.selectedNodeStdScopes,
  });
};
