export type OrgChartCompanyAutocompleteSource =
  | 'pdl'
  | 'arxena'
  | 'linkedin_parameters'
  | 'linkedin_company_search';

export const ORG_CHART_COMPANY_AUTOCOMPLETE_SOURCE_LABELS: Record<
  OrgChartCompanyAutocompleteSource,
  string
> = {
  pdl: 'PDL',
  arxena: 'Arxena index',
  linkedin_parameters: 'LinkedIn parameters',
  linkedin_company_search: 'LinkedIn company search',
};

export const ORG_CHART_COMPANY_AUTOCOMPLETE_SOURCES: OrgChartCompanyAutocompleteSource[] =
  [
    'pdl',
    'arxena',
    'linkedin_parameters',
    'linkedin_company_search',
  ];

const LEGACY_LINKEDIN_COMPANY_SEARCH_SOURCES = [
  'linkedin_company_search_classic',
  'linkedin_company_search_sales_navigator',
] as const;

export const isLinkedInCompanyAutocompleteSource = (
  source: OrgChartCompanyAutocompleteSource,
): boolean =>
  source === 'linkedin_parameters' || source === 'linkedin_company_search';

export const normalizeOrgChartCompanyAutocompleteSource = (
  raw: string,
): OrgChartCompanyAutocompleteSource | null => {
  const normalized = raw.trim().toLowerCase().replace(/-/g, '_');
  if (
    LEGACY_LINKEDIN_COMPANY_SEARCH_SOURCES.includes(
      normalized as (typeof LEGACY_LINKEDIN_COMPANY_SEARCH_SOURCES)[number],
    )
  ) {
    return 'linkedin_company_search';
  }
  if (
    ORG_CHART_COMPANY_AUTOCOMPLETE_SOURCES.includes(
      normalized as OrgChartCompanyAutocompleteSource,
    )
  ) {
    return normalized as OrgChartCompanyAutocompleteSource;
  }
  return null;
};
