import type { JobDataSourceAlias } from '../constants/job-data-source-aliases';

export type JobSearchHit = {
  id: string;
  title: string;
  location: string;
  url: string;
  companyName: string;
  postedAt: string;
};

export type JobSearchResponse = {
  status: 'ok';
  dataSource: Exclude<JobDataSourceAlias, 'auto'>;
  total: number;
  items: JobSearchHit[];
};

export type JobDataSourcesStatusResponse = {
  status: 'ok';
  sources: Array<{
    alias: JobDataSourceAlias;
    label: string;
    description: string;
    configured: boolean;
  }>;
};
