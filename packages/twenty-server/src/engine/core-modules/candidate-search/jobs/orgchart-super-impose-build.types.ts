import type { OrgchartSearchMode } from 'twenty-shared';

import type { SuperImposeInputs } from 'src/engine/core-modules/org-chart/types/super-impose.types';

type OrgchartSearchType = 'classic' | 'sales_navigator' | 'recruiter';

/**
 * Payload for worker-driven super-impose org chart builds.
 */
export type OrgchartSuperImposeBuildJobData = {
  apiToken: string;
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
};
