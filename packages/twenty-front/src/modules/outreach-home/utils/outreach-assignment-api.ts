import axios from 'axios';

import { REACT_APP_SERVER_BASE_URL } from '~/config';

export type OutreachAssignmentPolicy =
  | 'manual_only'
  | 'round_robin'
  | 'least_loaded'
  | 'warm_suggest';

export type OutreachAssignmentConfig = {
  policy: OutreachAssignmentPolicy;
  participantMemberIds: string[];
  weights: Record<string, number>;
  warmMode: 'suggest' | 'auto';
  referralInheritsOwner: boolean;
};

export type OutreachAssignmentMember = {
  memberId: string;
  name: string;
  userEmail: string;
  hasLinkedinSeat: boolean;
  eligible: boolean;
  activeCandidates: number;
  weight: number;
};

export type OutreachAssignmentMembersResponse = {
  members: OutreachAssignmentMember[];
  policy: OutreachAssignmentPolicy;
  config: OutreachAssignmentConfig;
  // Pinning only takes effect once the active sequencer version has the select step.
  pinActive: boolean;
  pinInDraft: boolean;
};

export type OutreachAssignmentOwner = {
  memberId: string;
  reason: string;
  suggestedMemberId: string | null;
};

export type OutreachAssignResponse = {
  assigned: number;
  skipped: Array<{ candidateId: string; reason: string }>;
};

const baseUrl = (projectId: string) =>
  `${REACT_APP_SERVER_BASE_URL}/outreach-command/projects/${projectId}/assignment`;

const headers = (accessToken: string) => ({
  Authorization: `Bearer ${accessToken}`,
});

export const fetchOutreachAssignmentMembers = async ({
  projectId,
  accessToken,
}: {
  projectId: string;
  accessToken: string;
}): Promise<OutreachAssignmentMembersResponse> =>
  (
    await axios.get<OutreachAssignmentMembersResponse>(
      `${baseUrl(projectId)}/members`,
      { headers: headers(accessToken) },
    )
  ).data;

export const fetchOutreachAssignmentOwners = async ({
  projectId,
  accessToken,
}: {
  projectId: string;
  accessToken: string;
}): Promise<Record<string, OutreachAssignmentOwner>> =>
  (
    await axios.get<{ owners: Record<string, OutreachAssignmentOwner> }>(
      `${baseUrl(projectId)}/owners`,
      { headers: headers(accessToken) },
    )
  ).data.owners ?? {};

export const saveOutreachAssignmentConfig = async ({
  projectId,
  accessToken,
  config,
}: {
  projectId: string;
  accessToken: string;
  config: Partial<OutreachAssignmentConfig>;
}): Promise<OutreachAssignmentConfig> =>
  (
    await axios.post<OutreachAssignmentConfig>(
      `${baseUrl(projectId)}/config`,
      config,
      { headers: headers(accessToken) },
    )
  ).data;

export const assignOutreachCandidates = async ({
  projectId,
  accessToken,
  candidateIds,
  memberId,
  force,
}: {
  projectId: string;
  accessToken: string;
  candidateIds: string[];
  memberId: string;
  force?: boolean;
}): Promise<OutreachAssignResponse> =>
  (
    await axios.post<OutreachAssignResponse>(
      `${baseUrl(projectId)}/assign`,
      { candidateIds, memberId, force },
      { headers: headers(accessToken) },
    )
  ).data;

export const splitOutreachCandidates = async ({
  projectId,
  accessToken,
  candidateIds,
  memberIds,
  mode,
  force,
}: {
  projectId: string;
  accessToken: string;
  candidateIds: string[];
  memberIds?: string[];
  mode: 'round_robin' | 'balanced';
  force?: boolean;
}): Promise<OutreachAssignResponse> =>
  (
    await axios.post<OutreachAssignResponse>(
      `${baseUrl(projectId)}/split`,
      { candidateIds, memberIds, mode, force },
      { headers: headers(accessToken) },
    )
  ).data;

export const confirmOutreachAssignmentSuggestions = async ({
  projectId,
  accessToken,
  candidateIds,
}: {
  projectId: string;
  accessToken: string;
  candidateIds: string[];
}): Promise<OutreachAssignResponse> =>
  (
    await axios.post<OutreachAssignResponse>(
      `${baseUrl(projectId)}/confirm-suggestions`,
      { candidateIds },
      { headers: headers(accessToken) },
    )
  ).data;
