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

export const extractCandidateJobTitle = (
  candidate: Record<string, unknown>,
): string | null => {
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
