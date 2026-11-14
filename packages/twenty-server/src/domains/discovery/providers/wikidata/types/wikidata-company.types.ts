export type WikidataCompanyHeadquarters = {
  city: string | null;
  stateOrRegion: string | null;
  country: string | null;
  label: string | null;
};

export type WikidataCompanyKeyExecutives = {
  ceo: string | null;
  chairmanOfTheBoard: string | null;
};

export type WikidataCompanyStockListing = {
  exchange: string | null;
  tickerSymbol: string | null;
};

export type WikidataCompanyDataSources = {
  wikidata: string;
  wikipedia: string | null;
};

export type WikidataCompanyProfile = {
  wikidataId: string;
  companyDomain: string;
  companyName: string;
  legalName: string | null;
  website: string | null;
  description: string | null;
  industry: string | null;
  industries: string[];
  foundedYear: number | null;
  inceptionDate: string | null;
  headquarters: WikidataCompanyHeadquarters | null;
  employeeCount: number | null;
  keyExecutives: WikidataCompanyKeyExecutives;
  stockListing: WikidataCompanyStockListing | null;
  legalForm: string | null;
  entityTypes: string[];
  country: string | null;
  dataSources: WikidataCompanyDataSources;
  matchScore: number;
  matchReason: string;
};

export type WikidataCompanySearchResult = {
  query: {
    input: string;
    normalizedDomain: string | null;
    websiteUrlVariants: string[];
  };
  companies: WikidataCompanyProfile[];
  candidateCount: number;
};

export type WikidataEntityClaimSnak = {
  snaktype?: string;
  property?: string;
  datavalue?: {
    type?: string;
    value?:
      | string
      | number
      | {
          id?: string;
          'numeric-id'?: number;
          'entity-type'?: string;
          time?: string;
          amount?: string;
          text?: string;
          language?: string;
        };
  };
};

export type WikidataEntityClaim = {
  mainsnak?: WikidataEntityClaimSnak;
  qualifiers?: Record<string, WikidataEntityClaimSnak[]>;
};

export type WikidataEntity = {
  id: string;
  labels?: Record<string, { language: string; value: string }>;
  descriptions?: Record<string, { language: string; value: string }>;
  claims?: Record<string, WikidataEntityClaim[]>;
  sitelinks?: Record<string, { site: string; title: string; url?: string }>;
};
