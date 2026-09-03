import type { PeopleDataSourceAlias } from './constants/people-data-source-aliases';
import type { TaxonomyConstantItem } from './constants/taxonomy-constants';
import type { PeopleCompanyScopeResolvedVia } from './services/people-company-scope.resolver';
import type { PeopleLocationScopeResolvedVia } from './services/people-location-scope.resolver';
import type { TaxonomyTreeRootNode } from './utils/build-taxonomy-tree.util';

export type TaxonomyItem = {
  id: string;
  label: string;
  name: string;
  parent_id: string | null;
  level: string | number | null;
};

export type PeopleSearchResultItem = Record<string, unknown>;

export type PeopleSearchLinkedInCompany = {
  name: string | null;
  slug: string | null;
  linkedinUrl: string | null;
  website?: string | null;
  id?: string | null;
  ids?: string[];
  resolvedVia?: PeopleCompanyScopeResolvedVia;
};

export type PeopleSearchLinkedInLocation = {
  raw: string | null;
  linkedinId: string | null;
  title: string | null;
  resolvedVia?: PeopleLocationScopeResolvedVia;
};

export type PeopleSearchQueryMeta = {
  searchUrl?: string | null;
  keywords?: string | null;
  jobTitle?: string | null;
  company?: PeopleSearchLinkedInCompany;
  location?: PeopleSearchLinkedInLocation;
  stdFunction?: string;
  stdFunctionRoot?: string;
  stdGrade?: string;
  appliedFilters?: {
    functionIds?: string[];
    seniorities?: string[];
    locationIds?: string[];
    person_department_or_subdepartments?: string[];
    person_seniorities?: string[];
  };
};

export type PeopleSearchResolvedCandidate = PeopleSearchResultItem & {
  resolved: {
    stdFunction: string | null;
    stdFunctionRoot: string | null;
    stdGrade: string | null;
    confidence: number;
  };
};

export type ResolvedTitleTaxonomy = {
  jobTitle: string;
  normalizedTitle: string | null;
  stdFunction: string | null;
  stdFunctionRoot: string | null;
  stdGrade: string | null;
  confidence: number;
  locations: string[];
};

export type PeopleSearchResponse = {
  status: 'ok';
  dataSource: PeopleDataSourceAlias;
  total: number;
  items: PeopleSearchResultItem[];
  // Present when LinkedIn sourcing ran taxonomy post-filter
  query?: PeopleSearchQueryMeta;
  totalBeforeFilter?: number;
  // Present when naturalLanguage (or search-by-title) classified a role
  resolved?: ResolvedTitleTaxonomy;
};

export type PeopleSearchByTitleResponse = PeopleSearchResponse & {
  resolved: ResolvedTitleTaxonomy;
};

export type PeopleSearchByTaxonomyResponse = {
  status: 'ok';
  dataSource: 'harvest' | 'unipile' | 'pool';
  query: {
    keywords: string | null;
    jobTitle?: string | null;
    company: PeopleSearchLinkedInCompany;
    location?: PeopleSearchLinkedInLocation;
    stdFunction?: string;
    stdFunctionRoot?: string;
    stdGrade?: string;
    appliedFilters?: PeopleSearchQueryMeta['appliedFilters'];
  };
  total: number;
  totalBeforeFilter: number;
  items: PeopleSearchResolvedCandidate[];
};

export type DataSourcesStatusResponse = {
  status: 'ok';
  sources: Array<{
    alias: PeopleDataSourceAlias;
    label: string;
    description: string;
    supportsStdFunctionFilter: boolean;
    supportsStdGradeFilter: boolean;
    configured: boolean;
  }>;
};

export type ExpandJobTitlesResponse = {
  status: 'ok';
  jobTitle: string;
  normalizedTitle: string | null;
  stdFunction: string | null;
  stdFunctionRoot: string | null;
  stdGrade: string | null;
  confidence: number;
  booleanQuery: string | null;
  keywordGroups: Array<{
    type?: string;
    terms?: string[];
    clause?: string;
  }>;
};

export type TaxonomyBooleanStringsResponse = {
  status: 'ok';
  query: string;
  booleanQuery: string | null;
  keywordGroups: Array<{
    type?: string;
    terms?: string[];
    clause?: string;
  }>;
};

export type TaxonomyManualBooleanQueryItem = {
  kind: string;
  label: string;
  stdGrade: string;
  booleanQuery: string;
  keywords: string;
};

export type TaxonomyManualBooleanQueriesResponse = {
  status: 'ok';
  found: boolean;
  count: number;
  items: TaxonomyManualBooleanQueryItem[];
};

export type TaxonomyTreeResponse = {
  status: 'ok';
  gradeLevels: TaxonomyConstantItem[];
  functionRoots: TaxonomyTreeRootNode[];
};

export type TaxonomySliceResponse = {
  status: 'ok';
  function_root: string;
  functions: TaxonomyItem[];
  grades: TaxonomyItem[];
};

export type TaxonomyLlmClassification = {
  title?: string;
  profile?: string | null;
  job_title_normalized?: string;
  function_root: string;
  std_function_root: string;
  std_function: string;
  std_grade: string;
  std_grade_category: string;
  grade_level: string;
  function_root_confidence: number;
  std_function_confidence: number;
  std_grade_confidence: number;
  source: 'llm';
};

export type TaxonomyClassifyLlmResponse = {
  status: 'ok';
  classifications: TaxonomyLlmClassification[];
};
