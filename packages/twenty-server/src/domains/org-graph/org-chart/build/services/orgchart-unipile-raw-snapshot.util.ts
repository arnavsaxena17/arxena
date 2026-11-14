import { type LinkedInSearchResult } from 'src/domains/discovery/transport/linkedin-search/types/linkedin-search-response.type';
import { type OrgChartS3Service } from 'src/domains/org-graph/org-chart/services/orgchart-s3.service';
import { type OrgChartUnipileRawSearchPayload } from 'src/domains/org-graph/org-chart/types/orgchart-unipile-raw-search.types';

import { type OrgchartStrategyResult } from 'src/domains/org-graph/org-chart/build/types/orgchart-linkedin-search.types';

// One page of raw LinkedIn items per person, deduped inside the round, so the
// persisted snapshot has no repeats from overlapping strategies.
export const extractRawLinkedInItems = (
  strategyResults: Array<Pick<OrgchartStrategyResult, 'result'>>,
): LinkedInSearchResult[] => {
  const seenKeys = new Set<string>();
  const items: LinkedInSearchResult[] = [];

  for (const strategyResult of strategyResults) {
    const searchResults = strategyResult.result?.searchResults as
      | { items?: LinkedInSearchResult[] }
      | null
      | undefined;
    const pageItems = Array.isArray(searchResults?.items)
      ? searchResults.items
      : [];

    for (const item of pageItems) {
      const key =
        (item as { public_identifier?: string }).public_identifier ??
        item.id ??
        (item as { name?: string }).name ??
        '';

      if (!key || seenKeys.has(key)) {
        continue;
      }

      seenKeys.add(key);
      items.push(item);
    }
  }

  return items;
};

// PERSIST: keep the raw Unipile pages even if the transform or the filters
// later drop everyone, so a rebuild does not pay for the same pages again.
export const persistRawSnapshot = async (
  deps: Pick<
    OrgChartS3Service,
    'persistedCompanyFolderKey' | 'saveUnipileRawSearch'
  >,
  input: {
    strategyResults: OrgchartStrategyResult[];
    searchType: 'classic' | 'sales_navigator' | 'recruiter';
    companyId?: string;
    companyName?: string;
    mode?: string;
    functionRoot?: string;
    country?: string;
    requestId?: string;
  },
): Promise<void> => {
  const persistKey = deps.persistedCompanyFolderKey(
    input.companyId,
    input.companyName || input.companyId || '',
  );

  if (!persistKey.trim()) {
    return;
  }

  const items = extractRawLinkedInItems(input.strategyResults);

  if (items.length === 0) {
    return;
  }

  const payload: OrgChartUnipileRawSearchPayload = {
    version: 1,
    savedAt: new Date().toISOString(),
    companyId: input.companyId || undefined,
    companyName: input.companyName || undefined,
    searchType: input.searchType,
    mode: input.mode,
    functionRoot: input.functionRoot,
    country: input.country,
    requestId: input.requestId,
    itemCount: items.length,
    items,
  };

  await deps.saveUnipileRawSearch(persistKey, payload);
};
