import {
    normalizeOrgChartCompanyAutocompleteSource,
    type OrgChartCompanyAutocompleteSource,
} from '../types/orgChartCompanyAutocompleteSource';

export const resolveOrgChartCompanyAutocompleteSource = (
  override?: string,
): OrgChartCompanyAutocompleteSource => {
  const fromOverride = override
    ? normalizeOrgChartCompanyAutocompleteSource(override)
    : null;
  if (fromOverride) {
    return fromOverride;
  }

  const fromEnv = process.env.REACT_APP_ORGCHART_COMPANY_AUTOCOMPLETE_SOURCE;
  const envSource = fromEnv
    ? normalizeOrgChartCompanyAutocompleteSource(fromEnv)
    : null;
  if (envSource) {
    return envSource;
  }

  return 'pdl';
};
