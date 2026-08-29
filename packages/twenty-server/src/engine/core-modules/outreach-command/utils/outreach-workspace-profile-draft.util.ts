import { isNonEmptyString } from '@sniptt/guards';

import {
  EMPTY_ICP_SPEC,
  normalizeIcpSpec,
  type IcpSpec,
} from 'src/engine/core-modules/outreach-command/utils/outreach-icp-spec.util';

export type { IcpSpec };

export type OutreachSellerCompanyDraft = {
  companyName: string;
  companyDomain: string;
  industry: string;
  summary: string;
  employeeRange: string;
  hq: string;
};

export type OutreachWorkspaceProfileDraft = OutreachSellerCompanyDraft & {
  icpSpec: IcpSpec;
  enrichmentJson: Record<string, unknown>;
};

export type OutreachWikiCompanyHit = {
  id?: string;
  name?: string;
  website?: string;
  industry?: string;
  country?: string;
  locality?: string;
  linkedin_url?: string;
  size?: string;
  founded?: string;
};

export type OutreachLinkedInCompanyProfile = {
  id?: string;
  public_identifier?: string;
  name?: string;
  description?: string;
  tagline?: string;
  website?: string;
  profile_url?: string;
  employee_count?: number;
  industry?: string[];
  locations?: Array<{
    city?: string;
    country?: string;
    area?: string;
    is_headquarter?: boolean;
  }>;
};

export type OutreachLinkedInCompanySearchHit = {
  id?: string;
  name?: string;
  profile_url?: string;
  industry?: string;
  headcount?: string;
  location?: string | null;
  summary?: string | null;
};

const titleCaseFromDomain = (domain: string): string => {
  const root = domain.split('.')[0] ?? domain;

  return root
    .split(/[-_]/)
    .filter(isNonEmptyString)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const formatEmployeeRange = (
  min?: number | null,
  max?: number | null,
): string => {
  if (isDefinedNumber(min) && isDefinedNumber(max)) {
    return `${min}-${max}`;
  }

  if (isDefinedNumber(min)) {
    return `${min}+`;
  }

  return '';
};

const isDefinedNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const formatHqFromLinkedInLocations = (
  locations?: OutreachLinkedInCompanyProfile['locations'],
): string => {
  if (!Array.isArray(locations) || locations.length === 0) {
    return '';
  }

  const headquarters =
    locations.find((location) => location.is_headquarter === true) ??
    locations[0];

  return [headquarters?.city, headquarters?.area, headquarters?.country]
    .filter(isNonEmptyString)
    .join(', ');
};

const pickIndustry = (input: {
  linkedInProfile?: OutreachLinkedInCompanyProfile | null;
  linkedInSearchHit?: OutreachLinkedInCompanySearchHit | null;
  wikiCompany?: OutreachWikiCompanyHit | null;
  apolloOrganization?: Record<string, unknown> | null;
}): string => {
  if (isNonEmptyString(input.wikiCompany?.industry)) {
    return input.wikiCompany.industry.trim();
  }

  const linkedInIndustry = input.linkedInProfile?.industry?.find(
    isNonEmptyString,
  );
  if (isNonEmptyString(linkedInIndustry)) {
    return linkedInIndustry;
  }

  if (isNonEmptyString(input.linkedInSearchHit?.industry)) {
    return input.linkedInSearchHit.industry.trim();
  }

  const apollo = input.apolloOrganization;
  if (typeof apollo?.industry === 'string' && apollo.industry.trim()) {
    return apollo.industry.trim();
  }

  if (
    Array.isArray(apollo?.industries) &&
    typeof apollo.industries[0] === 'string'
  ) {
    return apollo.industries[0].trim();
  }

  return '';
};

const pickEmployeeRange = (input: {
  linkedInProfile?: OutreachLinkedInCompanyProfile | null;
  linkedInSearchHit?: OutreachLinkedInCompanySearchHit | null;
  wikiCompany?: OutreachWikiCompanyHit | null;
  apolloOrganization?: Record<string, unknown> | null;
}): string => {
  if (isNonEmptyString(input.wikiCompany?.size)) {
    return input.wikiCompany.size.trim();
  }

  if (isDefinedNumber(input.linkedInProfile?.employee_count)) {
    return formatEmployeeRange(input.linkedInProfile.employee_count, null);
  }

  if (isNonEmptyString(input.linkedInSearchHit?.headcount)) {
    return input.linkedInSearchHit.headcount.trim();
  }

  const apollo = input.apolloOrganization;
  if (typeof apollo?.estimated_num_employees === 'number') {
    return formatEmployeeRange(apollo.estimated_num_employees, null);
  }

  return '';
};

const pickHq = (input: {
  linkedInProfile?: OutreachLinkedInCompanyProfile | null;
  linkedInSearchHit?: OutreachLinkedInCompanySearchHit | null;
  wikiCompany?: OutreachWikiCompanyHit | null;
  apolloOrganization?: Record<string, unknown> | null;
}): string => {
  const wikiHq = [input.wikiCompany?.locality, input.wikiCompany?.country]
    .filter(isNonEmptyString)
    .join(', ');
  if (isNonEmptyString(wikiHq)) {
    return wikiHq;
  }

  const linkedInHq = formatHqFromLinkedInLocations(
    input.linkedInProfile?.locations,
  );
  if (isNonEmptyString(linkedInHq)) {
    return linkedInHq;
  }

  if (isNonEmptyString(input.linkedInSearchHit?.location)) {
    return input.linkedInSearchHit.location.trim();
  }

  const apollo = input.apolloOrganization;
  return [
    typeof apollo?.city === 'string' ? apollo.city : null,
    typeof apollo?.state === 'string' ? apollo.state : null,
    typeof apollo?.country === 'string' ? apollo.country : null,
  ]
    .filter(isNonEmptyString)
    .join(', ');
};

const pickCompanyName = (input: {
  domain: string;
  workspaceDisplayName?: string | null;
  linkedInProfile?: OutreachLinkedInCompanyProfile | null;
  linkedInSearchHit?: OutreachLinkedInCompanySearchHit | null;
  wikiCompany?: OutreachWikiCompanyHit | null;
  apolloOrganization?: Record<string, unknown> | null;
}): string => {
  if (isNonEmptyString(input.wikiCompany?.name)) {
    return input.wikiCompany.name.trim();
  }

  if (isNonEmptyString(input.linkedInProfile?.name)) {
    return input.linkedInProfile.name.trim();
  }

  if (isNonEmptyString(input.linkedInSearchHit?.name)) {
    return input.linkedInSearchHit.name.trim();
  }

  const apolloName =
    typeof input.apolloOrganization?.name === 'string'
      ? input.apolloOrganization.name.trim()
      : '';
  if (isNonEmptyString(apolloName)) {
    return apolloName;
  }

  return (
    input.workspaceDisplayName?.trim() || titleCaseFromDomain(input.domain)
  );
};

const pickSummary = (input: {
  companyName: string;
  domain: string;
  industry: string;
  employeeRange: string;
  linkedInProfile?: OutreachLinkedInCompanyProfile | null;
  linkedInSearchHit?: OutreachLinkedInCompanySearchHit | null;
}): string => {
  if (isNonEmptyString(input.linkedInProfile?.description)) {
    return input.linkedInProfile.description.trim().slice(0, 2000);
  }

  if (isNonEmptyString(input.linkedInProfile?.tagline)) {
    return input.linkedInProfile.tagline.trim();
  }

  if (isNonEmptyString(input.linkedInSearchHit?.summary)) {
    return input.linkedInSearchHit.summary.trim();
  }

  const facts = [
    input.industry || null,
    input.employeeRange ? `~${input.employeeRange} employees` : null,
  ].filter(isNonEmptyString);

  return facts.length > 0
    ? `${input.companyName} (${input.domain}) — ${facts.join(', ')}.`
    : `${input.companyName} (${input.domain}).`;
};

const resolveEnrichmentSource = (input: {
  linkedInProfile?: OutreachLinkedInCompanyProfile | null;
  linkedInSearchHit?: OutreachLinkedInCompanySearchHit | null;
  wikiCompany?: OutreachWikiCompanyHit | null;
  wikidataCompany?: OutreachWikiCompanyHit | null;
  apolloOrganization?: Record<string, unknown> | null;
  webSearchCompany?: {
    companyName: string;
    summary: string;
  } | null;
  llmCompanyProfile?: {
    companyName: string;
    industry?: string;
    summary: string;
    employeeRange?: string;
    hq?: string;
  } | null;
}): string => {
  if (input.llmCompanyProfile) {
    return 'llm_multi_source_summary';
  }

  if (input.wikiCompany) {
    return 'companies_index_wiki';
  }

  if (input.linkedInProfile) {
    return 'linkedin_company_profile';
  }

  if (input.linkedInSearchHit) {
    return 'linkedin_sales_navigator';
  }

  if (input.webSearchCompany) {
    return 'web_search';
  }

  if (input.wikidataCompany) {
    return 'wikidata';
  }

  if (input.apolloOrganization) {
    return 'apollo';
  }

  return 'domain_heuristic';
};

export const buildOutreachWorkspaceProfileDraftFromDomain = (input: {
  domain: string;
  workspaceDisplayName?: string | null;
  apolloOrganization?: Record<string, unknown> | null;
  wikiCompany?: OutreachWikiCompanyHit | null;
  wikidataCompany?: OutreachWikiCompanyHit | null;
  linkedInSearchHit?: OutreachLinkedInCompanySearchHit | null;
  linkedInCompanyProfile?: OutreachLinkedInCompanyProfile | null;
  webSearchCompany?: {
    companyName: string;
    websiteUrl?: string;
    summary: string;
    productsOrServices?: string[];
    industry?: string;
    hq?: string;
    employeeHint?: string;
    keyFacts?: string[];
    sourceUrls?: string[];
    notes?: string;
  } | null;
  llmCompanyProfile?: {
    companyName: string;
    industry?: string;
    summary: string;
    employeeRange?: string;
    hq?: string;
    notes?: string;
  } | null;
  llmIcp?: IcpSpec | null;
}): OutreachWorkspaceProfileDraft => {
  const domain = input.domain.trim().toLowerCase();
  const apollo = input.apolloOrganization ?? null;
  const wikiCompany = input.wikiCompany ?? null;
  const wikidataCompany = input.wikidataCompany ?? null;
  const linkedInSearchHit = input.linkedInSearchHit ?? null;
  const linkedInProfile = input.linkedInCompanyProfile ?? null;
  const webSearchCompany = input.webSearchCompany ?? null;
  const llmCompanyProfile = input.llmCompanyProfile ?? null;

  // Prefer companies ES (free_company_dataset) over Wikidata for heuristic merge
  const wikiForHeuristics = wikiCompany ?? wikidataCompany;

  const companyName = isNonEmptyString(llmCompanyProfile?.companyName)
    ? llmCompanyProfile.companyName.trim()
    : isNonEmptyString(webSearchCompany?.companyName)
      ? webSearchCompany.companyName.trim()
      : pickCompanyName({
          domain,
          workspaceDisplayName: input.workspaceDisplayName,
          linkedInProfile,
          linkedInSearchHit,
          wikiCompany: wikiForHeuristics,
          apolloOrganization: apollo,
        });
  const industry = isNonEmptyString(llmCompanyProfile?.industry)
    ? llmCompanyProfile.industry.trim()
    : isNonEmptyString(webSearchCompany?.industry)
      ? webSearchCompany.industry.trim()
      : pickIndustry({
          linkedInProfile,
          linkedInSearchHit,
          wikiCompany: wikiForHeuristics,
          apolloOrganization: apollo,
        });
  const employeeRange = isNonEmptyString(llmCompanyProfile?.employeeRange)
    ? llmCompanyProfile.employeeRange.trim()
    : isNonEmptyString(webSearchCompany?.employeeHint)
      ? webSearchCompany.employeeHint.trim()
      : pickEmployeeRange({
          linkedInProfile,
          linkedInSearchHit,
          wikiCompany: wikiForHeuristics,
          apolloOrganization: apollo,
        });
  const hq = isNonEmptyString(llmCompanyProfile?.hq)
    ? llmCompanyProfile.hq.trim()
    : isNonEmptyString(webSearchCompany?.hq)
      ? webSearchCompany.hq.trim()
      : pickHq({
          linkedInProfile,
          linkedInSearchHit,
          wikiCompany: wikiForHeuristics,
          apolloOrganization: apollo,
        });
  const summary = isNonEmptyString(llmCompanyProfile?.summary)
    ? llmCompanyProfile.summary.trim().slice(0, 2000)
    : isNonEmptyString(webSearchCompany?.summary)
      ? webSearchCompany.summary.trim().slice(0, 2000)
      : pickSummary({
          companyName,
          domain,
          industry,
          employeeRange,
          linkedInProfile,
          linkedInSearchHit,
        });

  const icpSpec = normalizeIcpSpec(
    input.llmIcp ?? EMPTY_ICP_SPEC,
  );

  const enrichmentSource = resolveEnrichmentSource({
    linkedInProfile,
    linkedInSearchHit,
    wikiCompany,
    wikidataCompany,
    apolloOrganization: apollo,
    webSearchCompany,
    llmCompanyProfile,
  });

  return {
    companyName,
    companyDomain: domain,
    industry,
    summary,
    employeeRange,
    hq,
    icpSpec,
    enrichmentJson: {
      source: enrichmentSource,
      domain,
      draftedAt: new Date().toISOString(),
      llmCompanyProfile,
      webSearchCompany,
      companyDetails: {
        linkedInCompanyProfile: linkedInProfile,
        linkedInSearchHit,
        wikidataCompany,
        wikiCompany,
        apolloOrganization: apollo,
        webSearchCompany,
      },
    },
  };
};

export const pickFirstApolloOrganization = (
  searchResult: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null => {
  if (!searchResult) {
    return null;
  }

  const organizations = searchResult.organizations;
  const accounts = searchResult.accounts;

  if (Array.isArray(organizations) && organizations[0]) {
    return organizations[0] as Record<string, unknown>;
  }

  if (Array.isArray(accounts) && accounts[0]) {
    return accounts[0] as Record<string, unknown>;
  }

  return null;
};

export const pickBestWikiCompanyHit = (
  items: OutreachWikiCompanyHit[],
  domain: string,
): OutreachWikiCompanyHit | null => {
  if (items.length === 0) {
    return null;
  }

  const normalizedDomain = domain.trim().toLowerCase();
  const exactWebsiteMatch = items.find((item) => {
    const website = item.website?.trim().toLowerCase() ?? '';
    return (
      website === normalizedDomain ||
      website === `www.${normalizedDomain}` ||
      website.endsWith(`.${normalizedDomain}`) ||
      website.includes(normalizedDomain)
    );
  });

  return exactWebsiteMatch ?? items[0] ?? null;
};
