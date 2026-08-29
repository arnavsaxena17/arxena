import {
  type OutreachLinkedInCompanyProfile,
  type OutreachLinkedInCompanySearchHit,
  type OutreachWikiCompanyHit,
} from 'src/engine/core-modules/outreach-command/utils/outreach-workspace-profile-draft.util';

export type OutreachCompanyEnrichmentSourceId =
  | 'apollo'
  | 'companies_index_wiki'
  | 'wikidata'
  | 'linkedin_unipile_pool'
  | 'web_search'
  // Reserved for future providers (Clearbit, TheOrg, etc.)
  | (string & {});

export type OutreachWebSearchCompanySnapshot = {
  companyName: string;
  websiteUrl: string;
  summary: string;
  productsOrServices: string[];
  industry: string;
  hq: string;
  employeeHint: string;
  keyFacts: string[];
  sourceUrls: string[];
  notes: string;
};

export type OutreachCompanyEnrichmentSourceInput = {
  domain: string;
  workspaceDisplayName?: string | null;
  workspaceId?: string;
  // Prior source hints (name / LinkedIn URL) so later sources can refine
  hints?: {
    companyName?: string | null;
    linkedInUrl?: string | null;
  };
};

export type OutreachCompanyEnrichmentPartial = {
  sourceId: OutreachCompanyEnrichmentSourceId;
  apolloOrganization?: Record<string, unknown> | null;
  wikiCompany?: OutreachWikiCompanyHit | null;
  wikidataCompany?: OutreachWikiCompanyHit | null;
  linkedInSearchHit?: OutreachLinkedInCompanySearchHit | null;
  linkedInCompanyProfile?: OutreachLinkedInCompanyProfile | null;
  webSearchCompany?: OutreachWebSearchCompanySnapshot | null;
  // Shared Unipile account used by LinkedIn pool source (person enrich reuses it)
  linkedInAccountId?: string;
};

export type OutreachCompanyEnrichmentSource = {
  readonly sourceId: OutreachCompanyEnrichmentSourceId;
  enrich(
    input: OutreachCompanyEnrichmentSourceInput,
  ): Promise<OutreachCompanyEnrichmentPartial | null>;
};

export type OutreachCollectedCompanyEnrichment = {
  apolloOrganization: Record<string, unknown> | null;
  wikiCompany: OutreachWikiCompanyHit | null;
  wikidataCompany: OutreachWikiCompanyHit | null;
  linkedInSearchHit: OutreachLinkedInCompanySearchHit | null;
  linkedInCompanyProfile: OutreachLinkedInCompanyProfile | null;
  webSearchCompany: OutreachWebSearchCompanySnapshot | null;
  linkedInAccountId?: string;
  sourceIds: OutreachCompanyEnrichmentSourceId[];
};
