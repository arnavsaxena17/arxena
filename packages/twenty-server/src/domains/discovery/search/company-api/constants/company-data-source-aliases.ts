import { type PickSource } from 'src/domains/ingestion/candidate-sourcing/sources/registry';

export type CompanyDataSourceAlias =
  | 'auto'
  | PickSource<
      | 'index'
      | 'harvest'
      | 'linkedin'
      | 'linkedin_pool'
      | 'recruiter'
      | 'bright_data'
    >;

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
    description:
      'Search the free company dataset in Elasticsearch (country, industry, employee size, name, website).',
  },
  {
    alias: 'harvest',
    label: 'Harvest',
    description: 'Harvest LinkedIn company search.',
  },
  {
    alias: 'linkedin',
    label: 'LinkedIn (your account)',
    description:
      'Unipile LinkedIn company search. Sales Navigator is used when the account has a Sales Nav seat.',
  },
  {
    alias: 'linkedin_pool',
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
  {
    alias: 'bright_data',
    label: 'Bright Data',
    description:
      'Bright Data Business Search with a raw natural-language query. Not used by auto.',
  },
];
