import {
  type GtmLinkedInCompanyProfile,
  type GtmLinkedInCompanySearchHit,
  type GtmWikiCompanyHit,
} from 'src/engine/core-modules/gtm-command/utils/gtm-workspace-profile-draft.util';

export type GtmCompanyEnrichmentSourceId =
  | 'apollo'
  | 'companies_index_wiki'
  | 'wikidata'
  | 'linkedin_unipile_pool'
  | 'web_search'
  // Reserved for future providers (Clearbit, TheOrg, etc.)
  | (string & {});

export type GtmWebSearchCompanySnapshot = {
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

export type GtmCompanyEnrichmentSourceInput = {
  domain: string;
  workspaceDisplayName?: string | null;
  workspaceId?: string;
  // Prior source hints (name / LinkedIn URL) so later sources can refine
  hints?: {
    companyName?: string | null;
    linkedInUrl?: string | null;
  };
};

export type GtmCompanyEnrichmentPartial = {
  sourceId: GtmCompanyEnrichmentSourceId;
  apolloOrganization?: Record<string, unknown> | null;
  wikiCompany?: GtmWikiCompanyHit | null;
  wikidataCompany?: GtmWikiCompanyHit | null;
  linkedInSearchHit?: GtmLinkedInCompanySearchHit | null;
  linkedInCompanyProfile?: GtmLinkedInCompanyProfile | null;
  webSearchCompany?: GtmWebSearchCompanySnapshot | null;
  // Shared Unipile account used by LinkedIn pool source (person enrich reuses it)
  linkedInAccountId?: string;
};

export type GtmCompanyEnrichmentSource = {
  readonly sourceId: GtmCompanyEnrichmentSourceId;
  enrich(
    input: GtmCompanyEnrichmentSourceInput,
  ): Promise<GtmCompanyEnrichmentPartial | null>;
};

export type GtmCollectedCompanyEnrichment = {
  apolloOrganization: Record<string, unknown> | null;
  wikiCompany: GtmWikiCompanyHit | null;
  wikidataCompany: GtmWikiCompanyHit | null;
  linkedInSearchHit: GtmLinkedInCompanySearchHit | null;
  linkedInCompanyProfile: GtmLinkedInCompanyProfile | null;
  webSearchCompany: GtmWebSearchCompanySnapshot | null;
  linkedInAccountId?: string;
  sourceIds: GtmCompanyEnrichmentSourceId[];
};
