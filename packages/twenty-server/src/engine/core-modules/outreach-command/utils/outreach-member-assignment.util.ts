import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';

export type OutreachAssignmentPolicy =
  | 'manual_only'
  | 'round_robin'
  | 'least_loaded'
  | 'warm_suggest';

export type OutreachAssignmentReason =
  | 'manual'
  | 'bulk'
  | 'round_robin'
  | 'least_loaded'
  | 'warm'
  | 'fallback';

export type OutreachSplitMode = 'round_robin' | 'balanced';

export type OutreachMemberAssignmentConfig = {
  policy: OutreachAssignmentPolicy;
  participantMemberIds: string[];
  weights: Record<string, number>;
  // Warm policy only: pin the winner (auto) or store a suggestion (suggest).
  warmMode: 'suggest' | 'auto';
  referralInheritsOwner: boolean;
};

export const DEFAULT_OUTREACH_MEMBER_ASSIGNMENT_CONFIG: OutreachMemberAssignmentConfig =
  {
    policy: 'least_loaded',
    participantMemberIds: [],
    weights: {},
    warmMode: 'suggest',
    referralInheritsOwner: true,
  };

const POLICIES: OutreachAssignmentPolicy[] = [
  'manual_only',
  'round_robin',
  'least_loaded',
  'warm_suggest',
];

// Stages before any invite or message has left, where reassigning is free.
const PRE_SEND_STAGES = new Set(['', 'QUEUED', 'DEFERRED']);

export const isPreSendOutreachStage = (stage: string | null | undefined) =>
  PRE_SEND_STAGES.has((stage ?? '').trim().toUpperCase());

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const readOutreachMemberAssignmentConfig = (
  outreachConfig: unknown,
): OutreachMemberAssignmentConfig => {
  const parsedConfig =
    typeof outreachConfig === 'string'
      ? safeParseJson(outreachConfig)
      : outreachConfig;
  const raw = isRecord(parsedConfig) ? parsedConfig.memberAssignment : null;

  if (!isRecord(raw)) {
    return { ...DEFAULT_OUTREACH_MEMBER_ASSIGNMENT_CONFIG };
  }

  const policy = POLICIES.includes(raw.policy as OutreachAssignmentPolicy)
    ? (raw.policy as OutreachAssignmentPolicy)
    : DEFAULT_OUTREACH_MEMBER_ASSIGNMENT_CONFIG.policy;
  const participantMemberIds = Array.isArray(raw.participantMemberIds)
    ? raw.participantMemberIds.filter(isNonEmptyString)
    : [];
  const weights: Record<string, number> = {};

  if (isRecord(raw.weights)) {
    for (const [memberId, weight] of Object.entries(raw.weights)) {
      if (typeof weight === 'number' && Number.isFinite(weight) && weight > 0) {
        weights[memberId] = weight;
      }
    }
  }

  return {
    policy,
    participantMemberIds,
    weights,
    warmMode: raw.warmMode === 'auto' ? 'auto' : 'suggest',
    referralInheritsOwner: raw.referralInheritsOwner !== false,
  };
};

const safeParseJson = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const weightOf = (memberId: string, weights: Record<string, number>) =>
  weights[memberId] ?? 1;

const byId = (left: string, right: string) => left.localeCompare(right);

// Lowest load per unit of weight wins; ties go to the lowest member id so a
// re-run of the same input picks the same member.
export const pickLeastLoadedMember = ({
  memberIds,
  loadByMemberId,
  weights = {},
}: {
  memberIds: string[];
  loadByMemberId: Record<string, number>;
  weights?: Record<string, number>;
}): string | null => {
  const sortedMemberIds = [...memberIds].sort(byId);
  let best: string | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const memberId of sortedMemberIds) {
    const score =
      (loadByMemberId[memberId] ?? 0) / weightOf(memberId, weights);

    if (score < bestScore) {
      best = memberId;
      bestScore = score;
    }
  }

  return best;
};

// Rotates through the sorted participants by how many candidates the project
// has already assigned, so consecutive enrolments alternate members.
export const pickRoundRobinMember = ({
  memberIds,
  assignedTotal,
}: {
  memberIds: string[];
  assignedTotal: number;
}): string | null => {
  const sortedMemberIds = [...memberIds].sort(byId);

  if (sortedMemberIds.length === 0) {
    return null;
  }

  return sortedMemberIds[assignedTotal % sortedMemberIds.length];
};

export type OutreachSplitAssignment = {
  candidateId: string;
  memberId: string;
};

export const buildOutreachSplitPlan = ({
  candidateIds,
  memberIds,
  mode,
  weights = {},
  loadByMemberId = {},
}: {
  candidateIds: string[];
  memberIds: string[];
  mode: OutreachSplitMode;
  weights?: Record<string, number>;
  loadByMemberId?: Record<string, number>;
}): OutreachSplitAssignment[] => {
  const sortedMemberIds = [...new Set(memberIds)].sort(byId);

  if (sortedMemberIds.length === 0) {
    return [];
  }

  const sortedCandidateIds = [...new Set(candidateIds)].sort(byId);
  const runningLoad: Record<string, number> = { ...loadByMemberId };

  return sortedCandidateIds.map((candidateId, index) => {
    const memberId =
      mode === 'round_robin'
        ? sortedMemberIds[index % sortedMemberIds.length]
        : (pickLeastLoadedMember({
            memberIds: sortedMemberIds,
            loadByMemberId: runningLoad,
            weights,
          }) ?? sortedMemberIds[0]);

    runningLoad[memberId] = (runningLoad[memberId] ?? 0) + 1;

    return { candidateId, memberId };
  });
};

export const resolveEligibleMemberIds = ({
  seatedMemberIds,
  participantMemberIds,
}: {
  seatedMemberIds: string[];
  participantMemberIds: string[];
}): string[] =>
  participantMemberIds.length > 0
    ? seatedMemberIds.filter((memberId) =>
        participantMemberIds.includes(memberId),
      )
    : seatedMemberIds;

export const hasPinnedMember = (
  candidate: { outreachWorkspaceMemberId?: string | null } | null | undefined,
): boolean =>
  isDefined(candidate) &&
  isNonEmptyString(candidate.outreachWorkspaceMemberId?.trim());
