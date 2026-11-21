import type { OrgchartSearchMode } from 'twenty-shared';

import type { SuperImposeInputs } from 'src/engine/core-modules/org-chart/types/super-impose.types';

type OrgchartSearchType = 'classic' | 'sales_navigator' | 'recruiter';

/**
 * Payload for worker-driven super-impose org chart builds.
 */
export type OrgchartSuperImposeBuildJobData = {
  apiToken: string;
  /**
   * Captured at enqueue from the user JWT. Long jobs mint a workspace API key
   * for `apiToken`; API keys have no workspaceMemberId, so persist this for
   * progress pub/sub and CRM recruiterId.
   */
  workspaceId?: string;
  workspaceMemberId?: string;
  requestId?: string;
  body: Record<string, unknown>;
  canonicalCompanyLinkedinUrl?: string;
  resolvedCompanyName: string;
  companyId?: string;
  jobTitles: string[];
  mode: OrgchartSearchMode;
  searchType: OrgchartSearchType;
  superImpose: SuperImposeInputs;
  country?: string;
  functionRoot?: string;
  businessDivisionRawQuery?: string;
  leadershipOnly?: boolean;
  candidateSource: 'harvest' | 'unipile';
  linkedinLocationId?: string;
  linkedinLocationName?: string;
  linkedinCompanyParameterId?: string;
  /** Slow Unipile shard crawl past the normal ~1000 cap. */
  unlimited?: boolean;
  /** Rotate Unipile fetch across the shared Sales Navigator account pool. */
  useSalesNavigatorAccountPool?: boolean;
};
