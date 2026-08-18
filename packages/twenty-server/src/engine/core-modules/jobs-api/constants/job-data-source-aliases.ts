export type JobDataSourceAlias = 'auto' | 'harvest' | 'unipile' | 'pool' | 'recruiter';

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
    alias: 'unipile',
    label: 'Unipile',
    description: 'Unipile LinkedIn classic job search.',
  },
  {
    alias: 'pool',
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
