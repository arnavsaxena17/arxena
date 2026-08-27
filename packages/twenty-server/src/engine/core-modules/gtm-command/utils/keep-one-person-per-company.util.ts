import { extractCompanyIdFromPositionLike } from 'src/engine/core-modules/people-api/utils/extract-candidate-job-title.util';

const STD_GRADE_BONUS: Record<string, number> = {
  leadership: 8,
  ceo: 8,
  senior: 4,
  mid: 2,
  entry: 0,
  intern: 0,
};

const TITLE_SENIORITY_PATTERNS: Array<{ re: RegExp; score: number }> = [
  {
    re: /\b(founder|co-?founder|owner|managing partner|general partner)\b/i,
    score: 100,
  },
  {
    re: /\b(executive vice president|\bevp\b|senior vice president|\bsvp\b)\b/i,
    score: 84,
  },
  { re: /\b(vice president|\bvp\b)\b/i, score: 80 },
  { re: /\b(chief executive officer|\bceo\b|\bpresident\b)\b/i, score: 95 },
  {
    re: /\b(chief\s+\w+|cfo|cto|coo|cmo|cio|chro|cpo|ciso)\b/i,
    score: 90,
  },
  { re: /\b(managing director|\bmd\b)\b/i, score: 88 },
  { re: /\bhead of\b|\bhead\b/i, score: 75 },
  { re: /\b(assistant|associate) director\b/i, score: 45 },
  { re: /\bsenior director\b/i, score: 72 },
  { re: /\bdirector\b/i, score: 70 },
  { re: /\bprincipal\b/i, score: 62 },
  { re: /\bsenior manager\b/i, score: 58 },
  { re: /\bmanager\b/i, score: 50 },
  { re: /\blead\b/i, score: 40 },
  { re: /\bsenior\b/i, score: 35 },
  { re: /\b(associate|analyst|specialist|coordinator)\b/i, score: 20 },
  { re: /\b(intern|assistant|trainee|junior)\b/i, score: 10 },
];

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asRecordArray = (value: unknown): Record<string, unknown>[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (entry): entry is Record<string, unknown> =>
      !!entry && typeof entry === 'object' && !Array.isArray(entry),
  );
};

const asNonEmptyString = (value: unknown): string => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
};

const normalizeCompanyName = (value: string): string =>
  value
    .toLowerCase()
    .replace(/\b(incorporated|inc|llc|ltd|limited|corp|corporation|co)\b\.?/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

const readCompanyId = (value: unknown): string => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return asNonEmptyString(value);
};

const currentPositionRecords = (
  record: Record<string, unknown>,
): Record<string, unknown>[] => {
  const current = [
    ...asRecordArray(record.current_positions),
    ...asRecordArray(record.currentPositions),
  ];

  if (current.length > 0) {
    return current;
  }

  return asRecordArray(record.experience).filter((entry) => {
    const end = asNonEmptyString(entry.end ?? entry.endDate ?? entry.end_date);
    const isCurrent =
      entry.isCurrent === true ||
      entry.is_current === true ||
      entry.isCurrent === 'true' ||
      !end;

    return isCurrent;
  });
};

export const extractProfileCompanyKey = (profile: unknown): string => {
  const record = asRecord(profile);

  if (!record) {
    return '';
  }

  for (const position of currentPositionRecords(record)) {
    const companyId = extractCompanyIdFromPositionLike(position);

    if (companyId) {
      return companyId;
    }
  }

  const nestedCompany = asRecord(record.company);
  const topLevelId =
    readCompanyId(record.jobCompanyId) ||
    readCompanyId(record.companyId) ||
    readCompanyId(record.company_id) ||
    readCompanyId(nestedCompany?.id) ||
    readCompanyId(nestedCompany?.companyId) ||
    readCompanyId(nestedCompany?.company_id);

  if (topLevelId) {
    return topLevelId;
  }

  const companyName =
    asNonEmptyString(record.companyName) ||
    asNonEmptyString(record.company) ||
    asNonEmptyString(nestedCompany?.name);

  return companyName ? `name:${normalizeCompanyName(companyName)}` : '';
};

const titleFromProfile = (record: Record<string, unknown>): string => {
  const currentTitles = currentPositionRecords(record)
    .map(
      (position) =>
        asNonEmptyString(position.role) ||
        asNonEmptyString(position.title) ||
        asNonEmptyString(position.position) ||
        asNonEmptyString(position.jobTitle),
    )
    .filter(Boolean);

  return [
    asNonEmptyString(record.title),
    asNonEmptyString(record.headline),
    asNonEmptyString(record.occupation),
    ...currentTitles,
  ]
    .filter(Boolean)
    .join(' | ');
};

export const scoreProfileSeniority = (profile: unknown): number => {
  const record = asRecord(profile) ?? {};
  const title = titleFromProfile(record);
  const titleScore =
    TITLE_SENIORITY_PATTERNS.find((pattern) => pattern.re.test(title))?.score ??
    15;
  const grade = asNonEmptyString(record.stdGrade).toLowerCase();

  return titleScore + (STD_GRADE_BONUS[grade] ?? 0);
};

export type CompanyDedupeAssessment = {
  index: number;
  matches: boolean;
  reason: string;
};

export const isOnlyOnePersonPerCompanyEnabled = (value: unknown): boolean =>
  value === true || value === 'true';

export const keepSeniorPersonPerCompany = <T extends CompanyDedupeAssessment>(
  assessments: T[],
  getProfile: (assessment: T) => unknown,
): T[] => {
  const bestByCompany = new Map<string, T>();
  const keptWithoutCompany = new Set<number>();

  for (const assessment of assessments) {
    if (!assessment.matches) {
      continue;
    }

    const companyKey = extractProfileCompanyKey(getProfile(assessment));

    if (!companyKey) {
      keptWithoutCompany.add(assessment.index);
      continue;
    }

    const currentBest = bestByCompany.get(companyKey);

    if (!currentBest) {
      bestByCompany.set(companyKey, assessment);
      continue;
    }

    const currentScore = scoreProfileSeniority(getProfile(assessment));
    const bestScore = scoreProfileSeniority(getProfile(currentBest));

    if (
      currentScore > bestScore ||
      (currentScore === bestScore && assessment.index < currentBest.index)
    ) {
      bestByCompany.set(companyKey, assessment);
    }
  }

  const keptIndexes = new Set<number>([
    ...keptWithoutCompany,
    ...[...bestByCompany.values()].map((assessment) => assessment.index),
  ]);

  return assessments.map((assessment) => {
    if (!assessment.matches || keptIndexes.has(assessment.index)) {
      return assessment;
    }

    return {
      ...assessment,
      matches: false,
      reason: assessment.reason
        ? `A more senior person from the same company was kept. ${assessment.reason}`
        : 'A more senior person from the same company was kept.',
    };
  });
};
