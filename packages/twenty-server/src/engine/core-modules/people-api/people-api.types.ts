import type { PeopleDataSourceAlias } from './constants/people-data-source-aliases';

export type TaxonomyItem = {
  id: string;
  label: string;
  name: string;
  parent_id: string | null;
  level: string | number | null;
};

export type PeopleSearchResultItem = Record<string, unknown>;

export type PeopleSearchResponse = {
  status: 'ok';
  dataSource: PeopleDataSourceAlias;
  total: number;
  items: PeopleSearchResultItem[];
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
