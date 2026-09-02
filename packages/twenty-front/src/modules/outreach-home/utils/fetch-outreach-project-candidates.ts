import axios from 'axios';
import { resolveOutreachResumeAt } from 'twenty-shared/arx';

import { REACT_APP_SERVER_BASE_URL } from '~/config';

export type OutreachProjectCandidateRecord = {
  id: string;
  name?: string;
  jobTitle?: string | null;
  jobCompanyName?: string | null;
  campaign?: string | null;
  projectsId?: string | null;
  status?: string | null;
  candConversationStatus?: string | null;
  outreachSequenceStage?: string | null;
  pendingChannel?: string | null;
  linkedinFollowUpCount?: number | null;
  outreachAnalytics?: unknown;
  experimentVariant?: string | null;
  linkedinUrl?: { primaryLinkUrl?: string; primaryLinkLabel?: string } | null;
  email?: { primaryEmail?: string } | null;
  peopleId?: string | null;
};

export const resolveCandidateOutreachResumeAt = (
  candidate: Pick<OutreachProjectCandidateRecord, 'outreachAnalytics'>,
): string | null => resolveOutreachResumeAt(candidate.outreachAnalytics);

export const fetchOutreachProjectCandidates = async (
  projectId: string,
  accessToken: string,
): Promise<OutreachProjectCandidateRecord[]> => {
  const response = await axios.post<OutreachProjectCandidateRecord[]>(
    `${REACT_APP_SERVER_BASE_URL}/candidate-sourcing/get-candidates-by-project-id`,
    { projectId },
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  return Array.isArray(response.data) ? response.data : [];
};
