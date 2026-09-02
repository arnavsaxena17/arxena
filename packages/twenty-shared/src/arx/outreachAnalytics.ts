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

export type OutreachAnalytics = {
  v: 1;
  enrolledAt?: string | null;
  connectionSentAt?: string | null;
  connectionAcceptedAt?: string | null;
  firstOutboundAt?: string | null;
  lastOutboundAt?: string | null;
  firstInboundAt?: string | null;
  lastInboundAt?: string | null;
  firstContactAt?: string | null;
  firstReplyAt?: string | null;
  meetingBookedAt?: string | null;
  meetingHeldAt?: string | null;
  daysToFirstContact?: number | null;
  daysToMeetingBooked?: number | null;
  daysFromConnectionToAccept?: number | null;
  daysFromConnectionToMeeting?: number | null;
  timeToFirstContactBucket?: OutreachTimeBucket | null;
  timeToMeetingBucket?: OutreachTimeBucket | null;
  peopleTargeted?: number | null;
  peopleReached?: number | null;
  coverageScore?: number | null;
  coverageBucket?: string | null;
  firstContactChannel?: string | null;
  channelsUsed?: string[] | null;
  lastOutboundMessageKind?: string | null;
  convertedOnMessageKind?: string | null;
  updatedAt?: string | null;
};

/** @deprecated Use OutreachAnalytics */
export type OutreachActionTimestamps = Omit<
  OutreachAnalytics,
  | 'v'
  | 'firstReplyAt'
  | 'peopleTargeted'
  | 'peopleReached'
  | 'coverageScore'
  | 'coverageBucket'
  | 'firstContactChannel'
  | 'channelsUsed'
  | 'lastOutboundMessageKind'
  | 'convertedOnMessageKind'
>;

/** @deprecated Use OutreachAnalytics */
export type OutreachSpeedTimestamps = OutreachActionTimestamps;

/** @deprecated Use OutreachAnalytics metrics fields */
export type OutreachSpeedFlatMetrics = Pick<
  OutreachAnalytics,
  | 'daysToFirstContact'
  | 'timeToFirstContactBucket'
  | 'daysToMeetingBooked'
  | 'timeToMeetingBucket'
  | 'daysFromConnectionToAccept'
  | 'daysFromConnectionToMeeting'
>;

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

const readIso = (
  record: Record<string, unknown>,
  key: keyof OutreachAnalytics,
): string | null => {
  const fieldValue = record[key as string];

  return typeof fieldValue === 'string' && fieldValue.length > 0
    ? fieldValue
    : null;
};

const readNumber = (
  record: Record<string, unknown>,
  key: keyof OutreachAnalytics,
): number | null => {
  const fieldValue = record[key as string];

  return typeof fieldValue === 'number' && Number.isFinite(fieldValue)
    ? fieldValue
    : null;
};

const readString = (
  record: Record<string, unknown>,
  key: keyof OutreachAnalytics,
): string | null => {
  const fieldValue = record[key as string];

  return typeof fieldValue === 'string' && fieldValue.length > 0
    ? fieldValue
    : null;
};

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

export const parseOutreachAnalytics = (
  value: unknown,
): OutreachAnalytics | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const channelsUsedRaw = record.channelsUsed;

  return {
    v: 1,
    enrolledAt: readIso(record, 'enrolledAt'),
    connectionSentAt: readIso(record, 'connectionSentAt'),
    connectionAcceptedAt: readIso(record, 'connectionAcceptedAt'),
    firstOutboundAt: readIso(record, 'firstOutboundAt'),
    lastOutboundAt: readIso(record, 'lastOutboundAt'),
    firstInboundAt: readIso(record, 'firstInboundAt'),
    lastInboundAt: readIso(record, 'lastInboundAt'),
    firstContactAt: readIso(record, 'firstContactAt'),
    firstReplyAt: readIso(record, 'firstReplyAt'),
    meetingBookedAt: readIso(record, 'meetingBookedAt'),
    meetingHeldAt: readIso(record, 'meetingHeldAt'),
    daysToFirstContact: readNumber(record, 'daysToFirstContact'),
    daysToMeetingBooked: readNumber(record, 'daysToMeetingBooked'),
    daysFromConnectionToAccept: readNumber(record, 'daysFromConnectionToAccept'),
    daysFromConnectionToMeeting: readNumber(record, 'daysFromConnectionToMeeting'),
    timeToFirstContactBucket: readString(
      record,
      'timeToFirstContactBucket',
    ) as OutreachTimeBucket | null,
    timeToMeetingBucket: readString(record, 'timeToMeetingBucket') as
      | OutreachTimeBucket
      | null,
    peopleTargeted: readNumber(record, 'peopleTargeted'),
    peopleReached: readNumber(record, 'peopleReached'),
    coverageScore: readNumber(record, 'coverageScore'),
    coverageBucket: readString(record, 'coverageBucket'),
    firstContactChannel: readString(record, 'firstContactChannel'),
    channelsUsed: Array.isArray(channelsUsedRaw)
      ? channelsUsedRaw.filter(
          (channel): channel is string => typeof channel === 'string',
        )
      : null,
    lastOutboundMessageKind: readString(record, 'lastOutboundMessageKind'),
    convertedOnMessageKind: readString(record, 'convertedOnMessageKind'),
    updatedAt: readIso(record, 'updatedAt'),
  };
};

/** @deprecated Use parseOutreachAnalytics */
export const parseOutreachActionTimestamps = (
  value: unknown,
): OutreachActionTimestamps | null => parseOutreachAnalytics(value);

/** @deprecated Use parseOutreachAnalytics */
export const parseOutreachSpeedTimestamps = parseOutreachAnalytics;

const OUTREACH_ANALYTICS_ISO_FIELD_KEYS = [
  'enrolledAt',
  'connectionSentAt',
  'connectionAcceptedAt',
  'firstOutboundAt',
  'lastOutboundAt',
  'firstInboundAt',
  'lastInboundAt',
  'firstContactAt',
  'firstReplyAt',
  'meetingBookedAt',
  'meetingHeldAt',
  'updatedAt',
] as const;

type OutreachAnalyticsIsoFieldKey =
  (typeof OUTREACH_ANALYTICS_ISO_FIELD_KEYS)[number];

const resolveFromAnalytics = (
  analytics: unknown,
  key: OutreachAnalyticsIsoFieldKey,
  flatFallback?: string | null,
): string | null => {
  const fieldValue = parseOutreachAnalytics(analytics)?.[key];

  return typeof fieldValue === 'string' && fieldValue.length > 0
    ? fieldValue
    : (flatFallback ?? null);
};

export const resolveOutreachFirstOutboundAt = (
  analytics: unknown,
  flatFallback?: string | null,
): string | null =>
  resolveFromAnalytics(analytics, 'firstOutboundAt', flatFallback);

export const resolveOutreachLastOutboundAt = (
  analytics: unknown,
  flatFallback?: string | null,
): string | null =>
  resolveFromAnalytics(analytics, 'lastOutboundAt', flatFallback);

export const resolveOutreachFirstContactAt = (
  analytics: unknown,
  flatFallback?: string | null,
): string | null => {
  const parsed = parseOutreachAnalytics(analytics);

  return (
    parsed?.firstContactAt ??
    parsed?.connectionAcceptedAt ??
    flatFallback ??
    null
  );
};

export const resolveOutreachFirstInboundAt = (
  analytics: unknown,
  flatFallback?: string | null,
): string | null =>
  resolveFromAnalytics(analytics, 'firstInboundAt', flatFallback);

export const resolveOutreachLastInboundAt = (
  analytics: unknown,
  flatFallback?: string | null,
): string | null =>
  resolveFromAnalytics(analytics, 'lastInboundAt', flatFallback);

export const resolveOutreachMeetingBookedAt = (
  analytics: unknown,
  flatFallback?: string | null,
): string | null =>
  resolveFromAnalytics(analytics, 'meetingBookedAt', flatFallback);

export const buildOutreachAnalyticsMetrics = (
  analytics: Omit<OutreachAnalytics, 'v'>,
): OutreachSpeedFlatMetrics => {
  const firstContactAt =
    analytics.firstContactAt ?? analytics.connectionAcceptedAt ?? null;

  const daysToFirstContact = computeDaysBetween(
    analytics.enrolledAt,
    firstContactAt,
  );
  const daysToMeetingBooked = computeDaysBetween(
    analytics.enrolledAt,
    analytics.meetingBookedAt,
  );
  const daysFromConnectionToAccept = computeDaysBetween(
    analytics.connectionSentAt,
    analytics.connectionAcceptedAt,
  );
  const daysFromConnectionToMeeting = computeDaysBetween(
    analytics.connectionSentAt,
    analytics.meetingBookedAt,
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

/** @deprecated Use buildOutreachAnalyticsMetrics */
export const buildOutreachSpeedFlatMetrics = (
  timestamps: OutreachActionTimestamps,
): OutreachSpeedFlatMetrics => buildOutreachAnalyticsMetrics(timestamps);

export const applyOutreachAnalyticsEvent = ({
  existing,
  event,
  nowIso,
  enrolledAt,
  outboundMessageKind,
  existingConvertedOnMessageKind,
  existingLastOutboundMessageKind,
}: {
  existing: OutreachAnalytics | null | undefined;
  event: OutreachActionTimestampsEventKind;
  nowIso: string;
  enrolledAt?: string | null;
  outboundMessageKind?: string | null;
  existingConvertedOnMessageKind?: string | null;
  existingLastOutboundMessageKind?: string | null;
}): OutreachAnalytics => {
  const base: Omit<OutreachAnalytics, 'v'> = {
    enrolledAt: existing?.enrolledAt ?? enrolledAt ?? null,
    connectionSentAt: existing?.connectionSentAt ?? null,
    connectionAcceptedAt: existing?.connectionAcceptedAt ?? null,
    meetingBookedAt: existing?.meetingBookedAt ?? null,
    firstContactAt: existing?.firstContactAt ?? null,
    firstOutboundAt: existing?.firstOutboundAt ?? null,
    lastOutboundAt: existing?.lastOutboundAt ?? null,
    firstInboundAt: existing?.firstInboundAt ?? null,
    lastInboundAt: existing?.lastInboundAt ?? null,
    firstReplyAt: existing?.firstReplyAt ?? null,
    meetingHeldAt: existing?.meetingHeldAt ?? null,
    lastOutboundMessageKind:
      existing?.lastOutboundMessageKind ??
      existingLastOutboundMessageKind ??
      null,
    convertedOnMessageKind:
      existing?.convertedOnMessageKind ?? existingConvertedOnMessageKind ?? null,
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
      next = {
        ...next,
        connectionSentAt: next.connectionSentAt ?? nowIso,
        lastOutboundMessageKind:
          outboundMessageKind ?? next.lastOutboundMessageKind ?? 'CONNECT_NOTE',
      };
      break;
    case 'connection_accepted':
      next = {
        ...next,
        connectionAcceptedAt: next.connectionAcceptedAt ?? nowIso,
        firstContactAt: next.firstContactAt ?? nowIso,
      };
      break;
    case 'comment_posted':
    case 'outbound_message':
      next = {
        ...next,
        firstContactAt: next.firstContactAt ?? nowIso,
        ...(outboundMessageKind
          ? { lastOutboundMessageKind: outboundMessageKind }
          : {}),
      };
      break;
    case 'inbound_reply':
    case 'inbound_reply_flush':
      next = {
        ...next,
        firstReplyAt: next.firstReplyAt ?? nowIso,
        ...(!next.convertedOnMessageKind && next.lastOutboundMessageKind
          ? { convertedOnMessageKind: next.lastOutboundMessageKind }
          : {}),
      };
      break;
    case 'meeting_booked':
      next = {
        ...next,
        meetingBookedAt: next.meetingBookedAt ?? nowIso,
        ...(!next.convertedOnMessageKind && next.lastOutboundMessageKind
          ? { convertedOnMessageKind: next.lastOutboundMessageKind }
          : {}),
      };
      break;
    case 'meeting_held':
      next = {
        ...next,
        meetingBookedAt: next.meetingBookedAt ?? nowIso,
        meetingHeldAt: next.meetingHeldAt ?? nowIso,
      };
      break;
    default:
      break;
  }

  const metrics = buildOutreachAnalyticsMetrics(next);

  return {
    v: 1,
    ...next,
    ...metrics,
  };
};

/** @deprecated Use applyOutreachAnalyticsEvent */
export const applyOutreachActionTimestamps = applyOutreachAnalyticsEvent;

/** @deprecated Use applyOutreachAnalyticsEvent */
export const applyOutreachSpeedEvent = applyOutreachAnalyticsEvent;

export const buildCandidateAnalyticsUpdate = ({
  existingAnalytics,
  event,
  nowIso = new Date().toISOString(),
  enrolledAt,
  outboundMessageKind,
  existingConvertedOnMessageKind,
  existingLastOutboundMessageKind,
}: {
  existingAnalytics: unknown;
  event: OutreachActionTimestampsEventKind;
  nowIso?: string;
  enrolledAt?: string | null;
  outboundMessageKind?: string | null;
  existingConvertedOnMessageKind?: string | null;
  existingLastOutboundMessageKind?: string | null;
}): { outreachAnalytics: OutreachAnalytics } => ({
  outreachAnalytics: applyOutreachAnalyticsEvent({
    existing: parseOutreachAnalytics(existingAnalytics),
    event,
    nowIso,
    enrolledAt,
    outboundMessageKind,
    existingConvertedOnMessageKind,
    existingLastOutboundMessageKind,
  }),
});

/** @deprecated Use buildCandidateAnalyticsUpdate */
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
  outreachAnalytics: OutreachAnalytics;
  outreachSpeedTimestamps: OutreachActionTimestamps;
} => {
  const update = buildCandidateAnalyticsUpdate({
    existingAnalytics: existingTimestamps,
    event,
    nowIso,
    enrolledAt,
  });

  return {
    outreachAnalytics: update.outreachAnalytics,
    outreachSpeedTimestamps: update.outreachAnalytics,
  };
};

/** @deprecated Use buildCandidateAnalyticsUpdate */
export const buildCandidateSpeedMetricsUpdate = buildCandidateActionTimestampsUpdate;

export const mergeLegacyCandidateFieldsIntoAnalytics = ({
  existingAnalytics,
  createdAt,
  firstOutboundAt,
  lastOutboundAt,
  lastInboundAt,
  lastOutboundMessageKind,
  convertedOnMessageKind,
  daysToFirstContact,
  daysToMeetingBooked,
  daysFromConnectionToAccept,
  daysFromConnectionToMeeting,
  timeToFirstContactBucket,
  timeToMeetingBucket,
  outreachSequenceStage,
}: {
  existingAnalytics?: unknown;
  createdAt?: string | null;
  firstOutboundAt?: string | null;
  lastOutboundAt?: string | null;
  lastInboundAt?: string | null;
  lastOutboundMessageKind?: string | null;
  convertedOnMessageKind?: string | null;
  daysToFirstContact?: number | null;
  daysToMeetingBooked?: number | null;
  daysFromConnectionToAccept?: number | null;
  daysFromConnectionToMeeting?: number | null;
  timeToFirstContactBucket?: OutreachTimeBucket | null;
  timeToMeetingBucket?: OutreachTimeBucket | null;
  outreachSequenceStage?: string | null;
}): OutreachAnalytics => {
  const parsedExisting = parseOutreachAnalytics(existingAnalytics);
  const enrolledAt = parsedExisting?.enrolledAt ?? createdAt ?? null;
  const resolvedFirstOutboundAt =
    parsedExisting?.firstOutboundAt ?? firstOutboundAt ?? null;
  const resolvedLastOutboundAt =
    parsedExisting?.lastOutboundAt ?? lastOutboundAt ?? null;
  const resolvedLastInboundAt =
    parsedExisting?.lastInboundAt ?? lastInboundAt ?? null;
  const connectionSentAt =
    parsedExisting?.connectionSentAt ?? resolvedFirstOutboundAt ?? null;
  const meetingBookedAt =
    parsedExisting?.meetingBookedAt ??
    (outreachSequenceStage === 'MEETING_BOOKED'
      ? (resolvedLastOutboundAt ?? null)
      : null);

  const merged: Omit<OutreachAnalytics, 'v'> = {
    enrolledAt,
    connectionSentAt,
    connectionAcceptedAt: parsedExisting?.connectionAcceptedAt ?? null,
    meetingBookedAt,
    firstContactAt: parsedExisting?.firstContactAt ?? null,
    firstOutboundAt: resolvedFirstOutboundAt,
    lastOutboundAt: resolvedLastOutboundAt,
    firstInboundAt: parsedExisting?.firstInboundAt ?? resolvedLastInboundAt,
    lastInboundAt: resolvedLastInboundAt,
    firstReplyAt: parsedExisting?.firstReplyAt ?? null,
    meetingHeldAt: parsedExisting?.meetingHeldAt ?? null,
    lastOutboundMessageKind:
      parsedExisting?.lastOutboundMessageKind ?? lastOutboundMessageKind ?? null,
    convertedOnMessageKind:
      parsedExisting?.convertedOnMessageKind ?? convertedOnMessageKind ?? null,
    updatedAt: new Date().toISOString(),
    daysToFirstContact:
      parsedExisting?.daysToFirstContact ?? daysToFirstContact ?? null,
    daysToMeetingBooked:
      parsedExisting?.daysToMeetingBooked ?? daysToMeetingBooked ?? null,
    daysFromConnectionToAccept:
      parsedExisting?.daysFromConnectionToAccept ??
      daysFromConnectionToAccept ??
      null,
    daysFromConnectionToMeeting:
      parsedExisting?.daysFromConnectionToMeeting ??
      daysFromConnectionToMeeting ??
      null,
    timeToFirstContactBucket:
      parsedExisting?.timeToFirstContactBucket ??
      timeToFirstContactBucket ??
      null,
    timeToMeetingBucket:
      parsedExisting?.timeToMeetingBucket ?? timeToMeetingBucket ?? null,
  };

  const metrics = buildOutreachAnalyticsMetrics(merged);

  return {
    v: 1,
    ...merged,
    ...metrics,
  };
};

/** @deprecated Use mergeLegacyCandidateFieldsIntoAnalytics */
export const backfillOutreachActionTimestampsFromCandidate = (
  params: Parameters<typeof mergeLegacyCandidateFieldsIntoAnalytics>[0],
): { outreachAnalytics: OutreachAnalytics; outreachSpeedTimestamps: OutreachAnalytics } => {
  const outreachAnalytics = mergeLegacyCandidateFieldsIntoAnalytics(params);

  return { outreachAnalytics, outreachSpeedTimestamps: outreachAnalytics };
};

/** @deprecated Use mergeLegacyCandidateFieldsIntoAnalytics */
export const backfillOutreachSpeedFromCandidate =
  backfillOutreachActionTimestampsFromCandidate;

export const mergeLegacyCompanyFieldsIntoAnalytics = ({
  existingAnalytics,
  createdAt,
  peopleTargeted,
  peopleReached,
  coverageScore,
  coverageBucket,
  channelsUsed,
  firstContactAt,
  firstReplyAt,
  meetingBookedAt,
  meetingHeldAt,
  daysToFirstContact,
  daysToMeetingBooked,
  timeToFirstContactBucket,
  timeToMeetingBucket,
  firstContactChannel,
}: {
  existingAnalytics?: unknown;
  createdAt?: string | null;
  peopleTargeted?: number | null;
  peopleReached?: number | null;
  coverageScore?: number | null;
  coverageBucket?: string | null;
  channelsUsed?: string[] | null;
  firstContactAt?: string | null;
  firstReplyAt?: string | null;
  meetingBookedAt?: string | null;
  meetingHeldAt?: string | null;
  daysToFirstContact?: number | null;
  daysToMeetingBooked?: number | null;
  timeToFirstContactBucket?: OutreachTimeBucket | null;
  timeToMeetingBucket?: OutreachTimeBucket | null;
  firstContactChannel?: string | null;
}): OutreachAnalytics => {
  const parsedExisting = parseOutreachAnalytics(existingAnalytics);

  const merged: Omit<OutreachAnalytics, 'v'> = {
    enrolledAt: parsedExisting?.enrolledAt ?? createdAt ?? null,
    connectionSentAt: parsedExisting?.connectionSentAt ?? null,
    connectionAcceptedAt: parsedExisting?.connectionAcceptedAt ?? null,
    firstOutboundAt: parsedExisting?.firstOutboundAt ?? null,
    lastOutboundAt: parsedExisting?.lastOutboundAt ?? null,
    firstInboundAt: parsedExisting?.firstInboundAt ?? null,
    lastInboundAt: parsedExisting?.lastInboundAt ?? null,
    firstContactAt: parsedExisting?.firstContactAt ?? firstContactAt ?? null,
    firstReplyAt: parsedExisting?.firstReplyAt ?? firstReplyAt ?? null,
    meetingBookedAt:
      parsedExisting?.meetingBookedAt ?? meetingBookedAt ?? null,
    meetingHeldAt: parsedExisting?.meetingHeldAt ?? meetingHeldAt ?? null,
    peopleTargeted: parsedExisting?.peopleTargeted ?? peopleTargeted ?? null,
    peopleReached: parsedExisting?.peopleReached ?? peopleReached ?? null,
    coverageScore: parsedExisting?.coverageScore ?? coverageScore ?? null,
    coverageBucket: parsedExisting?.coverageBucket ?? coverageBucket ?? null,
    firstContactChannel:
      parsedExisting?.firstContactChannel ?? firstContactChannel ?? null,
    channelsUsed: parsedExisting?.channelsUsed ?? channelsUsed ?? null,
    lastOutboundMessageKind: parsedExisting?.lastOutboundMessageKind ?? null,
    convertedOnMessageKind: parsedExisting?.convertedOnMessageKind ?? null,
    updatedAt: new Date().toISOString(),
    daysToFirstContact:
      parsedExisting?.daysToFirstContact ?? daysToFirstContact ?? null,
    daysToMeetingBooked:
      parsedExisting?.daysToMeetingBooked ?? daysToMeetingBooked ?? null,
    timeToFirstContactBucket:
      parsedExisting?.timeToFirstContactBucket ??
      timeToFirstContactBucket ??
      null,
    timeToMeetingBucket:
      parsedExisting?.timeToMeetingBucket ?? timeToMeetingBucket ?? null,
    daysFromConnectionToAccept: parsedExisting?.daysFromConnectionToAccept ?? null,
    daysFromConnectionToMeeting:
      parsedExisting?.daysFromConnectionToMeeting ?? null,
  };

  const metrics = buildOutreachAnalyticsMetrics(merged);

  return {
    v: 1,
    ...merged,
    daysToFirstContact: merged.daysToFirstContact ?? metrics.daysToFirstContact,
    daysToMeetingBooked:
      merged.daysToMeetingBooked ?? metrics.daysToMeetingBooked,
    timeToFirstContactBucket:
      merged.timeToFirstContactBucket ?? metrics.timeToFirstContactBucket,
    timeToMeetingBucket:
      merged.timeToMeetingBucket ?? metrics.timeToMeetingBucket,
  };
};

export const buildCompanyAnalyticsRollup = ({
  existingAnalytics,
  companyCreatedAt,
  peopleTargeted,
  peopleReached,
  coverageScore,
  coverageBucket,
  channelsUsed,
  firstContactAt,
  firstReplyAt,
  meetingBookedAt,
  meetingHeldAt,
  firstContactChannel,
}: {
  existingAnalytics?: unknown;
  companyCreatedAt?: string | null;
  peopleTargeted: number;
  peopleReached: number;
  coverageScore: number;
  coverageBucket: string;
  channelsUsed: string[];
  firstContactAt: string | null;
  firstReplyAt: string | null;
  meetingBookedAt: string | null;
  meetingHeldAt: string | null;
  firstContactChannel: string | null;
}): { outreachAnalytics: OutreachAnalytics } => {
  const daysToFirstContact = computeDaysBetween(
    companyCreatedAt,
    firstContactAt,
  );
  const daysToMeetingBooked = computeDaysBetween(
    companyCreatedAt,
    meetingBookedAt,
  );

  return {
    outreachAnalytics: mergeLegacyCompanyFieldsIntoAnalytics({
      existingAnalytics,
      createdAt: companyCreatedAt,
      peopleTargeted,
      peopleReached,
      coverageScore,
      coverageBucket,
      channelsUsed,
      firstContactAt,
      firstReplyAt,
      meetingBookedAt,
      meetingHeldAt,
      daysToFirstContact,
      daysToMeetingBooked,
      timeToFirstContactBucket: computeTimeBucket(daysToFirstContact),
      timeToMeetingBucket: computeTimeBucket(daysToMeetingBooked),
      firstContactChannel,
    }),
  };
};
