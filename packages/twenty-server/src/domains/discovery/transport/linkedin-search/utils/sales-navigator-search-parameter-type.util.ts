import { type LinkedInSearchParameterType } from '../types/linkedin-search-parameter.type';

// Unipile defaults service=CLASSIC; these facets need SALES_NAVIGATOR
const SALES_NAVIGATOR_SEARCH_PARAMETER_TYPES =
  new Set<LinkedInSearchParameterType>([
    'LEAD_LISTS',
    'ACCOUNT_LISTS',
    'SAVED_SEARCHES',
    'RECENT_SEARCHES',
    'SALES_INDUSTRY',
    'REGION',
    'PERSONA',
    'SAVED_ACCOUNTS',
  ]);

export const isSalesNavigatorSearchParameterType = (
  type: LinkedInSearchParameterType,
): boolean => SALES_NAVIGATOR_SEARCH_PARAMETER_TYPES.has(type);
