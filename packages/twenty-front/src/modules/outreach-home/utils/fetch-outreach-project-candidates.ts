import { isNonEmptyString } from '@sniptt/guards';
import axios from 'axios';
import {
  type CandidateFlags,
  getCandidateFlag,
  parseOutreachAnalytics,
  resolveOutreachLastInboundAt,
  resolveOutreachLastOutboundAt,
  resolveOutreachResumeAt,
} from 'twenty-shared/arx';

import { REACT_APP_SERVER_BASE_URL } from '~/config';

export type OutreachProjectCandidateRecord = {
  id: string;
  name?: string;
  campaign?: string | null;
  projectId?: string | null;
  status?: string | null;
  candConversationStatus?: string | null;
  outreachSequenceStage?: string | null;
  outreachConversationStage?: string | null;
  pendingChannel?: string | null;
  linkedinFollowUpCount?: number | null;
  outreachAnalytics?: unknown;
  experimentVariant?: string | null;
  candidateFlags?: CandidateFlags | null;
  peopleId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  people?: {
    id?: string;
    jobTitle?: string | null;
    jobCompanyName?: string | null;
    locationName?: string | null;
    emails?: { primaryEmail?: string } | null;
    linkedinLink?: {
      primaryLinkUrl?: string;
      primaryLinkLabel?: string;
    } | null;
  } | null;
  chatMessages?: {
    edges?: Array<{
      node?: {
        id?: string;
        message?: string | null;
        name?: string | null;
        createdAt?: string | null;
        typeOfMessage?: string | null;
        messageObj?: unknown;
      } | null;
    } | null>;
  } | null;
};

export const resolveCandidateOutreachResumeAt = (
  candidate: Pick<OutreachProjectCandidateRecord, 'outreachAnalytics'>,
): string | null => resolveOutreachResumeAt(candidate.outreachAnalytics);

export const resolveCandidateLastInboundAt = (
  candidate: Pick<OutreachProjectCandidateRecord, 'outreachAnalytics'>,
): string | null => resolveOutreachLastInboundAt(candidate.outreachAnalytics);

export const resolveCandidateLastOutboundAt = (
  candidate: Pick<OutreachProjectCandidateRecord, 'outreachAnalytics'>,
): string | null => resolveOutreachLastOutboundAt(candidate.outreachAnalytics);

export const formatReplyAfterTouch = (
  candidate: Pick<
    OutreachProjectCandidateRecord,
    'outreachAnalytics' | 'linkedinFollowUpCount'
  >,
): string => {
  const analytics = parseOutreachAnalytics(candidate.outreachAnalytics);

  if (isNonEmptyString(analytics?.convertedOnMessageKind)) {
    return analytics.convertedOnMessageKind.replaceAll('_', ' ');
  }

  if (isNonEmptyString(analytics?.lastOutboundMessageKind)) {
    return analytics.lastOutboundMessageKind.replaceAll('_', ' ');
  }

  if ((candidate.linkedinFollowUpCount ?? 0) > 0) {
    return `FU${candidate.linkedinFollowUpCount}`;
  }

  return '';
};

export const resolveCandidateStartOutreach = (
  candidate: Pick<OutreachProjectCandidateRecord, 'candidateFlags'>,
): boolean => getCandidateFlag(candidate, 'startOutreach');

export const resolveCandidateStopOutreach = (
  candidate: Pick<OutreachProjectCandidateRecord, 'candidateFlags'>,
): boolean => getCandidateFlag(candidate, 'stopOutreach');

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
