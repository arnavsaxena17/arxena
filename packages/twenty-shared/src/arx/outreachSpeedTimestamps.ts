/** @deprecated Import from outreachAnalytics instead */
export type {
  OutreachTimeBucket,
  OutreachActionTimestampsEventKind,
  OutreachSpeedEventKind,
  OutreachAnalytics,
  OutreachActionTimestamps,
  OutreachSpeedTimestamps,
  OutreachSpeedFlatMetrics,
} from './outreachAnalytics';

/** @deprecated Import from outreachAnalytics instead */
export {
  computeDaysBetween,
  computeTimeBucket,
  parseOutreachAnalytics,
  parseOutreachActionTimestamps,
  parseOutreachSpeedTimestamps,
  resolveOutreachFirstOutboundAt,
  resolveOutreachLastOutboundAt,
  resolveOutreachFirstContactAt,
  resolveOutreachFirstInboundAt,
  resolveOutreachLastInboundAt,
  resolveOutreachMeetingBookedAt,
  buildOutreachAnalyticsMetrics,
  buildOutreachSpeedFlatMetrics,
  applyOutreachAnalyticsEvent,
  applyOutreachActionTimestamps,
  applyOutreachSpeedEvent,
  buildCandidateAnalyticsUpdate,
  buildCandidateActionTimestampsUpdate,
  buildCandidateSpeedMetricsUpdate,
  mergeLegacyCandidateFieldsIntoAnalytics,
  backfillOutreachActionTimestampsFromCandidate,
  backfillOutreachSpeedFromCandidate,
  mergeLegacyCompanyFieldsIntoAnalytics,
  buildCompanyAnalyticsRollup,
} from './outreachAnalytics';
