export type AsOfMonth = `${number}-${string}`;

type Interval = {
  startMonth: string; // YYYY-MM
  endMonth: string | null; // YYYY-MM inclusive; null => ongoing
  title?: string;
};

const isValidAsOfMonth = (s: string): s is AsOfMonth => {
  const m = s.trim().match(/^(\d{4})-(\d{2})$/);
  if (!m) return false;
  const mm = Number(m[2]);
  return mm >= 1 && mm <= 12;
};

const monthKey = (y: number, m: number): string =>
  `${y}-${String(m).padStart(2, '0')}`;

const cmpMonth = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const currentUtcMonth = (): string => {
  const d = new Date();
  return monthKey(d.getUTCFullYear(), d.getUTCMonth() + 1);
};

const normalizeCompany = (s: unknown): string =>
  typeof s === 'string' ? s.trim().toLowerCase().replace(/\s+/g, ' ') : '';

/** Canonical LinkedIn company URL for matching experience rows (host + path, no trailing slash). */
export const normalizeLinkedinCompanyUrlKey = (u: unknown): string | null => {
  if (typeof u !== 'string') return null;
  const t = u.trim();
  if (!t) return null;
  try {
    const url = new URL(t.startsWith('http') ? t : `https://${t}`);
    const host = url.hostname.toLowerCase();
    if (!host.includes('linkedin.com')) return null;
    const path = url.pathname.replace(/\/+$/, '').toLowerCase();
    if (!path.includes('/company/')) return null;
    return `https://${host}${path}`;
  } catch {
    const m = t.match(/linkedin\.com\/(company\/[^?#]+)/i);
    if (!m) return null;
    return `https://www.linkedin.com/${m[1].toLowerCase().replace(/\/+$/, '')}`;
  }
};

const readExperienceRowCompanyLinkedin = (
  row: Record<string, unknown>,
): unknown =>
  row.companyLinkedinUrl ??
  row.company_linkedin_url ??
  row.companyLinkedin ??
  row.linkedin_company_url ??
  row.companyLink;

const experienceRowMatchesTargetCompany = (input: {
  companyWant: string;
  targetLinkedinKey: string | null;
  experienceCompanyName: unknown;
  experienceCompanyLinkedin: unknown;
}): boolean => {
  const nameNorm = normalizeCompany(input.experienceCompanyName);
  if (input.companyWant && nameNorm && nameNorm === input.companyWant) {
    return true;
  }
  if (!input.targetLinkedinKey) {
    return false;
  }
  const expKey = normalizeLinkedinCompanyUrlKey(input.experienceCompanyLinkedin);
  return expKey !== null && expKey === input.targetLinkedinKey;
};

const monthFromContactOut = (
  y: unknown,
  m: unknown,
  fallbackMonth: number,
): string | null => {
  if (typeof y !== 'number' || !Number.isFinite(y) || y <= 1900) return null;
  const mm =
    typeof m === 'number' && Number.isFinite(m) && m >= 1 && m <= 12
      ? Math.floor(m)
      : fallbackMonth;
  return monthKey(Math.floor(y), mm);
};

const monthFromApify = (datePart: unknown, fallbackMonth: number): string | null => {
  if (!datePart || typeof datePart !== 'object') return null;
  const dp = datePart as { year?: unknown; month?: unknown; text?: unknown };
  if (typeof dp.year !== 'number' || !Number.isFinite(dp.year) || dp.year <= 1900) {
    return null;
  }
  const rawMonth = typeof dp.month === 'string' ? dp.month : null;
  const key = rawMonth?.trim().toLowerCase().slice(0, 3) ?? '';
  const map: Record<string, number> = {
    jan: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    may: 5,
    jun: 6,
    jul: 7,
    aug: 8,
    sep: 9,
    oct: 10,
    nov: 11,
    dec: 12,
  };
  const mm = map[key] ?? fallbackMonth;
  return monthKey(Math.floor(dp.year), mm);
};

function clampEndToStart(endMonth: string | null, startMonth: string): string | null {
  if (!endMonth) return null;
  return cmpMonth(endMonth, startMonth) < 0 ? startMonth : endMonth;
}

export function deriveIntervalsForCandidateAtCompany(input: {
  row: Record<string, unknown>;
  companyName: string;
  /** When set, experience rows whose company LinkedIn URL matches are included even if `companyName` text differs. */
  companyLinkedinUrl?: string;
}): Interval[] {
  const companyWant = normalizeCompany(input.companyName);
  const targetLinkedinKey = input.companyLinkedinUrl?.trim()
    ? normalizeLinkedinCompanyUrlKey(input.companyLinkedinUrl.trim())
    : null;
  const row = input.row;

  // ContactOut: `org_contactout_experience` is usually an array of objects.
  const coExRaw =
    row.org_contactout_experience ??
    (row.org_contactout_profile &&
    typeof row.org_contactout_profile === 'object' &&
    row.org_contactout_profile !== null
      ? (row.org_contactout_profile as { experience?: unknown }).experience
      : undefined);
  if (Array.isArray(coExRaw) && coExRaw.length > 0 && typeof coExRaw[0] === 'object') {
    const out: Interval[] = [];
    for (const r of coExRaw as Array<Record<string, unknown>>) {
      if (
        !experienceRowMatchesTargetCompany({
          companyWant,
          targetLinkedinKey,
          experienceCompanyName: r.company_name,
          experienceCompanyLinkedin: readExperienceRowCompanyLinkedin(r),
        })
      ) {
        continue;
      }
      const start = monthFromContactOut(r.start_date_year, r.start_date_month, 1);
      if (!start) continue;
      const end =
        r.is_current === true
          ? null
          : monthFromContactOut(r.end_date_year, r.end_date_month, 12);
      out.push({
        startMonth: start,
        endMonth: clampEndToStart(end, start),
        title: typeof r.title === 'string' ? r.title.trim() : undefined,
      });
    }
    if (out.length > 0) {
      return out;
    }
  }

  // Apify: `org_apify_experience` is an array; fall back to `org_apify` (full profile).
  const apifyExRaw =
    row.org_apify_experience ??
    (row.org_apify && typeof row.org_apify === 'object' && row.org_apify !== null
      ? (row.org_apify as { experience?: unknown }).experience
      : undefined);
  if (Array.isArray(apifyExRaw) && apifyExRaw.length > 0) {
    const out: Interval[] = [];
    for (const eRaw of apifyExRaw as Array<Record<string, unknown>>) {
      if (
        !experienceRowMatchesTargetCompany({
          companyWant,
          targetLinkedinKey,
          experienceCompanyName: eRaw.companyName,
          experienceCompanyLinkedin: readExperienceRowCompanyLinkedin(eRaw),
        })
      ) {
        continue;
      }
      const start = monthFromApify(eRaw.startDate, 1);
      if (!start) continue;
      const endText =
        eRaw.endDate && typeof eRaw.endDate === 'object'
          ? String((eRaw.endDate as { text?: unknown }).text ?? '')
          : '';
      const isCurrent = endText.toLowerCase().includes('present');
      const end = isCurrent ? null : monthFromApify(eRaw.endDate, 12);
      out.push({
        startMonth: start,
        endMonth: clampEndToStart(end, start),
        title: typeof eRaw.position === 'string' ? eRaw.position.trim() : undefined,
      });
    }
    if (out.length > 0) {
      return out;
    }
  }

  // Harvest: profile.experience uses the same shape as Apify (companyName,
  // position, startDate{month,year,text}, endDate{month,year,text}), with
  // `companyLink` as the LinkedIn URL field. Reuse `monthFromApify` because
  // the date format is identical.
  const harvestExRaw =
    row.org_harvest_experience ??
    (row.org_harvest_profile &&
    typeof row.org_harvest_profile === 'object' &&
    row.org_harvest_profile !== null
      ? (row.org_harvest_profile as { experience?: unknown }).experience
      : undefined);
  if (Array.isArray(harvestExRaw) && harvestExRaw.length > 0) {
    const out: Interval[] = [];
    for (const eRaw of harvestExRaw as Array<Record<string, unknown>>) {
      if (
        !experienceRowMatchesTargetCompany({
          companyWant,
          targetLinkedinKey,
          experienceCompanyName: eRaw.companyName,
          experienceCompanyLinkedin: readExperienceRowCompanyLinkedin(eRaw),
        })
      ) {
        continue;
      }
      const start = monthFromApify(eRaw.startDate, 1);
      if (!start) continue;
      const endText =
        eRaw.endDate && typeof eRaw.endDate === 'object'
          ? String((eRaw.endDate as { text?: unknown }).text ?? '')
          : '';
      const isCurrent = endText.toLowerCase().includes('present');
      const end = isCurrent ? null : monthFromApify(eRaw.endDate, 12);
      out.push({
        startMonth: start,
        endMonth: clampEndToStart(end, start),
        title: typeof eRaw.position === 'string' ? eRaw.position.trim() : undefined,
      });
    }
    if (out.length > 0) {
      return out;
    }
  }

  return [];
}

export function isActiveInMonth(intervals: Interval[], asOfMonth: string): boolean {
  for (const it of intervals) {
    if (cmpMonth(it.startMonth, asOfMonth) > 0) {
      continue;
    }
    if (it.endMonth && cmpMonth(it.endMonth, asOfMonth) < 0) {
      continue;
    }
    return true;
  }
  return false;
}

export function pickTitleAtMonth(intervals: Interval[], asOfMonth: string): string | null {
  // Prefer the interval that actually covers the month, picking the latest start.
  let best: Interval | null = null;
  for (const it of intervals) {
    if (!isActiveInMonth([it], asOfMonth)) continue;
    if (!best || cmpMonth(it.startMonth, best.startMonth) > 0) {
      best = it;
    }
  }
  const title = best?.title?.trim();
  return title ? title : null;
}

/**
 * When building an entire-company chart without an `asOfMonth`, choose a role/title from
 * experience rows that match the chart company:
 * - If there is an ongoing stint at that company (`endMonth === null`), use its title
 *   (latest start wins when multiple “current” rows exist).
 * - Otherwise use the ended stint that finished most recently (`endMonth` max), tie-breaking
 *   by latest `startMonth`.
 */
export type OrgChartCompanyTenure = 'current' | 'past' | 'unknown';

/**
 * Whether the person’s matching experience at the chart company is ongoing
 * (current) or ended (past), based on ContactOut/Apify experience rows.
 */
export function companyTenureFromDerivedExperience(input: {
  row: Record<string, unknown>;
  companyName: string;
  companyLinkedinUrl?: string;
}): OrgChartCompanyTenure {
  const intervals = deriveIntervalsForCandidateAtCompany({
    row: input.row,
    companyName: input.companyName,
    companyLinkedinUrl: input.companyLinkedinUrl,
  });
  if (intervals.length === 0) {
    return 'unknown';
  }
  if (intervals.some((it) => it.endMonth === null)) {
    return 'current';
  }
  return 'past';
}

export function pickTitleForEntireCompanyFromIntervals(
  intervals: Interval[],
): string | null {
  if (intervals.length === 0) return null;

  const ongoing = intervals.filter((it) => it.endMonth === null);
  if (ongoing.length > 0) {
    let best = ongoing[0];
    for (const it of ongoing) {
      if (cmpMonth(it.startMonth, best.startMonth) > 0) best = it;
    }
    const title = best.title?.trim();
    return title ? title : null;
  }

  const ended = intervals.filter((it): it is Interval & { endMonth: string } =>
    typeof it.endMonth === 'string',
  );
  if (ended.length === 0) return null;

  let bestEnded = ended[0];
  for (const it of ended) {
    const endCmp = cmpMonth(it.endMonth, bestEnded.endMonth);
    if (endCmp > 0) {
      bestEnded = it;
    } else if (endCmp === 0 && cmpMonth(it.startMonth, bestEnded.startMonth) > 0) {
      bestEnded = it;
    }
  }
  const title = bestEnded.title?.trim();
  return title ? title : null;
}

/**
 * Rewrites headline-style title fields from matching ContactOut/Apify experience at the
 * chart company (by name and/or LinkedIn company URL). Does not filter people out.
 * Used for `entire_company` when `asOfMonth` is omitted (e.g. reload from saved people).
 */
export function applyEntireCompanyExperienceTitlesToCandidates(input: {
  candidates: Array<Record<string, unknown>>;
  companyName: string;
  companyLinkedinUrl?: string;
}): Array<Record<string, unknown>> {
  const companyName = (input.companyName ?? '').trim();
  if (!companyName && !(input.companyLinkedinUrl ?? '').trim()) {
    return input.candidates;
  }

  const out: Array<Record<string, unknown>> = [];
  for (const row of input.candidates) {
    const intervals = deriveIntervalsForCandidateAtCompany({
      row,
      companyName,
      companyLinkedinUrl: input.companyLinkedinUrl,
    });
    if (intervals.length === 0) {
      out.push(row);
      continue;
    }
    const titleAtCompany = pickTitleForEntireCompanyFromIntervals(intervals);
    if (titleAtCompany) {
      out.push({
        ...row,
        jobTitle: titleAtCompany,
        title: titleAtCompany,
        headline: titleAtCompany,
        job_title: titleAtCompany,
      });
    } else {
      out.push(row);
    }
  }
  return out;
}

export function applyAsOfSnapshotToCandidates(input: {
  candidates: Array<Record<string, unknown>>;
  companyName: string;
  companyLinkedinUrl?: string;
  asOfMonth?: string;
}): Array<Record<string, unknown>> {
  const raw = (input.asOfMonth ?? '').trim();
  if (!raw) {
    return input.candidates;
  }
  if (!isValidAsOfMonth(raw)) {
    return input.candidates;
  }

  const currentMonth = currentUtcMonth();
  const out: Array<Record<string, unknown>> = [];

  for (const row of input.candidates) {
    const intervals = deriveIntervalsForCandidateAtCompany({
      row,
      companyName: input.companyName,
      companyLinkedinUrl: input.companyLinkedinUrl,
    });

    if (intervals.length > 0) {
      if (!isActiveInMonth(intervals, raw)) {
        continue;
      }
      const titleAtTime = pickTitleAtMonth(intervals, raw);
      if (titleAtTime) {
        out.push({
          ...row,
          jobTitle: titleAtTime,
          title: titleAtTime,
          headline: titleAtTime,
          job_title: titleAtTime,
          org_as_of_month: raw,
        });
      } else {
        out.push({ ...row, org_as_of_month: raw });
      }
      continue;
    }

    // Best-effort fallback: treat unknown-history sources as “current only”.
    if (raw === currentMonth) {
      out.push({ ...row, org_as_of_month: raw });
    }
  }

  return out;
}

