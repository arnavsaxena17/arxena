export type PostDataSourceAlias =
  | 'auto'
  | 'harvest'
  | 'unipile'
  | 'pool'
  | 'recruiter';

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
    alias: 'unipile',
    label: 'Unipile',
    description: 'Unipile LinkedIn classic post search.',
  },
  {
    alias: 'pool',
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
