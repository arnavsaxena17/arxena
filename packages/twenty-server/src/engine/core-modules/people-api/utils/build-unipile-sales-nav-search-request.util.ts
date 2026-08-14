import type { LinkedInSeniorityType } from 'src/engine/core-modules/linkedin-search/types/linkedin-search-parameter.type';

export type UnipileSalesNavSearchRequest = {
  keywords?: string;
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
  companyParameterIds: string[];
  primaryCompanyName: string;
  country?: string;
  functionIds: string[];
  seniorities: LinkedInSeniorityType[];
}): UnipileSalesNavSearchRequest => {
  const omitKeywords = shouldOmitSalesNavKeywords({
    functionIds: input.functionIds,
    seniorities: input.seniorities,
  });

  const keywordParts: string[] = [];
  if (!omitKeywords && input.keywords?.trim()) {
    keywordParts.push(input.keywords.trim());
  }
  if (
    !omitKeywords &&
    input.companyParameterIds.length === 0 &&
    input.primaryCompanyName.trim()
  ) {
    keywordParts.push(`"${input.primaryCompanyName.trim()}"`);
  }
  if (
    !omitKeywords &&
    input.country?.trim() &&
    input.country.trim().toLowerCase() !== 'global'
  ) {
    keywordParts.push(input.country.trim());
  }

  return {
    ...(keywordParts.length > 0
      ? { keywords: keywordParts.join(' AND ') }
      : {}),
    ...(input.companyParameterIds.length > 0
      ? { company: { include: input.companyParameterIds } }
      : {}),
    ...(input.functionIds.length > 0
      ? { function: { include: input.functionIds } }
      : {}),
    ...(input.seniorities.length > 0
      ? { seniority: { include: input.seniorities } }
      : {}),
  };
};
