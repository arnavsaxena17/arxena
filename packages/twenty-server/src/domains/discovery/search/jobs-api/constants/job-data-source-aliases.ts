import { type PickSource } from 'src/domains/ingestion/candidate-sourcing/sources/registry';

export type JobDataSourceAlias =
  | 'auto'
  | PickSource<
      | 'harvest'
      | 'linkedin'
      | 'linkedin_pool'
      | 'recruiter'
    >;

export type JobResolvedDataSourceAlias = Exclude<JobDataSourceAlias, 'auto'>;

export type JobDataSourceCategory = {
  alias: JobDataSourceAlias;
  label: string;
  description: string;
};

export const JOB_DATA_SOURCE_CATEGORIES: JobDataSourceCategory[] = [
  {
    alias: 'auto',
    label: 'Auto',
    description:
      'Prefer a Unipile Sales Navigator account (classic job search on that seat), then Recruiter/classic Unipile, then Harvest.',
  },
  {
    alias: 'harvest',
    label: 'Harvest',
    description: 'Harvest LinkedIn job search.',
  },
  {
    alias: 'linkedin',
    label: 'LinkedIn (your account)',
    description: 'Unipile LinkedIn classic job search.',
  },
  {
    alias: 'linkedin_pool',
    label: 'Sales Nav pool',
    description:
      'Classic LinkedIn job search via the shared Unipile Sales Navigator pool account.',
  },
  {
    alias: 'recruiter',
    label: 'Recruiter',
    description:
      'Classic LinkedIn job search on a Recruiter-connected Unipile account.',
  },
];
