import { type PickSource } from 'src/domains/ingestion/candidate-sourcing/sources/registry';

export type PostDataSourceAlias =
  | 'auto'
  | PickSource<'harvest' | 'linkedin' | 'linkedin_pool' | 'recruiter'>;

export type PostResolvedDataSourceAlias = Exclude<PostDataSourceAlias, 'auto'>;

export type PostDataSourceCategory = {
  alias: PostDataSourceAlias;
  label: string;
  description: string;
};

export const POST_DATA_SOURCE_CATEGORIES: PostDataSourceCategory[] = [
  {
    alias: 'auto',
    label: 'Auto',
    description:
      'Prefer a Unipile Sales Navigator account, then Recruiter/classic Unipile, then Harvest.',
  },
  {
    alias: 'harvest',
    label: 'Harvest',
    description: 'Harvest LinkedIn post search.',
  },
  {
    alias: 'linkedin',
    label: 'LinkedIn (your account)',
    description: 'Unipile LinkedIn classic post search.',
  },
  {
    alias: 'linkedin_pool',
    label: 'Sales Nav pool',
    description:
      'Classic LinkedIn post search via the shared Unipile Sales Navigator pool account.',
  },
  {
    alias: 'recruiter',
    label: 'Recruiter',
    description:
      'Classic LinkedIn post search on a Recruiter-connected Unipile account.',
  },
];
