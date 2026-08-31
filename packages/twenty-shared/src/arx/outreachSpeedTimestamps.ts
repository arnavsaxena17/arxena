export type OutreachTimeBucket =
  | 'UNDER_1D'
  | 'D1_3'
  | 'D3_7'
  | 'D7_14'
  | 'OVER_14D';

export type OutreachActionTimestampsEventKind =
  | 'connection_sent'
  | 'connection_accepted'
  | 'connection_ignored'
  | 'comment_posted'
  | 'outbound_message'
  | 'inbound_reply'
  | 'inbound_reply_flush'
  | 'meeting_booked'
  | 'meeting_held';

/** @deprecated Use OutreachActionTimestampsEventKind */
export type OutreachSpeedEventKind = Exclude<
  OutreachActionTimestampsEventKind,
  'inbound_reply' | 'inbound_reply_flush'
>;

export type OutreachActionTimestamps = {
  enrolledAt?: string | null;
  connectionSentAt?: string | null;
  connectionAcceptedAt?: string | null;
  meetingBookedAt?: string | null;
  firstContactAt?: string | null;
  firstOutboundAt?: string | null;
  lastOutboundAt?: string | null;
  firstInboundAt?: string | null;
  lastInboundAt?: string | null;
  updatedAt?: string | null;
};

/** @deprecated Use OutreachActionTimestamps */
export type OutreachSpeedTimestamps = OutreachActionTimestamps;

export type OutreachSpeedFlatMetrics = {
  daysToFirstContact: number | null;
  timeToFirstContactBucket: OutreachTimeBucket | null;
  daysToMeetingBooked: number | null;
  timeToMeetingBucket: OutreachTimeBucket | null;
  daysFromConnectionToAccept: number | null;
  daysFromConnectionToMeeting: number | null;
};

const OUTREACH_SEQUENCE_STAGES_AFTER_CONNECTION_ACCEPTED = new Set([
  'CONNECTION_ACCEPTED',
  'PROFILE_CHECKED',
  'WARM_PATH',
  'COMMENTED',
  'EMAIL_ENRICHING',
  'EMAIL_SENT',
  'INMAIL_SENT',
  'WHATSAPP_SENT',
  'REPLIED',
  'NEGOTIATING',
  'MEETING_BOOKED',
]);

const OUTBOUND_TOUCH_EVENTS = new Set<OutreachActionTimestampsEventKind>([
  'connection_sent',
  'comment_posted',
  'outbound_message',
  'meeting_booked',
]);

const INBOUND_TOUCH_EVENTS = new Set<OutreachActionTimestampsEventKind>([
  'inbound_reply',
  'inbound_reply_flush',
  'meeting_held',
]);

export const computeDaysBetween = (
  fromIso: string | null | undefined,
  toIso: string | null | undefined,
): number | null => {
  if (!fromIso || !toIso) {
    return null;
  }

  const fromMs = Date.parse(fromIso);
  const toMs = Date.parse(toIso);

  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs < fromMs) {
    return null;
  }

  return Math.round((toMs - fromMs) / (24 * 60 * 60 * 1000));
};

export const computeTimeBucket = (
  days: number | null | undefined,
): OutreachTimeBucket | null => {
  if (days === null || days === undefined || !Number.isFinite(days)) {
    return null;
  }

  if (days < 1) {
    return 'UNDER_1D';
  }

  if (days <= 3) {
    return 'D1_3';
  }

  if (days <= 7) {
    return 'D3_7';
  }

  if (days <= 14) {
    return 'D7_14';
  }

  return 'OVER_14D';
};

export const parseOutreachActionTimestamps = (
  value: unknown,
): OutreachActionTimestamps | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const readIso = (key: keyof OutreachActionTimestamps): string | null => {
    const fieldValue = record[key];

    return typeof fieldValue === 'string' && fieldValue.length > 0
      ? fieldValue
      : null;
  };

  return {
    enrolledAt: readIso('enrolledAt'),
    connectionSentAt: readIso('connectionSentAt'),
    connectionAcceptedAt: readIso('connectionAcceptedAt'),
    meetingBookedAt: readIso('meetingBookedAt'),
    firstContactAt: readIso('firstContactAt'),
    firstOutboundAt: readIso('firstOutboundAt'),
    lastOutboundAt: readIso('lastOutboundAt'),
    firstInboundAt: readIso('firstInboundAt'),
    lastInboundAt: readIso('lastInboundAt'),
    updatedAt: readIso('updatedAt'),
  };
};

/** @deprecated Use parseOutreachActionTimestamps */
export const parseOutreachSpeedTimestamps = parseOutreachActionTimestamps;

export const resolveOutreachFirstOutboundAt = (
  timestamps: unknown,
  flatFallback?: string | null,
): string | null =>
  parseOutreachActionTimestamps(timestamps)?.firstOutboundAt ??
  flatFallback ??
  null;

export const resolveOutreachLastOutboundAt = (
  timestamps: unknown,
  flatFallback?: string | null,
): string | null =>
  parseOutreachActionTimestamps(timestamps)?.lastOutboundAt ??
  flatFallback ??
  null;

export const resolveOutreachFirstContactAt = (
  timestamps: unknown,
  flatFallback?: string | null,
): string | null => {
  const parsed = parseOutreachActionTimestamps(timestamps);

  return (
    parsed?.firstContactAt ?? parsed?.connectionAcceptedAt ?? flatFallback ?? null
  );
};

export const resolveOutreachFirstInboundAt = (
  timestamps: unknown,
  flatFallback?: string | null,
): string | null =>
  parseOutreachActionTimestamps(timestamps)?.firstInboundAt ??
  flatFallback ??
  null;

export const resolveOutreachLastInboundAt = (
  timestamps: unknown,
  flatFallback?: string | null,
): string | null =>
  parseOutreachActionTimestamps(timestamps)?.lastInboundAt ??
  flatFallback ??
  null;

export const buildOutreachSpeedFlatMetrics = (
  timestamps: OutreachActionTimestamps,
): OutreachSpeedFlatMetrics => {
  const firstContactAt =
    timestamps.firstContactAt ??
    timestamps.connectionAcceptedAt ??
    null;
  const daysToFirstContact = computeDaysBetween(
    timestamps.enrolledAt,
    firstContactAt,
  );
  const daysToMeetingBooked = computeDaysBetween(
    timestamps.enrolledAt,
    timestamps.meetingBookedAt,
  );
  const daysFromConnectionToAccept = computeDaysBetween(
    timestamps.connectionSentAt,
    timestamps.connectionAcceptedAt,
  );
  const daysFromConnectionToMeeting = computeDaysBetween(
    timestamps.connectionSentAt,
    timestamps.meetingBookedAt,
  );

  return {
    daysToFirstContact,
    timeToFirstContactBucket: computeTimeBucket(daysToFirstContact),
    daysToMeetingBooked,
    timeToMeetingBucket: computeTimeBucket(daysToMeetingBooked),
    daysFromConnectionToAccept,
    daysFromConnectionToMeeting,
  };
};

export const applyOutreachActionTimestamps = ({
  existing,
  event,
  nowIso,
  enrolledAt,
}: {
  existing: OutreachActionTimestamps | null | undefined;
  event: OutreachActionTimestampsEventKind;
  nowIso: string;
  enrolledAt?: string | null;
}): OutreachActionTimestamps => {
  const base: OutreachActionTimestamps = {
    enrolledAt: existing?.enrolledAt ?? enrolledAt ?? null,
    connectionSentAt: existing?.connectionSentAt ?? null,
    connectionAcceptedAt: existing?.connectionAcceptedAt ?? null,
    meetingBookedAt: existing?.meetingBookedAt ?? null,
    firstContactAt: existing?.firstContactAt ?? null,
    firstOutboundAt: existing?.firstOutboundAt ?? null,
    lastOutboundAt: existing?.lastOutboundAt ?? null,
    firstInboundAt: existing?.firstInboundAt ?? null,
    lastInboundAt: existing?.lastInboundAt ?? null,
    updatedAt: nowIso,
  };

  let next = { ...base };

  if (OUTBOUND_TOUCH_EVENTS.has(event)) {
    next = {
      ...next,
      firstOutboundAt: next.firstOutboundAt ?? nowIso,
      lastOutboundAt: nowIso,
    };
  }

  if (INBOUND_TOUCH_EVENTS.has(event)) {
    next = {
      ...next,
      firstInboundAt: next.firstInboundAt ?? nowIso,
      lastInboundAt: nowIso,
    };
  }

  switch (event) {
    case 'connection_sent':
      return {
        ...next,
        connectionSentAt: next.connectionSentAt ?? nowIso,
      };
    case 'connection_accepted':
      return {
        ...next,
        connectionAcceptedAt: next.connectionAcceptedAt ?? nowIso,
        firstContactAt: next.firstContactAt ?? nowIso,
      };
    case 'comment_posted':
    case 'outbound_message':
      return {
        ...next,
        firstContactAt: next.firstContactAt ?? nowIso,
      };
    case 'meeting_booked':
    case 'meeting_held':
      return {
        ...next,
        meetingBookedAt: next.meetingBookedAt ?? nowIso,
      };
    default:
      return next;
  }
};

/** @deprecated Use applyOutreachActionTimestamps */
export const applyOutreachSpeedEvent = applyOutreachActionTimestamps;

export const buildCandidateActionTimestampsUpdate = ({
  existingTimestamps,
  event,
  nowIso = new Date().toISOString(),
  enrolledAt,
}: {
  existingTimestamps: unknown;
  event: OutreachActionTimestampsEventKind;
  nowIso?: string;
  enrolledAt?: string | null;
}): {
  outreachSpeedTimestamps: OutreachActionTimestamps;
  firstOutboundAt: string | null;
  lastOutboundAt: string | null;
  lastInboundAt: string | null;
  daysToFirstContact: number | null;
  timeToFirstContactBucket: OutreachTimeBucket | null;
  daysToMeetingBooked: number | null;
  timeToMeetingBucket: OutreachTimeBucket | null;
  daysFromConnectionToAccept: number | null;
  daysFromConnectionToMeeting: number | null;
} => {
  const timestamps = applyOutreachActionTimestamps({
    existing: parseOutreachActionTimestamps(existingTimestamps),
    event,
    nowIso,
    enrolledAt,
  });
  const flatMetrics = buildOutreachSpeedFlatMetrics(timestamps);

  return {
    outreachSpeedTimestamps: timestamps,
    firstOutboundAt: timestamps.firstOutboundAt ?? null,
    lastOutboundAt: timestamps.lastOutboundAt ?? null,
    lastInboundAt: timestamps.lastInboundAt ?? null,
    ...flatMetrics,
  };
};

/** @deprecated Use buildCandidateActionTimestampsUpdate */
export const buildCandidateSpeedMetricsUpdate = buildCandidateActionTimestampsUpdate;

export const backfillOutreachActionTimestampsFromCandidate = ({
  createdAt,
  firstOutboundAt,
  lastOutboundAt,
  lastInboundAt,
  updatedAt,
  outreachSequenceStage,
  existingTimestamps,
}: {
  createdAt?: string | null;
  firstOutboundAt?: string | null;
  lastOutboundAt?: string | null;
  lastInboundAt?: string | null;
  updatedAt?: string | null;
  outreachSequenceStage?: string | null;
  existingTimestamps?: unknown;
}): ReturnType<typeof buildCandidateActionTimestampsUpdate> => {
  const parsedExisting = parseOutreachActionTimestamps(existingTimestamps);
  const enrolledAt = parsedExisting?.enrolledAt ?? createdAt ?? null;
  const resolvedFirstOutboundAt =
    parsedExisting?.firstOutboundAt ?? firstOutboundAt ?? null;
  const resolvedLastOutboundAt =
    parsedExisting?.lastOutboundAt ?? lastOutboundAt ?? null;
  const resolvedLastInboundAt =
    parsedExisting?.lastInboundAt ?? lastInboundAt ?? null;
  const connectionSentAt =
    parsedExisting?.connectionSentAt ?? resolvedFirstOutboundAt ?? null;
  const firstContactAt =
    parsedExisting?.firstContactAt ??
    parsedExisting?.connectionAcceptedAt ??
    null;
  const meetingBookedAt =
    parsedExisting?.meetingBookedAt ??
    (outreachSequenceStage === 'MEETING_BOOKED'
      ? (resolvedLastOutboundAt ?? updatedAt ?? null)
      : null);

  const timestamps: OutreachActionTimestamps = {
    enrolledAt,
    connectionSentAt,
    connectionAcceptedAt: parsedExisting?.connectionAcceptedAt ?? null,
    meetingBookedAt,
    firstContactAt,
    firstOutboundAt: resolvedFirstOutboundAt,
    lastOutboundAt: resolvedLastOutboundAt,
    firstInboundAt: parsedExisting?.firstInboundAt ?? resolvedLastInboundAt,
    lastInboundAt: resolvedLastInboundAt,
    updatedAt: new Date().toISOString(),
  };

  if (
    !timestamps.connectionAcceptedAt &&
    outreachSequenceStage &&
    OUTREACH_SEQUENCE_STAGES_AFTER_CONNECTION_ACCEPTED.has(
      outreachSequenceStage,
    ) &&
    connectionSentAt
  ) {
    // Historical accepts lack webhook timestamps; keep null rather than guess.
  }

  const flatMetrics = buildOutreachSpeedFlatMetrics(timestamps);

  return {
    outreachSpeedTimestamps: timestamps,
    firstOutboundAt: timestamps.firstOutboundAt ?? null,
    lastOutboundAt: timestamps.lastOutboundAt ?? null,
    lastInboundAt: timestamps.lastInboundAt ?? null,
    ...flatMetrics,
  };
};

/** @deprecated Use backfillOutreachActionTimestampsFromCandidate */
export const backfillOutreachSpeedFromCandidate =
  backfillOutreachActionTimestampsFromCandidate;
