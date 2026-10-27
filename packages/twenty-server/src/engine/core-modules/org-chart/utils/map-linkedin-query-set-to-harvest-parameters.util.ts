import type { SearchQuerySet } from 'src/engine/core-modules/linkedin-query-generation/types/linkedin-query-generation.types';

import { splitHarvestTitleList } from './harvest-search-params.util';

export type HarvestQuerySetCategory = 'people' | 'companies';

export type HarvestQuerySetSearch = {
  id: string;
  label: string;
  searchParameters: Record<string, string[] | string>;
  // Employer names still to turn into LinkedIn company URLs for
  // `currentCompanies`; Harvest does not match companies by name
  companyNames: string[];
};

const toNames = (values: string[] | null): string[] =>
  [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];

const andClauses = (clauses: Array<string | undefined>): string | undefined => {
  const present = clauses.filter((clause): clause is string => !!clause);

  if (present.length <= 1) {
    return present[0];
  }

  return present.map((clause) => `(${clause})`).join(' AND ');
};

// Harvest takes titles and locations as text, so a generated query set maps
// over without facet ids; only employers need resolving
export const mapLinkedinQuerySetToHarvestParameters = ({
  querySet,
  category,
}: {
  querySet: SearchQuerySet;
  category: HarvestQuerySetCategory;
}): HarvestQuerySetSearch[] => {
  const seen = new Set<string>();

  return querySet.search_query_set.flatMap((query, index) => {
    const keywords = query.keywords?.trim() || undefined;
    const jobTitle = query.job_title?.trim() || undefined;
    const locations = toNames(query.location);
    let searchParameters: Record<string, string[] | string>;
    let companyNames: string[] = [];

    if (category === 'people') {
      const titles = jobTitle ? splitHarvestTitleList(jobTitle) : [];
      const search = andClauses([
        keywords,
        titles === null ? jobTitle : undefined,
      ]);
      companyNames = toNames(query.company);

      searchParameters = {
        ...(search ? { search } : {}),
        ...(titles && titles.length > 0 ? { currentJobTitles: titles } : {}),
        ...(locations.length > 0 ? { locations } : {}),
      };
    } else {
      searchParameters = {
        ...(keywords ? { search: keywords } : {}),
        ...(locations.length > 0 ? { headquarterLocations: locations } : {}),
      };
    }

    const signature = JSON.stringify([searchParameters, companyNames]);
    if (
      (Object.keys(searchParameters).length === 0 &&
        companyNames.length === 0) ||
      seen.has(signature)
    ) {
      return [];
    }
    seen.add(signature);

    return [
      {
        id: `harvest-query-${category}-${index + 1}`,
        label: [keywords, jobTitle, ...locations, ...companyNames]
          .filter(Boolean)
          .join(' · '),
        searchParameters,
        companyNames,
      },
    ];
  });
};
