import {
  resolveHarvestFunctionIdForRoot,
  resolveHarvestIndustryIds,
  resolveHarvestSeniorityLevelIds,
} from 'src/engine/core-modules/candidate-search/constants/harvest-filter-ids';
import type { HarvestUnresolvedFilter } from 'src/engine/core-modules/candidate-search/constants/harvest-filter-ids';
import type { SearchQuerySet } from 'src/engine/core-modules/linkedin-query-generation/types/linkedin-query-generation.types';
import { type LinkedInSeniorityType } from 'src/engine/core-modules/linkedin-search/types/linkedin-search-parameter.type';

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

// Harvest bills per call, so the ladder is capped. The order is the order of
// value: the full query first, then the two single-carrier relaxations, then
// the facet browse. A query with fewer carriers produces fewer searches.
export const HARVEST_MAX_SEARCHES_PER_QUERY = 4;

type HarvestParameters = Record<string, string[] | string>;

type Variant = {
  kind: string;
  label?: string;
  parameters: HarvestParameters;
};

const toNames = (values: string[] | null | undefined): string[] => [
  ...new Set((values ?? []).map((value) => value.trim()).filter(Boolean)),
];

// One line per facet the resolver could not map, so a caller can say which
// constraint a Harvest run silently lacks instead of only showing the results.
const describeUnresolvedFilter = ({
  facet,
  label,
  reason,
}: HarvestUnresolvedFilter): string =>
  `${facet} "${label}" was not sent: ${reason}`;

const andClauses = (clauses: Array<string | undefined>): string | undefined => {
  const present = clauses.filter((clause): clause is string => !!clause);

  if (present.length <= 1) {
    return present[0];
  }

  return present.map((clause) => `(${clause})`).join(' AND ');
};

/**
 * One query, several searches.
 *
 * Harvest ANDs every parameter, so a single query silently returns nothing when
 * one constraint is unmet: a person whose title is worded differently, whose
 * employer's industry label differs, or who never filled in a seniority. Each
 * AND is a chance to zero out, so the carriers are varied rather than trusted in
 * combination — the same idea as relaxing one constraint at a time in
 * `playbook-shortfall`, done up front instead of after a shortfall.
 *
 * Location and the excludes are fences the user stated, so every variant keeps
 * them; only the carriers (titles, keywords) and the facet ids are varied.
 */
const buildPeopleVariants = (query: {
  keywords?: string;
  jobTitle?: string;
  locations: string[];
  excludedLocations: string[];
  excludedCompanies: string[];
}): { variants: Variant[]; unresolvedFilters: HarvestUnresolvedFilter[] } => {
  const {
    keywords,
    jobTitle,
    locations,
    excludedLocations,
    excludedCompanies,
  } = query;

  const titles = jobTitle ? splitHarvestTitleList(jobTitle) : [];
  const search = andClauses([keywords, titles === null ? jobTitle : undefined]);

  const fence: HarvestParameters = {
    ...(locations.length > 0 ? { locations } : {}),
    ...(excludedLocations.length > 0 && {
      excludeLocations: excludedLocations,
    }),
    ...(excludedCompanies.length > 0 && {
      excludeCurrentCompanies: excludedCompanies,
    }),
  };
  const fenceKeys = Object.keys(fence).length;

  const direct = (extra: HarvestParameters): HarvestParameters => ({
    ...fence,
    ...extra,
  });
  const isCarrier = (parameters: HarvestParameters): boolean =>
    Object.keys(parameters).length > fenceKeys;

  const variants: Variant[] = [];

  // 1. everything the query holds, as written
  const full = direct({
    ...(search ? { search } : {}),
    ...(titles && titles.length > 0 ? { currentJobTitles: titles } : {}),
  });

  if (isCarrier(full)) {
    variants.push({ kind: 'all', parameters: full });
  }

  // 2. titles alone: a profile worded like the title but missing the keyword
  if (titles && titles.length > 0) {
    variants.push({
      kind: 'titles',
      label: 'titles only',
      parameters: direct({ currentJobTitles: titles }),
    });
  }

  // 3. keywords alone: the role described in words rather than a clean title
  if (keywords) {
    variants.push({
      kind: 'keywords',
      label: 'keywords only',
      parameters: direct({ search: keywords }),
    });
  }

  // 4. what the query carries at all, when only the fence is left
  if (variants.length === 0) {
    variants.push({ kind: 'all', parameters: fence });
  }

  return { variants, unresolvedFilters: [] };
};

const buildFacetVariant = (query: {
  locations: string[];
  excludedLocations: string[];
  excludedCompanies: string[];
  industryTerms: string[];
  seniority?: LinkedInSeniorityType | null;
  functionRoot?: string | null;
  excludedIndustries: string[];
}): { variant?: Variant; unresolvedFilters: HarvestUnresolvedFilter[] } => {
  const {
    locations,
    excludedLocations,
    excludedCompanies,
    industryTerms,
    seniority,
    functionRoot,
    excludedIndustries,
  } = query;

  const industryResolution = resolveHarvestIndustryIds(industryTerms);
  const excludedIndustryResolution =
    resolveHarvestIndustryIds(excludedIndustries);
  const seniorityResolution = resolveHarvestSeniorityLevelIds(
    seniority ? [seniority] : [],
  );
  const functionResolution = resolveHarvestFunctionIdForRoot(
    functionRoot ?? null,
  );

  // an exclusion that failed to resolve is the dangerous one: the run returns
  // rows the caller asked to exclude, and nothing about the payload says so
  const unresolvedFilters = [
    ...industryResolution.unresolved,
    ...excludedIndustryResolution.unresolved,
    ...seniorityResolution.unresolved,
    ...functionResolution.unresolved,
  ];

  const parameters: HarvestParameters = {
    ...(locations.length > 0 ? { locations } : {}),
    ...(excludedLocations.length > 0 && {
      excludeLocations: excludedLocations,
    }),
    ...(excludedCompanies.length > 0 && {
      excludeCurrentCompanies: excludedCompanies,
    }),
    ...(industryResolution.ids.length > 0 && {
      industryIds: industryResolution.ids,
    }),
    ...(seniorityResolution.ids.length > 0 && {
      seniorityLevelIds: seniorityResolution.ids,
    }),
    ...(functionResolution.id ? { functionIds: [functionResolution.id] } : {}),
    ...(excludedIndustryResolution.ids.length > 0 && {
      excludeIndustryIds: excludedIndustryResolution.ids,
    }),
  };

  const hasFacet =
    industryResolution.ids.length > 0 ||
    seniorityResolution.ids.length > 0 ||
    Boolean(functionResolution.id);

  return hasFacet
    ? {
        variant: { kind: 'facet', label: 'facet browse', parameters },
        unresolvedFilters,
      }
    : { variant: undefined, unresolvedFilters };
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

    if (category !== 'people') {
      // A company search has no employer list to resolve; the names it was
      // given are the companies themselves, not employers to turn into URLs
      const companyNames: string[] = [];
      // Harvest's company search takes `location`; `headquarterLocations` is a
      // people-search name and would be dropped without an error
      const companySearch: HarvestParameters = {
        ...(keywords ? { search: keywords } : {}),
        ...(locations.length > 0 ? { location: locations } : {}),
      };
      const signature = JSON.stringify([companySearch, companyNames]);

      if (
        (Object.keys(companySearch).length === 0 &&
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
          searchParameters: companySearch,
          companyNames,
        },
      ];
    }

    const companyNames = toNames(query.company);
    const excludedLocations = toNames(query.exclude_locations ?? null);
    const excludedCompanies = toNames(query.exclude_companies ?? null);
    const industryTerms = toNames(query.industry_terms ?? null);

    const people = buildPeopleVariants({
      keywords,
      jobTitle,
      locations,
      excludedLocations,
      excludedCompanies,
    });
    const faceted = buildFacetVariant({
      locations,
      excludedLocations,
      excludedCompanies,
      industryTerms,
      seniority: query.seniority ?? null,
      functionRoot: query.function ?? null,
      excludedIndustries: toNames(query.exclude_industries ?? null),
    });

    // identical across every variant of this query, so it is described once
    const unresolvedFilters = [
      ...new Set(
        [...people.unresolvedFilters, ...faceted.unresolvedFilters].map(
          describeUnresolvedFilter,
        ),
      ),
    ];

    const variants = [
      ...people.variants,
      ...(faceted.variant ? [faceted.variant] : []),
    ].slice(0, HARVEST_MAX_SEARCHES_PER_QUERY);

    return variants.flatMap((variant) => {
      const signature = JSON.stringify([variant.parameters, companyNames]);

      if (seen.has(signature)) {
        return [];
      }

      seen.add(signature);

      return [
        {
          id: `harvest-query-${category}-${index + 1}-${variant.kind}`,
          label: [
            variant.label,
            keywords,
            jobTitle,
            ...locations,
            ...companyNames,
          ]
            .filter(Boolean)
            .join(' · '),
          searchParameters: variant.parameters,
          companyNames,
          ...(unresolvedFilters.length > 0 && { unresolvedFilters }),
        },
      ];
    });
  });
};
