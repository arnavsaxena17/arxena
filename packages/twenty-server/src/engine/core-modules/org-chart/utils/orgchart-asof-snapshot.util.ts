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
}): Interval[] {
  const companyWant = normalizeCompany(input.companyName);
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
      const company = normalizeCompany(r.company_name);
      if (!companyWant || !company || company !== companyWant) {
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
      const company = normalizeCompany(eRaw.companyName);
      if (!companyWant || !company || company !== companyWant) {
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

export function applyAsOfSnapshotToCandidates(input: {
  candidates: Array<Record<string, unknown>>;
  companyName: string;
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

