export type OrgChartCompanyAutocompleteSource =
  | 'pdl'
  | 'arxena'
  | 'linkedin_parameters'
  | 'linkedin_company_search';

export type OrgChartLinkedInCompanySearchApi = 'classic' | 'sales_navigator';

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

export const resolveOrgChartCompanyAutocompleteSource = (
  override?: string,
): OrgChartCompanyAutocompleteSource => {
  const raw =
    override?.trim() ||
    process.env.ORG_CHART_COMPANY_AUTOCOMPLETE_SOURCE?.trim() ||
    'pdl';
  const normalized = raw.toLowerCase().replace(/-/g, '_');

  if (
    LEGACY_LINKEDIN_COMPANY_SEARCH_SOURCES.includes(
      normalized as (typeof LEGACY_LINKEDIN_COMPANY_SEARCH_SOURCES)[number],
    )
  ) {
    return 'linkedin_company_search';
  }

  if (normalized === 'linkedin_company_search') {
    return 'linkedin_company_search';
  }

  if (
    ORG_CHART_COMPANY_AUTOCOMPLETE_SOURCES.includes(
      normalized as OrgChartCompanyAutocompleteSource,
    )
  ) {
    return normalized as OrgChartCompanyAutocompleteSource;
  }

  return 'pdl';
};

export const resolveOrgChartLinkedInCompanySearchApi = (
  override?: string,
): OrgChartLinkedInCompanySearchApi => {
  const raw =
    override?.trim() ||
    process.env.ORG_CHART_LINKEDIN_COMPANY_SEARCH_API?.trim() ||
    'sales_navigator';
  const normalized = raw.toLowerCase().replace(/-/g, '_');

  if (normalized === 'classic') {
    return 'classic';
  }

  return 'sales_navigator';
};

export const isLinkedInCompanyAutocompleteSource = (
  source: OrgChartCompanyAutocompleteSource,
): boolean =>
  source === 'linkedin_parameters' || source === 'linkedin_company_search';
