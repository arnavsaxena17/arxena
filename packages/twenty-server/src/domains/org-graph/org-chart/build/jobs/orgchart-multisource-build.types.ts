import type { OrgchartSearchMode } from 'twenty-shared';

type OrgchartSearchType = 'classic' | 'sales_navigator' | 'recruiter';

/**
 * Payload for worker-driven multi-source org chart builds.
 *
 * Note: Keep this serializable (BullMQ job data).
 */
export type OrgchartMultiSourceBuildJobData = {
  apiToken: string;
  requestId?: string;
  /** Original request body forwarded from API layer. */
  body: Record<string, unknown>;
  /** Derived helpers, recomputed in worker if missing. */
  canonicalCompanyLinkedinUrl?: string;
  requestedSources?: string[];
  resolvedCompanyName: string;
  companyId?: string;
  jobTitles: string[];
  mode: OrgchartSearchMode;
  searchType: OrgchartSearchType;
};

