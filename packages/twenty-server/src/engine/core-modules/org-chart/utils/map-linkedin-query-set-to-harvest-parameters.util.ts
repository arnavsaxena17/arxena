import type { SearchQuerySet } from 'src/engine/core-modules/linkedin-query-generation/types/linkedin-query-generation.types';

import {
  HARVEST_INDUSTRY_ID_BY_LABEL,
  normalizeHarvestFilterLabel,
  resolveHarvestFunctionIdForRoot,
  resolveHarvestIndustryIds,
  resolveHarvestSeniorityLevelIds,
} from 'src/engine/core-modules/candidate-search/constants/harvest-filter-ids';

import { splitHarvestTitleList } from './harvest-search-params.util';

export type HarvestQuerySetCategory = 'people' | 'companies';

export type HarvestQuerySetSearch = {
  id: string;
  label: string;
  searchParameters: Record<string, string[] | string>;
  // Employer names still to turn into LinkedIn company URLs for
  // `currentCompanies`; Harvest does not match companies by name
  companyNames: string[];
  // Facet values Harvest takes only as ids, that the taxonomy could not
  // resolve. Harvest accepts a valid-but-wrong id and silently returns a
  // different population, so an unresolved label is unsent and reported here
  // rather than guessed at.
  unresolvedFilters?: string[];
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
    const unresolvedFilters: string[] = [];
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

      // Harvest's leads search has a named exclude* parameter for each facet;
      // sending "not these" as a keyword would be silently ignored instead
      const excludedLocations = toNames(query.exclude_locations ?? null);
      const excludedCompanies = toNames(query.exclude_companies ?? null);

      // Harvest takes industries, seniority and function only as ids. The
      // taxonomy resolves names against the vendor's own tables; a label it
      // cannot match is reported rather than sent as a near-miss id, because
      // Harvest accepts a valid-but-wrong id and quietly returns a different
      // population.
      const industryLabels = toNames(query.industry_terms ?? null);
      const industryIds = resolveHarvestIndustryIds(industryLabels);
      const unresolvedIndustries = industryLabels.filter(
        (label) => !HARVEST_INDUSTRY_ID_BY_LABEL[normalizeHarvestFilterLabel(label)],
      );
      const seniorityIds = resolveHarvestSeniorityLevelIds(
        query.seniority ? [query.seniority] : [],
      );
      const functionId = resolveHarvestFunctionIdForRoot(
        query.function ?? null,
      );
      const excludedIndustryIds = resolveHarvestIndustryIds(
        toNames(query.exclude_industries ?? null),
      );

      searchParameters = {
        ...(search ? { search } : {}),
        ...(titles && titles.length > 0 ? { currentJobTitles: titles } : {}),
        ...(locations.length > 0 ? { locations } : {}),
        ...(industryIds.length > 0 && { industryIds }),
        ...(seniorityIds.length > 0 && { seniorityLevelIds: seniorityIds }),
        ...(functionId ? { functionIds: [functionId] } : {}),
        ...(excludedLocations.length > 0 && {
          excludeLocations: excludedLocations,
        }),
        ...(excludedCompanies.length > 0 && {
          excludeCurrentCompanies: excludedCompanies,
        }),
        ...(excludedIndustryIds.length > 0 && {
          excludeIndustryIds: excludedIndustryIds,
        }),
      };

      if (unresolvedIndustries.length > 0) {
        unresolvedFilters.push(
          ...unresolvedIndustries.map(
            (label) =>
              `industry "${label}" has no Harvest industry id, so it was not sent`,
          ),
        );
      }

    } else {
      // Harvest's company search takes `location`; `headquarterLocations` is a
      // people-search name and would be dropped without an error
      searchParameters = {
        ...(keywords ? { search: keywords } : {}),
        ...(locations.length > 0 ? { location: locations } : {}),
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
        ...(unresolvedFilters.length > 0 && { unresolvedFilters }),
      },
    ];
  });
};
