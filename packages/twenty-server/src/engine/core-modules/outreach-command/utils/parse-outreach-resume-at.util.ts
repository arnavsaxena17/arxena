import { isNonEmptyString } from '@sniptt/guards';

const MONTH_NAMES: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

const parseDayMonthHint = (hint: string, referenceDate: Date): Date | null => {
  const normalized = hint.trim().toLowerCase();
  const match = normalized.match(/(\d{1,2})\s*(?:st|nd|rd|th)?\s*([a-z]+)/);

  if (!match) {
    return null;
  }

  const day = Number.parseInt(match[1], 10);
  const monthToken = match[2]?.replace(/\./g, '') ?? '';
  const month = MONTH_NAMES[monthToken];

  if (!Number.isFinite(day) || month === undefined) {
    return null;
  }

  let year = referenceDate.getFullYear();
  const candidate = new Date(Date.UTC(year, month, day, 9, 0, 0));

  if (candidate.getTime() < referenceDate.getTime()) {
    year += 1;
    return new Date(Date.UTC(year, month, day, 9, 0, 0));
  }

  return candidate;
};

export const parseOutreachResumeAtFromHint = (
  extractedTimeHint: string,
  referenceDate = new Date(),
): string | null => {
  const hint = extractedTimeHint.trim();

  if (!isNonEmptyString(hint)) {
    return null;
  }

  // Prefer explicit day/month phrases over Date.parse (which misreads free text)
  const afterMatch = hint.match(
    /after\s+(\d{1,2})\s*(?:st|nd|rd|th)?\s*([a-z]+)/i,
  );

  if (afterMatch) {
    return (
      parseDayMonthHint(
        `${afterMatch[1]} ${afterMatch[2]}`,
        referenceDate,
      )?.toISOString() ?? null
    );
  }

  const dayMonth = parseDayMonthHint(hint, referenceDate);

  if (dayMonth) {
    return dayMonth.toISOString();
  }

  const looksLikeIsoDate =
    /^\d{4}-\d{2}-\d{2}/.test(hint) || /^\d{4}\/\d{2}\/\d{2}/.test(hint);

  if (looksLikeIsoDate) {
    const isoCandidate = Date.parse(hint);

    if (Number.isFinite(isoCandidate)) {
      return new Date(isoCandidate).toISOString();
    }
  }

  return null;
};
