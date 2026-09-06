import {
  parseSendWindowDays,
  type SendWindowWeekday,
} from 'twenty-shared/arx';

export type OutreachThrottleChannel = 'connect' | 'comment' | 'email' | 'message';

export type OutreachThrottleCounters = {
  lastLinkedinConnectAt?: string | Date | null;
  lastLinkedinMessageAt?: string | Date | null;
};

export const incrementThrottleCounter = (
  _counters: OutreachThrottleCounters,
  channel: OutreachThrottleChannel,
  now: Date = new Date(),
): Partial<OutreachThrottleCounters> => {
  switch (channel) {
    case 'connect':
      return {
        lastLinkedinConnectAt: now,
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

export type OutreachSendWindowInput = {
  now: Date;
  timezone?: string | null;
  sendWindowStart?: string | null;
  sendWindowEnd?: string | null;
  sendWindowDays?: string | null;
  // Test bypass: when set, always return now + this many ms
  delayMsOverride?: number | null;
};

export type OutreachSendWindowResult = {
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

const resolveAllowedWeekdays = (
  sendWindowDays?: string | null,
): Set<SendWindowWeekday> => new Set(parseSendWindowDays(sendWindowDays));

// Default window: Mon–Sat 10:00–20:00 in project timezone (or UTC)
export const computeNextSendWindow = ({
  now,
  timezone = 'UTC',
  sendWindowStart = '10:00',
  sendWindowEnd = '20:00',
  sendWindowDays,
  delayMsOverride,
}: OutreachSendWindowInput): OutreachSendWindowResult => {
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
  const startMinutes = parseHhMmToMinutes(sendWindowStart) ?? 10 * 60;
  const endMinutes = parseHhMmToMinutes(sendWindowEnd) ?? 20 * 60;
  const allowedWeekdays = resolveAllowedWeekdays(sendWindowDays);
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
