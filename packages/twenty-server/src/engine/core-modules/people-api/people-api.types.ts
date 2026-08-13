import type { PeopleDataSourceAlias } from './constants/people-data-source-aliases';
import type { TaxonomyConstantItem } from './constants/taxonomy-constants';
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
};

export type PeopleSearchQueryMeta = {
  keywords?: string | null;
  company?: PeopleSearchLinkedInCompany;
  stdFunction?: string;
  stdFunctionRoot?: string;
  stdGrade?: string;
  appliedFilters?: {
    functionIds?: string[];
    seniorities?: string[];
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

export type PeopleSearchResponse = {
  status: 'ok';
  dataSource: PeopleDataSourceAlias;
  total: number;
  items: PeopleSearchResultItem[];
  // Present when LinkedIn sourcing ran taxonomy post-filter
  query?: PeopleSearchQueryMeta;
  totalBeforeFilter?: number;
};

export type ResolvedTitleTaxonomy = {
  jobTitle: string;
  normalizedTitle: string | null;
  stdFunction: string | null;
  stdFunctionRoot: string | null;
  stdGrade: string | null;
  confidence: number;
};

export type PeopleSearchByTitleResponse = PeopleSearchResponse & {
  resolved: ResolvedTitleTaxonomy;
};

export type PeopleSearchByTaxonomyResponse = {
  status: 'ok';
  dataSource: 'harvest' | 'unipile' | 'pool';
  query: {
    keywords: string | null;
    company: PeopleSearchLinkedInCompany;
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

export type TaxonomyTreeResponse = {
  status: 'ok';
  gradeLevels: TaxonomyConstantItem[];
  functionRoots: TaxonomyTreeRootNode[];
};
