export type CompanyDataSourceAlias =
  | 'auto'
  | 'index'
  | 'harvest'
  | 'unipile'
  | 'pool'
  | 'recruiter';

export type CompanyResolvedDataSourceAlias = Exclude<
  CompanyDataSourceAlias,
  'auto'
>;

export type CompanyDataSourceCategory = {
  alias: CompanyDataSourceAlias;
  label: string;
  description: string;
};

export const COMPANY_DATA_SOURCE_CATEGORIES: CompanyDataSourceCategory[] = [
  {
    alias: 'auto',
    label: 'Auto',
    description:
      'Prefer Unipile Sales Navigator, then Recruiter or classic/premium Unipile, then Harvest, then the companies index.',
  },
  {
    alias: 'index',
    label: 'Index',
    description: 'Search Arxena Elasticsearch company indices.',
  },
  {
    alias: 'harvest',
    label: 'Harvest',
    description: 'Harvest LinkedIn company search.',
  },
  {
    alias: 'unipile',
    label: 'Unipile',
    description:
      'Unipile LinkedIn company search. Sales Navigator is used when the account has a Sales Nav seat.',
  },
  {
    alias: 'pool',
    label: 'Sales Nav pool',
    description:
      'Unipile Sales Navigator company search via the shared Sales Navigator pool.',
  },
  {
    alias: 'recruiter',
    label: 'Recruiter',
    description:
      'Company search on a Recruiter-connected Unipile account (classic/premium company search; Unipile has no Recruiter companies category).',
  },
];
