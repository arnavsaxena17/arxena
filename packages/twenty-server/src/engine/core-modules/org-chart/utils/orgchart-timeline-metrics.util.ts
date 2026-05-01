import {
  deriveIntervalsForCandidateAtCompany,
  isActiveInMonth,
  pickTitleAtMonth,
} from './orgchart-asof-snapshot.util';

type MonthKey = `${number}-${string}`;
type WindowKey = '1m' | '3m' | '6m' | '1y';

const isMonthKey = (s: string): s is MonthKey =>
  /^\d{4}-\d{2}$/.test(s) && Number(s.slice(5, 7)) >= 1 && Number(s.slice(5, 7)) <= 12;

const monthKey = (y: number, m: number): MonthKey =>
  `${y}-${String(m).padStart(2, '0')}` as MonthKey;

const cmpMonth = (a: MonthKey, b: MonthKey): number => (a < b ? -1 : a > b ? 1 : 0);

const addMonths = (m: MonthKey, delta: number): MonthKey => {
  const y = Number(m.slice(0, 4));
  const mm = Number(m.slice(5, 7));
  const d = new Date(Date.UTC(y, mm - 1, 1));
  d.setUTCMonth(d.getUTCMonth() + delta);
  return monthKey(d.getUTCFullYear(), d.getUTCMonth() + 1);
};

const isMonthInRange = (m: MonthKey | undefined, start: MonthKey, end: MonthKey): boolean =>
  !!m && cmpMonth(m, start) >= 0 && cmpMonth(m, end) <= 0;

const currentUtcMonth = (): MonthKey => {
  const d = new Date();
  return monthKey(d.getUTCFullYear(), d.getUTCMonth() + 1);
};

type BucketCounts = {
  total: number;
  byFunctionRoot: Record<string, number>;
};

type WindowRates = {
  headcountStart: number;
  headcountEnd: number;
  averageHeadcount: number;
  hiringRatePct: number | null;
  attritionRatePct: number | null;
};

export type OrgChartTimelineMetrics = {
  asOfMonth: MonthKey;
  startMonth: MonthKey | null;
  endMonth: MonthKey;
  headcount: number;
  windows: Record<
    WindowKey,
    {
      range: { startMonth: MonthKey; endMonth: MonthKey };
      joined: BucketCounts;
      left: BucketCounts;
      rates: WindowRates;
    }
  >;
};

export type TimelineProfileItem = {
  id: string;
  fullName: string;
  linkedinUrl?: string;
  profilePictureUrl?: string;
  functionRoot: string;
  titleAtAsOf?: string;
  eventMonth?: MonthKey;
};

const normalizeFunctionRoot = (s: unknown): string => {
  if (typeof s !== 'string') return 'unclassified';
  const trimmed = s.trim();
  return trimmed ? trimmed.toLowerCase() : 'unclassified';
};

const readString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const inferFunctionRootFromText = (value: string): string | null => {
  const text = value.trim().toLowerCase();
  if (!text) return null;

  if (/\b(hr|human resources|talent|people ops|recruit(ing|ment)?)\b/u.test(text)) {
    return 'human resources';
  }
  if (/\b(marketing|brand|demand gen|growth|content|communications?|pr)\b/u.test(text)) {
    return 'marketing';
  }
  if (/\b(product( management| owner| strategy)?|pm)\b/u.test(text)) {
    return 'product';
  }
  if (/\b(engineer|engineering|developer|software|platform|devops|sre|architect)\b/u.test(text)) {
    return 'engineering';
  }
  if (/\b(sales|account executive|business development|revenue)\b/u.test(text)) {
    return 'sales';
  }
  if (/\b(finance|financial|accounting|controller|fp&a|treasury)\b/u.test(text)) {
    return 'finance';
  }
  if (/\b(legal|counsel|compliance)\b/u.test(text)) {
    return 'legal';
  }
  if (/\b(operations|ops|program|project|delivery|strategy)\b/u.test(text)) {
    return 'operations';
  }
  if (/\b(design|ux|ui|product design|creative)\b/u.test(text)) {
    return 'design';
  }
  if (/\b(research|scientist|r&d)\b/u.test(text)) {
    return 'research';
  }
  if (/\b(support|customer success|customer service)\b/u.test(text)) {
    return 'support service';
  }
  if (/\b(technology|it|information technology|security)\b/u.test(text)) {
    return 'technology';
  }

  return null;
};

const resolveFunctionRoot = (
  row: Record<string, unknown>,
  preferredTitle?: string,
): string => {
  const directValues: unknown[] = [
    row.std_function_root,
    row.stdFunctionRoot,
    row.std_functions,
    row.stdFunctions,
    row.std_function,
    row.stdFunction,
    row.functionRoot,
    row.function_root,
    row.job_function,
    row.jobFunction,
  ];

  for (const value of directValues) {
    if (Array.isArray(value)) {
      const first = value.find((v) => typeof v === 'string' && v.trim().length > 0);
      const normalized = normalizeFunctionRoot(first);
      if (normalized && normalized !== 'unclassified') return normalized;
      continue;
    }
    const normalized = normalizeFunctionRoot(value);
    if (normalized && normalized !== 'unclassified') return normalized;
  }

  const titleCandidates = [
    readString(preferredTitle),
    readString(row.titleAtAsOf),
    readString(row.job_title),
    readString(row.title),
    readString(row.headline),
  ];
  for (const title of titleCandidates) {
    const inferred = inferFunctionRootFromText(title);
    if (inferred) return inferred;
  }

  return 'unclassified';
};

function bumpByFunctionRoot(map: Record<string, number>, root: string): void {
  map[root] = (map[root] ?? 0) + 1;
}

function emptyCounts(): BucketCounts {
  return { total: 0, byFunctionRoot: {} };
}

function emptyRates(): WindowRates {
  return {
    headcountStart: 0,
    headcountEnd: 0,
    averageHeadcount: 0,
    hiringRatePct: null,
    attritionRatePct: null,
  };
}

export function computeTimelineMetricsFromCandidates(input: {
  candidates: Array<Record<string, unknown>>;
  companyName: string;
  asOfMonth?: string;
}): OrgChartTimelineMetrics {
  const asOfRaw = (input.asOfMonth ?? '').trim();
  const asOfMonth: MonthKey = isMonthKey(asOfRaw) ? asOfRaw : currentUtcMonth();
  const endMonth = currentUtcMonth();

  let startMonth: MonthKey | null = null;

  const activeAtAsOf: Array<{
    row: Record<string, unknown>;
    functionRoot: string;
    intervals: ReturnType<typeof deriveIntervalsForCandidateAtCompany>;
  }> = [];

  for (const row of input.candidates) {
    const intervals = deriveIntervalsForCandidateAtCompany({
      row,
      companyName: input.companyName,
    });
    if (intervals.length === 0) continue;

    for (const it of intervals) {
      if (isMonthKey(it.startMonth)) {
        startMonth =
          startMonth === null || cmpMonth(it.startMonth, startMonth) < 0
            ? it.startMonth
            : startMonth;
      }
    }

    const fnRoot = resolveFunctionRoot(row);

    if (isActiveInMonth(intervals as any, asOfMonth)) {
      activeAtAsOf.push({ row, functionRoot: fnRoot, intervals });
    }
  }

  const buildWindow = (deltaMonths: number): { startMonth: MonthKey; endMonth: MonthKey } => ({
    startMonth: addMonths(asOfMonth, -deltaMonths),
    endMonth: asOfMonth,
  });

  const windows: OrgChartTimelineMetrics['windows'] = {
    '1m': {
      range: buildWindow(1),
      joined: emptyCounts(),
      left: emptyCounts(),
      rates: emptyRates(),
    },
    '3m': {
      range: buildWindow(3),
      joined: emptyCounts(),
      left: emptyCounts(),
      rates: emptyRates(),
    },
    '6m': {
      range: buildWindow(6),
      joined: emptyCounts(),
      left: emptyCounts(),
      rates: emptyRates(),
    },
    '1y': {
      range: buildWindow(12),
      joined: emptyCounts(),
      left: emptyCounts(),
      rates: emptyRates(),
    },
  };

  // join/leave signals: use latest start/end events and bucket by each window range.
  for (const row of input.candidates) {
    const intervals = deriveIntervalsForCandidateAtCompany({
      row,
      companyName: input.companyName,
    });
    if (intervals.length === 0) continue;
    const fnRoot = resolveFunctionRoot(row);
    const latestStart = [...intervals]
      .map((i) => i.startMonth)
      .filter((m): m is MonthKey => isMonthKey(m))
      .sort()
      .at(-1);
    const latestEnd = [...intervals]
      .map((i) => i.endMonth)
      .filter((m): m is MonthKey => !!m && isMonthKey(m))
      .sort()
      .at(-1);

    for (const w of Object.values(windows)) {
      if (isMonthInRange(latestStart, w.range.startMonth, w.range.endMonth)) {
        w.joined.total += 1;
        bumpByFunctionRoot(w.joined.byFunctionRoot, fnRoot);
      }
      if (isMonthInRange(latestEnd, w.range.startMonth, w.range.endMonth)) {
        w.left.total += 1;
        bumpByFunctionRoot(w.left.byFunctionRoot, fnRoot);
      }
    }
  }

  // Compute window-level hiring / attrition rates using average headcount.
  for (const w of Object.values(windows)) {
    let headcountStart = 0;
    let headcountEnd = 0;
    for (const row of input.candidates) {
      const intervals = deriveIntervalsForCandidateAtCompany({
        row,
        companyName: input.companyName,
      });
      if (intervals.length === 0) continue;
      if (isActiveInMonth(intervals as any, w.range.startMonth)) headcountStart += 1;
      if (isActiveInMonth(intervals as any, w.range.endMonth)) headcountEnd += 1;
    }
    const averageHeadcount = (headcountStart + headcountEnd) / 2;
    w.rates = {
      headcountStart,
      headcountEnd,
      averageHeadcount,
      hiringRatePct: averageHeadcount > 0 ? (w.joined.total / averageHeadcount) * 100 : null,
      attritionRatePct: averageHeadcount > 0 ? (w.left.total / averageHeadcount) * 100 : null,
    };
  }

  return {
    asOfMonth,
    startMonth,
    endMonth,
    headcount: activeAtAsOf.length,
    windows,
  };
}

export function computeTimelineProfilesFromCandidates(input: {
  candidates: Array<Record<string, unknown>>;
  companyName: string;
  asOfMonth?: string;
  event: 'joined' | 'left' | 'current' | 'past';
  window?: WindowKey;
  limit?: number;
}): {
  asOfMonth: MonthKey;
  event: 'joined' | 'left' | 'current' | 'past';
  window: WindowKey;
  total: number;
  profiles: TimelineProfileItem[];
} {
  const asOfRaw = (input.asOfMonth ?? '').trim();
  const asOfMonth: MonthKey = isMonthKey(asOfRaw) ? asOfRaw : currentUtcMonth();
  const window: WindowKey = input.window ?? '1m';
  const monthsBack = window === '1m' ? 1 : window === '3m' ? 3 : window === '6m' ? 6 : 12;
  const windowStart = addMonths(asOfMonth, -monthsBack);
  const limit =
    typeof input.limit === 'number' && Number.isFinite(input.limit) && input.limit > 0
      ? Math.min(500, Math.floor(input.limit))
      : 100;
  const out: TimelineProfileItem[] = [];
  for (const row of input.candidates) {
    const intervals = deriveIntervalsForCandidateAtCompany({
      row,
      companyName: input.companyName,
    });
    if (intervals.length === 0) continue;

    const titleAtAsOf = pickTitleAtMonth(intervals as any, asOfMonth) ?? undefined;
    const fullName =
      typeof row.full_name === 'string'
        ? row.full_name
        : typeof row.name === 'string'
          ? row.name
          : '';
    const id =
      typeof row.id === 'string' && row.id.trim()
        ? row.id
        : typeof row.linkedin_url === 'string' && row.linkedin_url.trim()
          ? row.linkedin_url
          : fullName || 'timeline-profile';
    const linkedinUrl =
      typeof row.linkedin_url === 'string'
        ? row.linkedin_url
        : typeof row.linkedinUrl === 'string'
          ? row.linkedinUrl
          : undefined;
    const profilePictureUrl =
      typeof row.profile_picture_url === 'string' ? row.profile_picture_url : undefined;

    const activeNow = isActiveInMonth(intervals as any, asOfMonth);
    const latestStart = [...intervals]
      .map((i) => i.startMonth)
      .filter((m): m is MonthKey => isMonthKey(m))
      .sort()
      .at(-1);
    const latestEnd = [...intervals]
      .map((i) => i.endMonth)
      .filter((m): m is MonthKey => !!m && isMonthKey(m))
      .sort()
      .at(-1);

    const inWindow = (m?: MonthKey): boolean =>
      !!m && cmpMonth(m, windowStart) >= 0 && cmpMonth(m, asOfMonth) <= 0;

    let include = false;
    let eventMonth: MonthKey | undefined;
    if (input.event === 'current') {
      include = activeNow;
    } else if (input.event === 'past') {
      include = !activeNow;
      eventMonth = latestEnd;
    } else if (input.event === 'joined') {
      include = inWindow(latestStart);
      eventMonth = latestStart;
    } else if (input.event === 'left') {
      include = inWindow(latestEnd);
      eventMonth = latestEnd;
    }

    if (!include) continue;
    const titleAtEvent = eventMonth
      ? pickTitleAtMonth(intervals as any, eventMonth) ?? undefined
      : titleAtAsOf;
    const fnRoot = resolveFunctionRoot(row, titleAtEvent);
    out.push({
      id,
      fullName,
      linkedinUrl,
      profilePictureUrl,
      functionRoot: fnRoot,
      titleAtAsOf: titleAtEvent,
      eventMonth,
    });
  }

  return {
    asOfMonth,
    event: input.event,
    window,
    total: out.length,
    profiles: out.slice(0, limit),
  };
}

