const OUTREACH_ANALYTICS_CANDIDATE_JSON_PATH_KEYS = [
  'enrolledAt',
  'connectionSentAt',
  'connectionAcceptedAt',
  'meetingBookedAt',
  'firstContactAt',
  'firstOutboundAt',
  'lastOutboundAt',
  'firstInboundAt',
  'lastInboundAt',
  'updatedAt',
  'daysToFirstContact',
  'timeToFirstContactBucket',
  'daysToMeetingBooked',
  'timeToMeetingBucket',
  'daysFromConnectionToAccept',
  'daysFromConnectionToMeeting',
  'lastOutboundMessageKind',
  'convertedOnMessageKind',
  'resumeAt',
  'stageBeforeDefer',
] as const;

const OUTREACH_ANALYTICS_COMPANY_JSON_PATH_KEYS = [
  ...OUTREACH_ANALYTICS_CANDIDATE_JSON_PATH_KEYS,
  'firstReplyAt',
  'meetingHeldAt',
  'peopleTargeted',
  'peopleReached',
  'coverageScore',
  'coverageBucket',
  'firstContactChannel',
  'channelsUsed',
] as const;

const OUTREACH_CONFIG_JSON_PATH_KEYS = [
  'maxPersonasPerCompany',
  'inMailFallbackEnabled',
  'sendTimezone',
  'sendWindowStart',
  'sendWindowEnd',
  'sendWindowDays',
  'updatedAt',
] as const;

const KNOWN_RAW_JSON_PATH_KEYS_BY_FIELD_NAME: Record<string, readonly string[]> =
  {
    outreachSpeedTimestamps: OUTREACH_ANALYTICS_CANDIDATE_JSON_PATH_KEYS,
    // Candidate and company both use outreachAnalytics; company keys are a
    // superset of candidate keys, so one list covers both objects.
    outreachAnalytics: OUTREACH_ANALYTICS_COMPANY_JSON_PATH_KEYS,
    outreachConfig: OUTREACH_CONFIG_JSON_PATH_KEYS,
  };

export const getKnownRawJsonPathKeysForField = (
  fieldName: string,
): readonly string[] | undefined =>
  KNOWN_RAW_JSON_PATH_KEYS_BY_FIELD_NAME[fieldName];
