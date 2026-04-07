import type { LinkedInPeopleSearchResult } from 'src/engine/core-modules/linkedin-search/types/linkedin-search-response.type';

export type LinkedinXraySearchEngine = 'google' | 'bing' | 'both';

export type LinkedinXrayPaginationMode = 'arxena' | 'bright_data';

export type LinkedinXrayPeopleResultsJobData = {
  searchJobId: string;
  recruiterId: string;
  apiToken: string;
  origin: string;
  rawQuery: string;
  jobId: string;
  jobName: string;
  searchEngine: LinkedinXraySearchEngine;
  paginationMode: LinkedinXrayPaginationMode;
  includePaginatedHtml: boolean;
  query: {
    q: string;
    asOq: string | null;
    siteClause: string;
  };
  urls: {
    google: string;
    bing: string;
  };
};

export type LinkedinXrayProgressData = {
  recruiterId: string;
  search_job_id: string;
  step:
    | 'started'
    | 'status'
    | 'page_fetched'
    | 'completed'
    | 'error'
    | 'heartbeat';
  message: string;
  timestamp: string;
  raw_query?: string;
  search_engine?: LinkedinXraySearchEngine;
  engine?: 'google' | 'bing';
  current_batch?: number;
  total_batches?: number;
  total_candidates?: number;
  processed_candidates?: number;
  fetched_pages?: number[];
  page?: number;
  pages_by_engine?: Record<string, number[]>;
  candidates?: LinkedInPeopleSearchResult[];
  total_pages_available?: number;
  job_id?: string;
  job_name?: string;
  snapshot_id?: string;
  polling_attempt?: number;
  pagination_mode?: LinkedinXrayPaginationMode;
};
