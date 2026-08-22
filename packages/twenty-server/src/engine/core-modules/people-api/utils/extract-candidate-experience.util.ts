import { extractTitleFromPositionLike } from './extract-candidate-job-title.util';

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

const padMonth = (month: number): string => String(month).padStart(2, '0');

const formatLinkedInDate = (value: unknown): string | null => {
  const asString = asNonEmptyString(value);
  if (asString) {
    return asString;
  }
  if (!value || typeof value !== 'object') {
    return null;
  }
  const year = (value as { year?: unknown }).year;
  if (typeof year !== 'number' || year < 1) {
    return null;
  }
  const month = (value as { month?: unknown }).month;
  const mm =
    typeof month === 'number' && month >= 1 && month <= 12
      ? padMonth(month)
      : '01';
  return `${year}-${mm}-01`;
};

const isTruthyFlag = (value: unknown): boolean =>
  value === true || value === 'true';

const mapPositionArray = (
  raw: unknown,
  options?: { assumeCurrent?: boolean; currentIfNoEnd?: boolean },
): CandidateExperienceForClassify[] => {
  if (!Array.isArray(raw)) {
    return [];
  }

  const items: CandidateExperienceForClassify[] = [];
  for (const value of raw) {
    if (!value || typeof value !== 'object') {
      continue;
    }
    const entry = value as Record<string, unknown>;
    const title = extractTitleFromPositionLike(entry);
    if (!title) {
      continue;
    }
    const endDate =
      formatLinkedInDate(entry.endDate) ??
      formatLinkedInDate(entry.end_date) ??
      formatLinkedInDate(entry.end);
    items.push({
      title,
      startDate:
        formatLinkedInDate(entry.startDate) ??
        formatLinkedInDate(entry.start_date) ??
        formatLinkedInDate(entry.start),
      endDate,
      isCurrent:
        isTruthyFlag(entry.isCurrent) ||
        isTruthyFlag(entry.is_current) ||
        (options?.assumeCurrent === true && endDate == null) ||
        (options?.currentIfNoEnd === true && endDate == null),
    });
  }
  return items;
};

const experienceKey = (item: CandidateExperienceForClassify): string =>
  `${(item.title ?? '').trim().toLowerCase()}|${item.startDate ?? ''}`;

export const extractCandidateExperience = (
  candidate: Record<string, unknown>,
): CandidateExperienceForClassify[] => {
  const merged: CandidateExperienceForClassify[] = [];
  const seen = new Set<string>();

  const sources = [
    mapPositionArray(
      candidate.current_positions ?? candidate.currentPositions,
      { assumeCurrent: true },
    ),
    mapPositionArray(
      candidate.work_experience ?? candidate.workExperience,
      { currentIfNoEnd: true },
    ),
    mapPositionArray(candidate.experience),
  ];

  for (const source of sources) {
    for (const item of source) {
      const key = experienceKey(item);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      merged.push(item);
    }
  }
  return merged;
};
