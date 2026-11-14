export type BuiltWithTechnology = {
  name: string;
  slug: string;
  trendCategory: string;
  description: string | null;
  tags: string[];
};

export type BuiltWithTechnologyCategory = {
  category: string;
  technologies: BuiltWithTechnology[];
};

export type BuiltWithDetailedTechnology = {
  category: string;
  name: string;
  slug: string;
  trendCategory: string;
  firstDetected: string | null;
  lastDetected: string | null;
  isHistorical: boolean;
  dataTypes: string[];
};

export type BuiltWithAiIndex = {
  score: string | null;
  label: string | null;
};

export type BuiltWithProfileMeta = {
  liveTechnologiesCount: number | null;
  lastTechnologyDetected: string | null;
  siteAgeLabel: string | null;
  topSiteRank: number | null;
  aiIndex: BuiltWithAiIndex;
  technologySpend: string | null;
};

export type BuiltWithDomainResult = {
  domain: string;
  profileUrl: string;
  detailedUrl: string;
  title: string | null;
  meta: BuiltWithProfileMeta;
  categories: BuiltWithTechnologyCategory[];
  detailedTechnologies: BuiltWithDetailedTechnology[];
  fetchedAt: string;
  errors: string[];
};

export type BuiltWithBatchResult = {
  fetchedAt: string;
  domains: string[];
  results: BuiltWithDomainResult[];
};
