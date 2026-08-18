export type GtmThrottleChannel = 'connect' | 'comment' | 'email' | 'message';

export type GtmThrottleCounters = {
  linkedinConnectsToday: number;
  commentsToday: number;
  emailsToday: number;
  maxConnectsPerDay: number;
  maxCommentsPerDay: number;
  maxEmailsPerDay: number;
  linkedinConnectsThisWeek?: number;
  maxConnectsPerWeek?: number;
  linkedinConnectsWeekStartedAt?: string | Date | null;
  minConnectGapMinutes?: number;
  minMessageGapMinutes?: number;
  lastLinkedinConnectAt?: string | Date | null;
  lastLinkedinMessageAt?: string | Date | null;
};

export const isOverDailyCap = (
  counters: GtmThrottleCounters,
  channel: GtmThrottleChannel,
): boolean => {
  switch (channel) {
    case 'connect':
      return counters.linkedinConnectsToday >= counters.maxConnectsPerDay;
    case 'comment':
      return counters.commentsToday >= counters.maxCommentsPerDay;
    case 'email':
      return counters.emailsToday >= counters.maxEmailsPerDay;
    case 'message':
      return false;
    default:
      return false;
  }
};

const startOfIsoWeekUtc = (date: Date): Date => {
  const copy = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = copy.getUTCDay() || 7;

  copy.setUTCDate(copy.getUTCDate() - day + 1);
  copy.setUTCHours(0, 0, 0, 0);

  return copy;
};

export const isOverWeeklyConnectCap = (
  counters: GtmThrottleCounters,
  now: Date = new Date(),
): { over: boolean; weekStartedAt: Date; connectsThisWeek: number } => {
  const max = counters.maxConnectsPerWeek ?? 100;
  const weekStart = startOfIsoWeekUtc(now);
  const storedStart = counters.linkedinConnectsWeekStartedAt
    ? new Date(counters.linkedinConnectsWeekStartedAt)
    : null;
  const sameWeek =
    storedStart !== null &&
    Number.isFinite(storedStart.getTime()) &&
    storedStart.getTime() === weekStart.getTime();
  const connectsThisWeek = sameWeek
    ? (counters.linkedinConnectsThisWeek ?? 0)
    : 0;

  return {
    over: connectsThisWeek >= max,
    weekStartedAt: weekStart,
    connectsThisWeek,
  };
};

const toDate = (value: string | Date | null | undefined): Date | null => {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  return Number.isFinite(date.getTime()) ? date : null;
};

export const computeSeatGapDelayMs = ({
  channel,
  counters,
  now = new Date(),
}: {
  channel: GtmThrottleChannel;
  counters: GtmThrottleCounters;
  now?: Date;
}): number => {
  const lastAt =
    channel === 'connect'
      ? toDate(counters.lastLinkedinConnectAt)
      : channel === 'message'
        ? toDate(counters.lastLinkedinMessageAt)
        : null;

  if (!lastAt) {
    return 0;
  }

  const gapMinutes =
    channel === 'connect'
      ? (counters.minConnectGapMinutes ?? 60)
      : channel === 'message'
        ? (counters.minMessageGapMinutes ?? 15)
        : 0;

  if (gapMinutes <= 0) {
    return 0;
  }

  const elapsed = now.getTime() - lastAt.getTime();
  const required = gapMinutes * 60 * 1000;

  return Math.max(0, required - elapsed);
};

export const incrementThrottleCounter = (
  counters: GtmThrottleCounters,
  channel: GtmThrottleChannel,
  now: Date = new Date(),
): Partial<GtmThrottleCounters> => {
  switch (channel) {
    case 'connect': {
      const weekly = isOverWeeklyConnectCap(counters, now);

      return {
        linkedinConnectsToday: counters.linkedinConnectsToday + 1,
        linkedinConnectsThisWeek: weekly.connectsThisWeek + 1,
        linkedinConnectsWeekStartedAt: weekly.weekStartedAt,
        lastLinkedinConnectAt: now,
      };
    }
    case 'comment':
      return {
        commentsToday: counters.commentsToday + 1,
      };
    case 'email':
      return {
        emailsToday: counters.emailsToday + 1,
      };
    case 'message':
      return {
        lastLinkedinMessageAt: now,
      };
    default:
      return {};
  }
};

// Parses HH:mm; returns minutes from midnight or null
export const parseHhMmToMinutes = (value: string | null | undefined): number | null => {
  if (!value) {
    return null;
  }

  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
};

export type GtmSendWindowInput = {
  now: Date;
  timezone?: string | null;
  sendWindowStart?: string | null;
  sendWindowEnd?: string | null;
  // Test bypass: when set, always return now + this many ms
  delayMsOverride?: number | null;
};

export type GtmSendWindowResult = {
  canSendNow: boolean;
  delayMs: number;
  nextSendAt: Date;
};

const getZonedParts = (
  date: Date,
  timezone: string,
): { weekday: number; minutes: number } => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const weekdayLabel =
    parts.find((part) => part.type === 'weekday')?.value ?? 'Mon';
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
  const minute = Number(
    parts.find((part) => part.type === 'minute')?.value ?? '0',
  );
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    weekday: weekdayMap[weekdayLabel] ?? 1,
    minutes: hour * 60 + minute,
  };
};

// Default window: Tue–Thu 09:00–17:00 in project timezone (or UTC)
export const computeNextSendWindow = ({
  now,
  timezone = 'UTC',
  sendWindowStart = '09:00',
  sendWindowEnd = '17:00',
  delayMsOverride,
}: GtmSendWindowInput): GtmSendWindowResult => {
  if (
    delayMsOverride !== null &&
    delayMsOverride !== undefined &&
    Number.isFinite(delayMsOverride)
  ) {
    const nextSendAt = new Date(now.getTime() + delayMsOverride);

    return {
      canSendNow: delayMsOverride <= 0,
      delayMs: Math.max(0, delayMsOverride),
      nextSendAt,
    };
  }

  const resolvedTimezone = timezone || 'UTC';
  const startMinutes = parseHhMmToMinutes(sendWindowStart) ?? 9 * 60;
  const endMinutes = parseHhMmToMinutes(sendWindowEnd) ?? 17 * 60;
  const allowedWeekdays = new Set([2, 3, 4]); // Tue Wed Thu
  const { weekday, minutes } = getZonedParts(now, resolvedTimezone);

  if (
    allowedWeekdays.has(weekday) &&
    minutes >= startMinutes &&
    minutes < endMinutes
  ) {
    return {
      canSendNow: true,
      delayMs: 0,
      nextSendAt: now,
    };
  }

  // Advance hour-by-hour until inside window (max 8 days)
  let cursor = new Date(now.getTime());

  for (let step = 0; step < 24 * 8; step += 1) {
    cursor = new Date(cursor.getTime() + 60 * 60 * 1000);
    const parts = getZonedParts(cursor, resolvedTimezone);

    if (
      allowedWeekdays.has(parts.weekday) &&
      parts.minutes >= startMinutes &&
      parts.minutes < endMinutes
    ) {
      const delayMs = Math.max(0, cursor.getTime() - now.getTime());

      return {
        canSendNow: false,
        delayMs,
        nextSendAt: cursor,
      };
    }
  }

  const fallbackDelayMs = 24 * 60 * 60 * 1000;

  return {
    canSendNow: false,
    delayMs: fallbackDelayMs,
    nextSendAt: new Date(now.getTime() + fallbackDelayMs),
  };
};
