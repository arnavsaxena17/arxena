import { isNonEmptyString } from '@sniptt/guards';

export const WARM_SHARED_CONNECTIONS_CAP = 60;
export const WARM_FIRST_DEGREE_BONUS = 100;
export const WARM_SCHOOL_POINTS = 25;
export const WARM_MAX_SCHOOL_MATCHES = 2;
export const WARM_CURRENT_COMPANY_POINTS = 40;
export const WARM_PAST_COMPANY_POINTS = 15;
export const WARM_MAX_PAST_COMPANY_MATCHES = 2;

// Names shorter than this only match on exact equality, so "Meta" or "EY"
// never match as a substring of a longer name.
const MIN_CONTAINMENT_LENGTH = 5;

const CORPORATE_SUFFIXES = new Set([
  'inc',
  'llc',
  'ltd',
  'limited',
  'pvt',
  'private',
  'corp',
  'corporation',
  'co',
  'plc',
  'gmbh',
  'the',
]);

export type WarmProfileFacts = {
  schools: string[];
  currentCompanies: string[];
  pastCompanies: string[];
};

export type WarmViewerFacts = {
  sharedConnectionsCount: number;
  networkDistance: string;
};

export type WarmMemberScore = {
  memberId: string;
  score: number;
  reasons: string[];
  error?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readString = (
  record: Record<string, unknown>,
  keys: string[],
): string => {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return '';
};

export const normalizeWarmName = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 0 && !CORPORATE_SUFFIXES.has(token))
    .join(' ')
    .trim();

export const warmNamesMatch = (left: string, right: string): boolean => {
  const normalizedLeft = normalizeWarmName(left);
  const normalizedRight = normalizeWarmName(right);

  if (normalizedLeft.length === 0 || normalizedRight.length === 0) {
    return false;
  }

  if (normalizedLeft === normalizedRight) {
    return true;
  }

  if (
    normalizedLeft.length < MIN_CONTAINMENT_LENGTH ||
    normalizedRight.length < MIN_CONTAINMENT_LENGTH
  ) {
    return false;
  }

  return (
    ` ${normalizedLeft} `.includes(` ${normalizedRight} `) ||
    ` ${normalizedRight} `.includes(` ${normalizedLeft} `)
  );
};

// Reads the raw Unipile profile shape (education / work_experience) leniently.
export const extractWarmProfileFacts = (
  profile: Record<string, unknown> | null | undefined,
): WarmProfileFacts => {
  const facts: WarmProfileFacts = {
    schools: [],
    currentCompanies: [],
    pastCompanies: [],
  };

  if (!isRecord(profile)) {
    return facts;
  }

  const education = Array.isArray(profile.education) ? profile.education : [];

  for (const entry of education) {
    if (!isRecord(entry)) {
      continue;
    }

    const school = readString(entry, ['school', 'school_name', 'schoolName']);

    if (isNonEmptyString(school)) {
      facts.schools.push(school);
    }
  }

  const experience = Array.isArray(profile.work_experience)
    ? profile.work_experience
    : Array.isArray(profile.experience)
      ? profile.experience
      : [];

  for (const entry of experience) {
    if (!isRecord(entry)) {
      continue;
    }

    const company = readString(entry, ['company', 'company_name']);

    if (!isNonEmptyString(company)) {
      continue;
    }

    const end = readString(entry, ['end', 'end_date', 'endDate']);
    const isCurrent = entry.current === true || end.length === 0;

    (isCurrent ? facts.currentCompanies : facts.pastCompanies).push(company);
  }

  return facts;
};

export const extractWarmViewerFacts = (
  profile: Record<string, unknown>,
): WarmViewerFacts => {
  const shared = profile.shared_connections_count ?? profile.sharedConnectionsCount;

  return {
    sharedConnectionsCount:
      typeof shared === 'number' && Number.isFinite(shared) ? shared : 0,
    networkDistance: readString(profile, ['network_distance', 'networkDistance']),
  };
};

export const isFirstDegreeDistance = (distance: string): boolean =>
  /^(first_degree|distance_1|1)$/i.test(distance.trim());

const countMatches = (left: string[], right: string[]): number =>
  left.filter((leftName) =>
    right.some((rightName) => warmNamesMatch(leftName, rightName)),
  ).length;

export const scoreWarmOverlap = ({
  memberId,
  viewerFacts,
  memberFacts,
  prospectFacts,
}: {
  memberId: string;
  viewerFacts: WarmViewerFacts;
  memberFacts: WarmProfileFacts;
  prospectFacts: WarmProfileFacts;
}): WarmMemberScore => {
  const reasons: string[] = [];
  let score = 0;

  const shared = Math.min(
    Math.max(viewerFacts.sharedConnectionsCount, 0),
    WARM_SHARED_CONNECTIONS_CAP,
  );

  if (shared > 0) {
    score += shared;
    reasons.push(`${viewerFacts.sharedConnectionsCount} mutual connections`);
  }

  if (isFirstDegreeDistance(viewerFacts.networkDistance)) {
    score += WARM_FIRST_DEGREE_BONUS;
    reasons.push('already connected');
  }

  const schoolMatches = Math.min(
    countMatches(memberFacts.schools, prospectFacts.schools),
    WARM_MAX_SCHOOL_MATCHES,
  );

  if (schoolMatches > 0) {
    score += schoolMatches * WARM_SCHOOL_POINTS;
    reasons.push(`${schoolMatches} shared school`);
  }

  const prospectCompanies = [
    ...prospectFacts.currentCompanies,
    ...prospectFacts.pastCompanies,
  ];
  const currentMatches = countMatches(
    memberFacts.currentCompanies,
    prospectCompanies,
  );

  if (currentMatches > 0) {
    score += WARM_CURRENT_COMPANY_POINTS;
    reasons.push('works at a company the prospect has worked at');
  }

  const pastMatches = Math.min(
    countMatches(memberFacts.pastCompanies, prospectCompanies),
    WARM_MAX_PAST_COMPANY_MATCHES,
  );

  if (pastMatches > 0) {
    score += pastMatches * WARM_PAST_COMPANY_POINTS;
    reasons.push(`${pastMatches} shared past employer`);
  }

  return { memberId, score, reasons };
};

// Higher score, then lighter load, then the project recruiter, then lowest id.
export const pickWarmWinner = ({
  scores,
  loadByMemberId,
  recruiterId,
}: {
  scores: WarmMemberScore[];
  loadByMemberId: Record<string, number>;
  recruiterId: string | null;
}): string | null => {
  const scorable = scores.filter((entry) => entry.error === undefined);

  if (scorable.length === 0) {
    return null;
  }

  const ordered = [...scorable].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    const leftLoad = loadByMemberId[left.memberId] ?? 0;
    const rightLoad = loadByMemberId[right.memberId] ?? 0;

    if (leftLoad !== rightLoad) {
      return leftLoad - rightLoad;
    }

    if (left.memberId === recruiterId) {
      return -1;
    }

    if (right.memberId === recruiterId) {
      return 1;
    }

    return left.memberId.localeCompare(right.memberId);
  });

  return ordered[0].memberId;
};
