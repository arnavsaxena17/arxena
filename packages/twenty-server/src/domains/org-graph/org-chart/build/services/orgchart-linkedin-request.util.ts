import { hasMeaningfulOrgChartFunctionRootFilter } from 'src/domains/org-graph/org-chart/utils/orgchart-filter.util';
import { hasOrgChartLinkedInSubsetScopeFilter } from 'src/domains/org-graph/org-chart/utils/orgchart-linkedin-scope.util';

import {
  type OrgchartLinkedInRequestOptions,
  type OrgchartNormalisedRequest,
  type OrgchartRequestFilters,
} from 'src/domains/org-graph/org-chart/build/types/orgchart-linkedin-search.types';

// Two steps, because the business-division LLM can narrow the country and the
// function: parse first, then derive the scope flags from the final values.
// Both entry points do it this way, so the run and the estimate cannot disagree
// about whether a request is narrowed.

export const normalizeOrgchartLinkedInRequest = (
  options: OrgchartLinkedInRequestOptions | undefined,
): OrgchartNormalisedRequest => {
  const rawCountryFromOptions = options?.country?.trim() || '';
  const rawFunctionFromOptions = options?.functionRoot?.trim() || '';
  // 'global' is the same as no country at all
  const country =
    rawCountryFromOptions.toLowerCase() === 'global'
      ? ''
      : rawCountryFromOptions;
  const linkedinLocationName = options?.linkedinLocationName?.trim() || '';
  const linkedinCompanyParameterIds = (
    options?.linkedinCompanyParameterIds?.length
      ? options.linkedinCompanyParameterIds
      : options?.linkedinCompanyParameterId
        ? [options.linkedinCompanyParameterId]
        : []
  )
    .map((id) => id.trim())
    .filter(Boolean);

  return {
    mode: options?.mode,
    primaryCompanyName: options?.companyName?.trim() || '',
    primaryCompanyId: options?.companyId?.trim() || '',
    companyNames:
      options?.companyNames?.map((name) => name.trim()).filter(Boolean) ?? [],
    rawCountryFromOptions,
    rawFunctionFromOptions,
    // A named location stands in for a country when none was given
    country: !country && linkedinLocationName ? linkedinLocationName : country,
    functionRoot: rawFunctionFromOptions,
    linkedinLocationId: options?.linkedinLocationId?.trim() || '',
    linkedinLocationName,
    linkedinCompanyParameterIds,
    businessDivisionRaw: options?.businessDivisionRawQuery?.trim(),
  };
};

export const deriveOrgchartRequestFilters = (
  request: OrgchartNormalisedRequest,
  input: {
    searchType: 'classic' | 'sales_navigator' | 'recruiter';
    // After the business-division step, which may have narrowed either
    country: string;
    functionRoot: string;
    leadershipOnly?: boolean;
  },
): OrgchartRequestFilters => {
  const hasAdditionalFilters =
    !!input.country ||
    hasMeaningfulOrgChartFunctionRootFilter(input.functionRoot) ||
    !!request.linkedinLocationId ||
    input.leadershipOnly === true;

  return {
    hasAdditionalFilters,
    hasSubsetScopeFilters: hasOrgChartLinkedInSubsetScopeFilter(
      input.country,
      input.functionRoot,
      request.linkedinLocationId,
      input.leadershipOnly,
    ),
    // Everyone in a company is a classic entire-company search nobody
    // narrowed, and not a business-division query
    isAllPeopleInCompanyMode:
      input.searchType === 'classic' &&
      !!request.primaryCompanyName &&
      request.mode === 'entire_company' &&
      !hasAdditionalFilters &&
      !request.businessDivisionRaw,
  };
};
