import type { LinkedInRoleFilter } from 'src/engine/core-modules/linkedin-search/types/linkedin-search-request.type';
import type { LinkedInSeniorityType } from 'src/engine/core-modules/linkedin-search/types/linkedin-search-parameter.type';

export type UnipileSalesNavSearchRequest = {
  keywords?: string;
  role?: LinkedInRoleFilter;
  current_job_title?: LinkedInRoleFilter;
  company?: { include: string[] };
  current_company?: { include: string[] };
  function?: { include: string[] };
  seniority?: { include: LinkedInSeniorityType[] };
};

export const shouldOmitSalesNavKeywords = (args: {
  functionIds: string[];
  seniorities: LinkedInSeniorityType[];
}): boolean =>
  args.functionIds.length > 0 || args.seniorities.length > 0;

export const buildUnipileSalesNavSearchRequest = (input: {
  keywords?: string;
  jobTitle?: string;
  companyParameterIds: string[];
  primaryCompanyName: string;
  country?: string;
  functionIds: string[];
  seniorities: LinkedInSeniorityType[];
  includeManualLinkedInQuery?: boolean;
}): UnipileSalesNavSearchRequest => {
  const jobTitle = input.jobTitle?.trim();
  const hasBooleanTitleOrManualQuery =
    !!jobTitle || !!input.includeManualLinkedInQuery;
  const omitGeneratedText =
    !hasBooleanTitleOrManualQuery &&
    shouldOmitSalesNavKeywords({
      functionIds: input.functionIds,
      seniorities: input.seniorities,
    });

  const keywordParts: string[] = [];
  if (!omitGeneratedText && input.keywords?.trim()) {
    keywordParts.push(input.keywords.trim());
  }
  if (
    !omitGeneratedText &&
    !input.includeManualLinkedInQuery &&
    input.companyParameterIds.length === 0 &&
    input.primaryCompanyName.trim()
  ) {
    keywordParts.push(`"${input.primaryCompanyName.trim()}"`);
  }
  if (
    !omitGeneratedText &&
    !input.includeManualLinkedInQuery &&
    input.country?.trim() &&
    input.country.trim().toLowerCase() !== 'global'
  ) {
    keywordParts.push(input.country.trim());
  }

  const omitFunctionAndSeniorityFacets =
    !!jobTitle ||
    (!!input.includeManualLinkedInQuery && keywordParts.length > 0);

  return {
    ...(keywordParts.length > 0
      ? { keywords: keywordParts.join(' AND ') }
      : {}),
    ...(jobTitle
      ? {
          role: {
            include: [jobTitle],
          },
          current_job_title: {
            include: [jobTitle],
          },
        }
      : {}),
    ...(input.companyParameterIds.length > 0
      ? {
          company: { include: input.companyParameterIds },
          current_company: { include: input.companyParameterIds },
        }
      : {}),
    ...(!omitFunctionAndSeniorityFacets && input.functionIds.length > 0
      ? { function: { include: input.functionIds } }
      : {}),
    ...(!omitFunctionAndSeniorityFacets && input.seniorities.length > 0
      ? { seniority: { include: input.seniorities } }
      : {}),
  };
};
