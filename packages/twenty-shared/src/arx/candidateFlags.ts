import type { chatControlType } from './ArxChatTypes';

export const CANDIDATE_BOOLEAN_FLAG_KEYS = [
  'isProfilePurchased',
  'engagementStatus',
  'startChat',
  'startChatCompleted',
  'startVideoInterviewChat',
  'startVideoInterviewChatCompleted',
  'startMeetingSchedulingChat',
  'startMeetingSchedulingChatCompleted',
  'stopChat',
] as const;

export type CandidateBooleanFlagKey =
  (typeof CANDIDATE_BOOLEAN_FLAG_KEYS)[number];

export const CANDIDATE_CHAT_START_CONTROL_FIELDS = [
  'startChat',
  'startVideoInterviewChat',
  'startMeetingSchedulingChat',
] as const satisfies readonly CandidateBooleanFlagKey[];

export type CandidateChatStartControlField =
  (typeof CANDIDATE_CHAT_START_CONTROL_FIELDS)[number];

export type CandidateFlags = {
  isProfilePurchased?: boolean;
  engagementStatus?: boolean;
  startChat?: boolean;
  startChatCompleted?: boolean;
  startVideoInterviewChat?: boolean;
  startVideoInterviewChatCompleted?: boolean;
  startMeetingSchedulingChat?: boolean;
  startMeetingSchedulingChatCompleted?: boolean;
  stopChat?: boolean;
  lastEngagementChatControl?: chatControlType | null;
};

export type CandidateWithFlags = {
  candidateFlags?: CandidateFlags | null;
};

export type CandidateFlagFilterOperator = {
  eq?: boolean | string | null;
};

export type CandidateFlagFilterSpec = Record<
  string,
  CandidateFlagFilterOperator | undefined
>;

const DEFAULT_CANDIDATE_FLAGS: CandidateFlags = {
  isProfilePurchased: false,
  engagementStatus: false,
  startChat: false,
  startChatCompleted: false,
  startVideoInterviewChat: false,
  startVideoInterviewChatCompleted: false,
  startMeetingSchedulingChat: false,
  startMeetingSchedulingChatCompleted: false,
  stopChat: false,
  lastEngagementChatControl: null,
};

const readBooleanFlag = (value: unknown): boolean | undefined => {
  if (value === true || value === 'true') {
    return true;
  }

  if (value === false || value === 'false' || value === null || value === '') {
    return false;
  }

  return undefined;
};

export const parseCandidateFlags = (
  value: unknown,
): CandidateFlags | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const flags: CandidateFlags = {};

  for (const key of CANDIDATE_BOOLEAN_FLAG_KEYS) {
    const parsed = readBooleanFlag(record[key]);

    if (parsed !== undefined) {
      flags[key] = parsed;
    }
  }

  if ('lastEngagementChatControl' in record) {
    flags.lastEngagementChatControl =
      typeof record.lastEngagementChatControl === 'string' &&
      record.lastEngagementChatControl.length > 0
        ? (record.lastEngagementChatControl as chatControlType)
        : null;
  }

  return flags;
};

export const resolveCandidateFlags = (
  candidate: CandidateWithFlags | null | undefined,
): CandidateFlags => ({
  ...DEFAULT_CANDIDATE_FLAGS,
  ...parseCandidateFlags(candidate?.candidateFlags),
});

export const getCandidateFlag = (
  candidate: CandidateWithFlags | CandidateFlags | null | undefined,
  key: CandidateBooleanFlagKey,
): boolean => {
  const flags =
    candidate && 'candidateFlags' in candidate
      ? resolveCandidateFlags(candidate)
      : {
          ...DEFAULT_CANDIDATE_FLAGS,
          ...parseCandidateFlags(candidate),
        };

  return flags[key] ?? false;
};

export const getCandidateLastEngagementChatControl = (
  candidate: CandidateWithFlags | null | undefined,
): chatControlType | null =>
  resolveCandidateFlags(candidate).lastEngagementChatControl ?? null;

export const isCandidateFlagTrue = (
  candidate: CandidateWithFlags | null | undefined,
  key: CandidateBooleanFlagKey,
): boolean => getCandidateFlag(candidate, key) === true;

export const mergeCandidateFlags = (
  existing: CandidateFlags | null | undefined,
  patch: Partial<CandidateFlags>,
): CandidateFlags => ({
  ...DEFAULT_CANDIDATE_FLAGS,
  ...parseCandidateFlags(existing),
  ...patch,
});

export const buildCandidateFlagsUpdate = ({
  existingFlags,
  patch,
}: {
  existingFlags: unknown;
  patch: Partial<CandidateFlags>;
}): { candidateFlags: CandidateFlags } => ({
  candidateFlags: mergeCandidateFlags(parseCandidateFlags(existingFlags), patch),
});

export const buildCandidateFlagsPatchUpdate = (
  candidate: CandidateWithFlags | null | undefined,
  patch: Partial<CandidateFlags>,
): { candidateFlags: CandidateFlags } =>
  buildCandidateFlagsUpdate({
    existingFlags: candidate?.candidateFlags,
    patch,
  });

export const flattenCandidateFlags = <TCandidate extends CandidateWithFlags>(
  candidate: TCandidate,
): TCandidate & CandidateFlags => {
  const flags = resolveCandidateFlags(candidate);

  return {
    ...candidate,
    ...flags,
  };
};

const normalizeFilterValue = (value: unknown): boolean | string | null => {
  if (value === true || value === 'true') {
    return true;
  }

  if (value === false || value === 'false' || value === '' || value === null) {
    return false;
  }

  if (typeof value === 'string') {
    return value;
  }

  return null;
};

export const matchesCandidateFlagFilter = (
  candidate: CandidateWithFlags | null | undefined,
  filterSpec: CandidateFlagFilterSpec,
): boolean => {
  const flags = resolveCandidateFlags(candidate);

  return Object.entries(filterSpec).every(([fieldName, operator]) => {
    if (!operator || typeof operator !== 'object') {
      return true;
    }

    const expected = normalizeFilterValue(operator.eq);

    if (fieldName === 'lastEngagementChatControl') {
      const actual = flags.lastEngagementChatControl ?? null;

      return actual === expected;
    }

    const actual = flags[fieldName as CandidateBooleanFlagKey] ?? false;

    return actual === expected;
  });
};

export const matchesCandidateFlagFilters = (
  candidate: CandidateWithFlags | null | undefined,
  filterSpecs: CandidateFlagFilterSpec[],
): boolean =>
  filterSpecs.some((filterSpec) =>
    matchesCandidateFlagFilter(candidate, filterSpec),
  );

export const detectChatControlStarts = (
  before: unknown,
  after: unknown,
): CandidateChatStartControlField[] => {
  const beforeFlags = resolveCandidateFlags({ candidateFlags: parseCandidateFlags(before) });
  const afterFlags = resolveCandidateFlags({ candidateFlags: parseCandidateFlags(after) });

  return CANDIDATE_CHAT_START_CONTROL_FIELDS.filter((fieldName) => {
    const wasOff = beforeFlags[fieldName] !== true;
    const isOn = afterFlags[fieldName] === true;

    return wasOff && isOn;
  });
};

export const getCandidateChatControlValue = (
  candidate: CandidateWithFlags | null | undefined,
  chatControlTypeValue: string,
): boolean => {
  if (
    !CANDIDATE_BOOLEAN_FLAG_KEYS.includes(
      chatControlTypeValue as CandidateBooleanFlagKey,
    )
  ) {
    return false;
  }

  return getCandidateFlag(
    candidate,
    chatControlTypeValue as CandidateBooleanFlagKey,
  );
};

export const isChatControlCompleted = (
  candidate: CandidateWithFlags | null | undefined,
  chatControlTypeValue: string,
): boolean =>
  getCandidateFlag(
    candidate,
    `${chatControlTypeValue}Completed` as CandidateBooleanFlagKey,
  );
