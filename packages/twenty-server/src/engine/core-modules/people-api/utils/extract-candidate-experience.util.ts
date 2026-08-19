const asNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export type CandidateExperienceForClassify = {
  title?: string;
  startDate?: string | null;
  endDate?: string | null;
  isCurrent?: boolean;
};

const extractTitleFromExperienceEntry = (
  entry: Record<string, unknown>,
): string | null => {
  const direct =
    asNonEmptyString(entry.title) ??
    asNonEmptyString(entry.jobTitle) ??
    asNonEmptyString(entry.job_title);
  if (direct) {
    return direct;
  }
  const nestedTitle = entry.title;
  if (nestedTitle && typeof nestedTitle === 'object') {
    return asNonEmptyString((nestedTitle as { name?: unknown }).name);
  }
  const nestedPosition = entry.position;
  if (nestedPosition && typeof nestedPosition === 'object') {
    return asNonEmptyString((nestedPosition as { name?: unknown }).name);
  }
  return asNonEmptyString(entry.position);
};

export const extractCandidateExperience = (
  candidate: Record<string, unknown>,
): CandidateExperienceForClassify[] => {
  const raw = candidate.experience;
  if (!Array.isArray(raw)) {
    return [];
  }

  const items: CandidateExperienceForClassify[] = [];
  for (const value of raw) {
    if (!value || typeof value !== 'object') {
      continue;
    }
    const entry = value as Record<string, unknown>;
    const title = extractTitleFromExperienceEntry(entry);
    if (!title) {
      continue;
    }
    items.push({
      title,
      startDate:
        asNonEmptyString(entry.startDate) ??
        asNonEmptyString(entry.start_date),
      endDate:
        asNonEmptyString(entry.endDate) ?? asNonEmptyString(entry.end_date),
      isCurrent:
        entry.isCurrent === true ||
        entry.is_current === true ||
        entry.isCurrent === 'true' ||
        entry.is_current === 'true',
    });
  }
  return items;
};
