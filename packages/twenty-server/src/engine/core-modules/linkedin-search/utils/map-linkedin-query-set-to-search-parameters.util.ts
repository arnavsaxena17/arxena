import { type LinkedInSearchType } from 'twenty-shared';

import { mapLinkedinSearchQueriesToGeneratedParameters } from 'src/engine/core-modules/candidate-search/utils/linkedin-query-generation-mapper.util';
import type { SearchQuerySet } from 'src/engine/core-modules/linkedin-query-generation/types/linkedin-query-generation.types';

import { type LinkedinSearchCategory } from './linkedin-search-mode.util';

export type LinkedinQuerySetSearch = {
  id: string;
  label: string;
  searchParameters: Record<string, unknown>;
};

const toNonEmptyNames = (values: string[] | null): string[] =>
  (values ?? []).map((value) => value.trim()).filter(Boolean);

// The query set is mode-neutral (names, not facet ids). People reuse the
// candidate-search mapper so Ask AI and the candidate search build the same
// payloads; companies only carry keywords and location.
export const mapLinkedinQuerySetToSearchParameters = ({
  querySet,
  mode,
  category,
  requirement,
}: {
  querySet: SearchQuerySet;
  mode: LinkedInSearchType;
  category: LinkedinSearchCategory;
  requirement?: string;
}): LinkedinQuerySetSearch[] => {
  if (category === 'people') {
    const generated = mapLinkedinSearchQueriesToGeneratedParameters(
      querySet,
      mode,
      requirement,
    );
    const strategies =
      mode === 'classic'
        ? generated.classicPeopleSearchStrategies
        : mode === 'sales_navigator'
          ? generated.salesNavigatorPeopleSearchStrategies
          : generated.recruiterPeopleSearchStrategies;

    return (strategies ?? []).map((strategy) => ({
      id: strategy.id,
      label: strategy.label ?? strategy.id,
      searchParameters: strategy.parameters as Record<string, unknown>,
    }));
  }

  const seen = new Set<string>();

  return querySet.search_query_set.flatMap((query, index) => {
    const keywords = query.keywords?.trim() || undefined;
    const locations = toNonEmptyNames(query.location);
    const searchParameters: Record<string, unknown> = {
      ...(keywords ? { keywords } : {}),
      ...(locations.length > 0
        ? {
            location:
              mode === 'sales_navigator' ? { include: locations } : locations,
          }
        : {}),
    };

    const signature = JSON.stringify(searchParameters);
    if (Object.keys(searchParameters).length === 0 || seen.has(signature)) {
      return [];
    }
    seen.add(signature);

    return [
      {
        id: `linkedin-query-companies-${index + 1}`,
        label: [keywords, ...locations].filter(Boolean).join(' · '),
        searchParameters,
      },
    ];
  });
};

// The facet resolver adds `<facet>_display` entries for logging; Unipile
// rejects unknown keys, so they travel next to the payload instead
export const splitLinkedinFacetDisplay = (
  resolved: Record<string, unknown>,
): {
  searchParameters: Record<string, unknown>;
  display: Record<string, unknown>;
} => {
  const searchParameters: Record<string, unknown> = {};
  const display: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(resolved)) {
    if (value === undefined) {
      continue;
    }
    if (key.endsWith('_display')) {
      display[key.slice(0, -'_display'.length)] = value;
    } else {
      searchParameters[key] = value;
    }
  }

  return { searchParameters, display };
};
