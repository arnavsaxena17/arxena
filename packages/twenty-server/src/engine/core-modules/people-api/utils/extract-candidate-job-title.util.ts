import { pickEmploymentPositionMatchingCompany } from 'src/engine/core-modules/candidate-sourcing/utils/linkedin-orgchart-company-match.util';

const asNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const firstNonEmptyStringInArray = (value: unknown): string | null => {
  if (!Array.isArray(value)) {
    return null;
  }
  for (const entry of value) {
    const title = asNonEmptyString(entry);
    if (title) {
      return title;
    }
  }
  return null;
};

export const extractTitleFromPositionLike = (
  entry: Record<string, unknown>,
): string | null => {
  const direct =
    asNonEmptyString(entry.role) ??
    asNonEmptyString(entry.jobTitle) ??
    asNonEmptyString(entry.job_title) ??
    asNonEmptyString(entry.title);
  if (direct) {
    return direct;
  }

  const nestedTitle = entry.title;
  if (nestedTitle && typeof nestedTitle === 'object') {
    const nested = asNonEmptyString((nestedTitle as { name?: unknown }).name);
    if (nested) {
      return nested;
    }
  }

  const nestedPosition = entry.position;
  if (nestedPosition && typeof nestedPosition === 'object') {
    return asNonEmptyString((nestedPosition as { name?: unknown }).name);
  }

  return asNonEmptyString(entry.position);
};

export const extractCompanyFromPositionLike = (
  entry: Record<string, unknown>,
): string | null => {
  const direct =
    asNonEmptyString(entry.company) ??
    asNonEmptyString(entry.companyName) ??
    asNonEmptyString(entry.company_name) ??
    asNonEmptyString(entry.jobCompanyName);
  if (direct) {
    return direct;
  }

  const nestedCompany = entry.company;
  if (nestedCompany && typeof nestedCompany === 'object') {
    return asNonEmptyString((nestedCompany as { name?: unknown }).name);
  }

  return null;
};

export const extractCompanyIdFromPositionLike = (
  entry: Record<string, unknown>,
): string | null => {
  const raw = entry.company_id ?? entry.companyId;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return String(raw);
  }
  return asNonEmptyString(raw);
};

const firstTitleFromPositionArray = (value: unknown): string | null => {
  if (!Array.isArray(value)) {
    return null;
  }
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const title = extractTitleFromPositionLike(entry as Record<string, unknown>);
    if (title) {
      return title;
    }
  }
  return null;
};

const asPositionRecords = (value: unknown): Record<string, unknown>[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (entry): entry is Record<string, unknown> =>
      !!entry && typeof entry === 'object',
  );
};

const positionHasCompanyIdentity = (entry: Record<string, unknown>): boolean =>
  !!extractCompanyFromPositionLike(entry) ||
  !!extractCompanyIdFromPositionLike(entry);

const toMatchInput = (entry: Record<string, unknown>) => ({
  company: extractCompanyFromPositionLike(entry),
  company_id: extractCompanyIdFromPositionLike(entry),
  role: extractTitleFromPositionLike(entry),
  entry,
});

export type ExtractCandidateJobTitleOptions = {
  companyName?: string | null;
  companyId?: string | number | null;
  companySlug?: string | null;
};

const hasCompanyScope = (
  options?: ExtractCandidateJobTitleOptions,
): boolean =>
  !!options?.companyName?.trim() ||
  !!options?.companySlug?.trim() ||
  (typeof options?.companyId === 'string' &&
    options.companyId.trim().length > 0) ||
  (typeof options?.companyId === 'number' && Number.isFinite(options.companyId));

const isCurrentExperienceEntry = (entry: Record<string, unknown>): boolean => {
  const end = entry.end ?? entry.endDate ?? entry.end_date;
  return end === null || end === undefined || end === '';
};

const collectCurrentPositionRecords = (candidate: Record<string, unknown>) => {
  const currentPositions = [
    ...asPositionRecords(candidate.current_positions),
    ...asPositionRecords(candidate.currentPositions),
  ];
  const experiencePool = [
    ...asPositionRecords(candidate.work_experience),
    ...asPositionRecords(candidate.workExperience),
    ...asPositionRecords(candidate.experience),
  ];

  return {
    currentPositions,
    currentExperience: experiencePool.filter(isCurrentExperienceEntry),
  };
};

const toTargetCompany = (options?: ExtractCandidateJobTitleOptions) => ({
  companyName: options?.companyName,
  companyId: options?.companyId,
  companySlug: options?.companySlug,
});

/**
 * True when the person currently works at the searched company.
 * Uses the same company_id / name matcher as title extraction.
 * People with no employer identity on the hit are kept (LinkedIn often omits it).
 */
export const candidateCurrentlyWorksAtTargetCompany = (
  candidate: Record<string, unknown>,
  options?: ExtractCandidateJobTitleOptions,
): boolean => {
  if (!hasCompanyScope(options)) {
    return true;
  }

  const target = toTargetCompany(options);
  const { currentPositions, currentExperience } =
    collectCurrentPositionRecords(candidate);

  if (
    pickEmploymentPositionMatchingCompany(
      currentPositions.map(toMatchInput),
      target,
    )
  ) {
    return true;
  }

  if (
    pickEmploymentPositionMatchingCompany(
      currentExperience.map(toMatchInput),
      target,
    )
  ) {
    return true;
  }

  const anyIdentity = [...currentPositions, ...currentExperience].some(
    positionHasCompanyIdentity,
  );
  if (anyIdentity) {
    return false;
  }

  if (positionHasCompanyIdentity(candidate)) {
    return !!pickEmploymentPositionMatchingCompany(
      [toMatchInput(candidate)],
      target,
    );
  }

  return true;
};

export const extractCandidateJobTitle = (
  candidate: Record<string, unknown>,
  options?: ExtractCandidateJobTitleOptions,
): string | null => {
  if (hasCompanyScope(options)) {
    const { currentPositions, currentExperience } =
      collectCurrentPositionRecords(candidate);
    const target = toTargetCompany(options);

    const matchedCurrent = pickEmploymentPositionMatchingCompany(
      currentPositions.map(toMatchInput),
      target,
    );
    if (matchedCurrent) {
      return extractTitleFromPositionLike(matchedCurrent.entry);
    }

    const matchedExperience = pickEmploymentPositionMatchingCompany(
      currentExperience.map(toMatchInput),
      target,
    );
    if (matchedExperience) {
      return extractTitleFromPositionLike(matchedExperience.entry);
    }

    const anyIdentity = [...currentPositions, ...currentExperience].some(
      positionHasCompanyIdentity,
    );
    if (anyIdentity) {
      return null;
    }
  }

  const explicit =
    asNonEmptyString(candidate.jobTitle) ??
    asNonEmptyString(candidate.job_title) ??
    asNonEmptyString(candidate.title);
  if (explicit) {
    return explicit;
  }

  const fromJobTitles = firstNonEmptyStringInArray(candidate.jobTitles);
  if (fromJobTitles) {
    return fromJobTitles;
  }

  const fromCurrentPositions =
    firstTitleFromPositionArray(candidate.current_positions) ??
    firstTitleFromPositionArray(candidate.currentPositions);
  if (fromCurrentPositions) {
    return fromCurrentPositions;
  }

  const fromWorkExperience =
    firstTitleFromPositionArray(candidate.work_experience) ??
    firstTitleFromPositionArray(candidate.workExperience);
  if (fromWorkExperience) {
    return fromWorkExperience;
  }

  const fromExperience = firstTitleFromPositionArray(candidate.experience);
  if (fromExperience) {
    return fromExperience;
  }

  return asNonEmptyString(candidate.headline);
};

const firstCompanyFromPositionArray = (
  entries: Record<string, unknown>[],
): string | null => {
  for (const entry of entries) {
    const company = extractCompanyFromPositionLike(entry);
    if (company) {
      return company;
    }
  }

  return null;
};

export const extractCandidateCompanyName = (
  candidate: Record<string, unknown>,
  options?: ExtractCandidateJobTitleOptions,
): string | null => {
  const { currentPositions, currentExperience } =
    collectCurrentPositionRecords(candidate);

  if (hasCompanyScope(options)) {
    const target = toTargetCompany(options);
    const matchedCurrent = pickEmploymentPositionMatchingCompany(
      currentPositions.map(toMatchInput),
      target,
    );
    if (matchedCurrent) {
      return extractCompanyFromPositionLike(matchedCurrent.entry);
    }

    const matchedExperience = pickEmploymentPositionMatchingCompany(
      currentExperience.map(toMatchInput),
      target,
    );
    if (matchedExperience) {
      return extractCompanyFromPositionLike(matchedExperience.entry);
    }
  }

  return (
    firstCompanyFromPositionArray(currentPositions) ??
    firstCompanyFromPositionArray(currentExperience) ??
    firstCompanyFromPositionArray([
      ...asPositionRecords(candidate.work_experience),
      ...asPositionRecords(candidate.workExperience),
      ...asPositionRecords(candidate.experience),
    ]) ??
    extractCompanyFromPositionLike(candidate)
  );
};
