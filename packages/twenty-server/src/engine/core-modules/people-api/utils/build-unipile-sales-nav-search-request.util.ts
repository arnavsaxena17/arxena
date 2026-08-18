import type { LinkedInAdvancedKeywordsFilter } from 'src/engine/core-modules/linkedin-search/types/linkedin-search-request.type';
import type { LinkedInSeniorityType } from 'src/engine/core-modules/linkedin-search/types/linkedin-search-parameter.type';

export type UnipileSalesNavSearchRequest = {
  keywords?: string;
  advanced_keywords?: LinkedInAdvancedKeywordsFilter;
  company?: { include: string[] };
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
  const omitGeneratedText =
    !input.includeManualLinkedInQuery &&
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

  const jobTitle = input.jobTitle?.trim();
  const omitFunctionAndSeniorityFacets =
    !!input.includeManualLinkedInQuery &&
    (!!jobTitle || keywordParts.length > 0);

  return {
    ...(keywordParts.length > 0
      ? { keywords: keywordParts.join(' AND ') }
      : {}),
    ...(jobTitle
      ? {
          advanced_keywords: {
            title: jobTitle,
          },
        }
      : {}),
    ...(input.companyParameterIds.length > 0
      ? { company: { include: input.companyParameterIds } }
      : {}),
    ...(!omitFunctionAndSeniorityFacets && input.functionIds.length > 0
      ? { function: { include: input.functionIds } }
      : {}),
    ...(!omitFunctionAndSeniorityFacets && input.seniorities.length > 0
      ? { seniority: { include: input.seniorities } }
      : {}),
  };
};
