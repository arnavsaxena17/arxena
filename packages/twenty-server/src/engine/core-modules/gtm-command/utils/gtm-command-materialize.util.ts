export type GtmCoverageBucket = 'ZERO' | 'ONE_TWO' | 'THREE_PLUS';

export type GtmFunnelStage =
  | 'ADDED'
  | 'REACHED'
  | 'COVERED'
  | 'REPLIED'
  | 'MEETING_BOOKED'
  | 'MEETING_HELD'
  | 'OPPORTUNITY';

export type GtmOutreachSequenceStage =
  | 'QUEUED'
  | 'NEEDS_CONNECTION'
  | 'CONNECTION_SENT'
  | 'CONNECTION_ACCEPTED'
  | 'PROFILE_CHECKED'
  | 'WARM_PATH'
  | 'COMMENTED'
  | 'EMAIL_ENRICHING'
  | 'EMAIL_SENT'
  | 'INMAIL_SENT'
  | 'WHATSAPP_SENT'
  | 'REPLIED'
  | 'NEGOTIATING'
  | 'MEETING_BOOKED'
  | 'DEFERRED'
  | 'STOPPED'
  | 'FAILED_ENRICH'
  | 'FAILED_NO_REPLY';

export type GtmConnectionStatus = 'NONE' | 'SENT' | 'ACCEPTED' | 'IGNORED';

export type GtmEnrichStatus =
  | 'NOT_STARTED'
  | 'RUNNING'
  | 'FOUND'
  | 'FAILED';

export type GtmChannel =
  | 'LINKEDIN_CONNECT'
  | 'INMAIL'
  | 'COMMENT'
  | 'EMAIL'
  | 'WHATSAPP'
  | 'OTHER';

export type GtmAttentionReason =
  | 'NONE'
  | 'NO_REPLY'
  | 'CONNECT_IGNORE'
  | 'ENRICH_MISS'
  | 'STUCK_STAGE'
  | 'NEEDS_CONNECTION';

export type GtmOutreachSendMode = 'AUTO' | 'APPROVAL';

export const GTM_ACTIVE_OUTREACH_STAGES: GtmOutreachSequenceStage[] = [
  'QUEUED',
  'NEEDS_CONNECTION',
  'CONNECTION_SENT',
  'CONNECTION_ACCEPTED',
  'PROFILE_CHECKED',
  'WARM_PATH',
  'COMMENTED',
  'EMAIL_ENRICHING',
  'EMAIL_SENT',
  'INMAIL_SENT',
  'WHATSAPP_SENT',
  'NEGOTIATING',
];

export const isPersonGloballyStopped = ({
  doNotContact,
  unsubscribedAt,
  notInterestedAt,
  bounceCount,
}: {
  doNotContact?: boolean | null;
  unsubscribedAt?: string | null;
  notInterestedAt?: string | null;
  bounceCount?: number | null;
}): boolean => {
  if (doNotContact === true) {
    return true;
  }

  if (unsubscribedAt) {
    return true;
  }

  if (notInterestedAt) {
    return true;
  }

  return (bounceCount ?? 0) >= 2;
};

export const isCandidatePastQueued = (
  stage: string | null | undefined,
): boolean => {
  if (!stage || stage === 'QUEUED') {
    return false;
  }

  return true;
};

export const shouldBlockOutboundForCandidate = ({
  outreachSequenceStage,
  doNotContact,
  unsubscribedAt,
  notInterestedAt,
  bounceCount,
  oooUntil,
  nowIso = new Date().toISOString(),
}: {
  outreachSequenceStage?: string | null;
  doNotContact?: boolean | null;
  unsubscribedAt?: string | null;
  notInterestedAt?: string | null;
  bounceCount?: number | null;
  oooUntil?: string | null;
  nowIso?: string;
}): { blocked: boolean; reason: string | null } => {
  if (outreachSequenceStage === 'STOPPED') {
    return { blocked: true, reason: 'candidate_stopped' };
  }

  if (outreachSequenceStage === 'REPLIED' || outreachSequenceStage === 'MEETING_BOOKED') {
    return { blocked: true, reason: 'stop_on_reply' };
  }

  if (
    isPersonGloballyStopped({
      doNotContact,
      unsubscribedAt,
      notInterestedAt,
      bounceCount,
    })
  ) {
    return { blocked: true, reason: 'person_do_not_contact' };
  }

  if (oooUntil && Date.parse(oooUntil) > Date.parse(nowIso)) {
    return { blocked: true, reason: 'ooo' };
  }

  return { blocked: false, reason: null };
};

// High-level events that auto-updaters emit
export type GtmCandidateEventKind =
  | 'connection_sent'
  | 'connection_accepted'
  | 'connection_ignored'
  | 'profile_checked'
  | 'warm_path_found'
  | 'comment_posted'
  | 'enrich_started'
  | 'enrich_found'
  | 'enrich_failed'
  | 'outbound_message'
  | 'inbound_reply'
  | 'inbound_reply_flush'
  | 'meeting_booked'
  | 'meeting_held'
  | 'opportunity_created';

// Backward-compatible touch kinds used by existing call sites
export type GtmOutreachTouchKind =
  | 'outbound'
  | 'inbound'
  | 'meeting_booked'
  | 'meeting_held';

export const computeCoverageBucket = (
  peopleReached: number,
): GtmCoverageBucket => {
  if (peopleReached <= 0) {
    return 'ZERO';
  }

  if (peopleReached <= 2) {
    return 'ONE_TWO';
  }

  return 'THREE_PLUS';
};

export const computeDaysBetween = (
  fromIso: string | null | undefined,
  toIso: string | null | undefined = new Date().toISOString(),
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
): string | null => {
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

export const mapMessagingChannelToGtmChannel = (
  messagingChannel: string | null | undefined,
): GtmChannel => {
  const normalized = (messagingChannel ?? '').toLowerCase();

  if (normalized.includes('inmail')) {
    return 'INMAIL';
  }

  if (
    normalized.includes('connect') ||
    normalized.includes('invite') ||
    normalized === 'linkedin-connect' ||
    normalized === 'linkedin_connect'
  ) {
    return 'LINKEDIN_CONNECT';
  }

  if (normalized.includes('comment')) {
    return 'COMMENT';
  }

  if (normalized.includes('whatsapp') || normalized === 'baileys') {
    return 'WHATSAPP';
  }

  if (normalized.includes('email') || normalized.includes('gmail')) {
    return 'EMAIL';
  }

  // Plain LinkedIn DM / sock / premium — not a connection invite
  if (normalized.includes('linkedin')) {
    return 'OTHER';
  }

  return 'OTHER';
};

export const mapOutboundStageForChannel = (
  messagingChannel: string | null | undefined,
): GtmOutreachSequenceStage | null => {
  const channel = mapMessagingChannelToGtmChannel(messagingChannel);

  switch (channel) {
    case 'INMAIL':
      return 'INMAIL_SENT';
    case 'EMAIL':
      return 'EMAIL_SENT';
    case 'WHATSAPP':
      return 'WHATSAPP_SENT';
    case 'COMMENT':
      return 'COMMENTED';
    case 'LINKEDIN_CONNECT':
      return 'CONNECTION_SENT';
    default:
      // LinkedIn DMs and unknown channels only bump timestamps
      return null;
  }
};

const FUNNEL_ORDER: GtmFunnelStage[] = [
  'ADDED',
  'REACHED',
  'COVERED',
  'REPLIED',
  'MEETING_BOOKED',
  'MEETING_HELD',
  'OPPORTUNITY',
];

export const advanceFunnelStage = (
  current: GtmFunnelStage | string | null | undefined,
  target: GtmFunnelStage,
): GtmFunnelStage => {
  const currentIndex = FUNNEL_ORDER.indexOf(
    (current as GtmFunnelStage) ?? 'ADDED',
  );
  const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;
  const targetIndex = FUNNEL_ORDER.indexOf(target);

  return FUNNEL_ORDER[Math.max(safeCurrentIndex, targetIndex)];
};

export const funnelStageForEvent = (
  event: GtmCandidateEventKind,
): GtmFunnelStage => {
  switch (event) {
    case 'inbound_reply_flush':
    case 'inbound_reply':
      return 'REPLIED';
    case 'meeting_booked':
      return 'MEETING_BOOKED';
    case 'meeting_held':
      return 'MEETING_HELD';
    case 'opportunity_created':
      return 'OPPORTUNITY';
    case 'connection_sent':
    case 'connection_accepted':
    case 'outbound_message':
    case 'comment_posted':
    case 'enrich_found':
    case 'warm_path_found':
    case 'profile_checked':
      return 'REACHED';
    default:
      return 'ADDED';
  }
};

export const buildCandidateEventUpdate = ({
  event,
  nowIso = new Date().toISOString(),
  messagingChannel,
  existingFirstOutboundAt,
  classifiedOutreachStage,
}: {
  event: GtmCandidateEventKind;
  nowIso?: string;
  messagingChannel?: string | null;
  existingFirstOutboundAt?: string | null;
  classifiedOutreachStage?: string | null;
}): Record<string, unknown> => {
  switch (event) {
    case 'connection_sent':
      return {
        outreachSequenceStage: 'CONNECTION_SENT',
        connectionStatus: 'SENT',
        lastOutboundAt: nowIso,
        ...(existingFirstOutboundAt ? {} : { firstOutboundAt: nowIso }),
      };
    case 'connection_accepted':
      return {
        outreachSequenceStage: 'CONNECTION_ACCEPTED',
        connectionStatus: 'ACCEPTED',
      };
    case 'connection_ignored':
      return {
        connectionStatus: 'IGNORED',
      };
    case 'profile_checked':
      return {
        outreachSequenceStage: 'PROFILE_CHECKED',
      };
    case 'warm_path_found':
      return {
        outreachSequenceStage: 'WARM_PATH',
      };
    case 'comment_posted':
      return {
        outreachSequenceStage: 'COMMENTED',
        lastOutboundAt: nowIso,
        ...(existingFirstOutboundAt ? {} : { firstOutboundAt: nowIso }),
      };
    case 'enrich_started':
      return {
        outreachSequenceStage: 'EMAIL_ENRICHING',
        enrichStatus: 'RUNNING',
      };
    case 'enrich_found':
      return {
        enrichStatus: 'FOUND',
        enrichedAt: nowIso,
      };
    case 'enrich_failed':
      return {
        outreachSequenceStage: 'FAILED_ENRICH',
        enrichStatus: 'FAILED',
        enrichedAt: nowIso,
      };
    case 'outbound_message': {
      const outboundStage = mapOutboundStageForChannel(messagingChannel);

      return {
        ...(outboundStage ? { outreachSequenceStage: outboundStage } : {}),
        lastOutboundAt: nowIso,
        ...(existingFirstOutboundAt ? {} : { firstOutboundAt: nowIso }),
      };
    }
    case 'inbound_reply':
      return {
        lastInboundAt: nowIso,
      };
    case 'inbound_reply_flush':
      return {
        outreachSequenceStage: classifiedOutreachStage ?? 'REPLIED',
        lastInboundAt: nowIso,
      };
    case 'meeting_booked':
      return {
        outreachSequenceStage: 'MEETING_BOOKED',
        lastOutboundAt: nowIso,
      };
    case 'meeting_held':
      return {
        outreachSequenceStage: 'MEETING_BOOKED',
        lastInboundAt: nowIso,
      };
    case 'opportunity_created':
      return {
        outreachSequenceStage: 'MEETING_BOOKED',
      };
    default:
      return {};
  }
};

// Legacy helper kept for existing call sites
export const buildCandidateTouchUpdate = ({
  touch,
  nowIso = new Date().toISOString(),
  existingFirstOutboundAt,
  messagingChannel,
}: {
  touch: GtmOutreachTouchKind;
  nowIso?: string;
  existingFirstOutboundAt?: string | null;
  messagingChannel?: string | null;
}): Record<string, unknown> => {
  const eventByTouch: Record<GtmOutreachTouchKind, GtmCandidateEventKind> = {
    outbound: 'outbound_message',
    inbound: 'inbound_reply',
    meeting_booked: 'meeting_booked',
    meeting_held: 'meeting_held',
  };

  return buildCandidateEventUpdate({
    event: eventByTouch[touch],
    nowIso,
    existingFirstOutboundAt,
    messagingChannel,
  });
};

export const resolveCompanyIdFromCandidate = (candidate: {
  projects?: { companyId?: string; company?: { id?: string } } | null;
  people?: { companyId?: string; company?: { id?: string } } | null;
}): string | null =>
  candidate.projects?.companyId ??
  candidate.projects?.company?.id ??
  candidate.people?.companyId ??
  candidate.people?.company?.id ??
  null;

export const computeAttentionReason = ({
  connectionStatus,
  enrichStatus,
  outreachSequenceStage,
  daysSinceLastTouch,
  hasReply,
}: {
  connectionStatus?: string | null;
  enrichStatus?: string | null;
  outreachSequenceStage?: string | null;
  daysSinceLastTouch?: number | null;
  hasReply?: boolean;
}): GtmAttentionReason => {
  if (outreachSequenceStage === 'NEEDS_CONNECTION') {
    return 'NEEDS_CONNECTION';
  }

  if (connectionStatus === 'IGNORED') {
    return 'CONNECT_IGNORE';
  }

  if (enrichStatus === 'FAILED') {
    return 'ENRICH_MISS';
  }

  if (
    !hasReply &&
    (daysSinceLastTouch ?? 0) >= 7 &&
    outreachSequenceStage !== 'MEETING_BOOKED' &&
    outreachSequenceStage !== 'REPLIED'
  ) {
    return 'NO_REPLY';
  }

  if (
    (daysSinceLastTouch ?? 0) >= 5 &&
    !['MEETING_BOOKED', 'REPLIED', 'NEGOTIATING'].includes(
      outreachSequenceStage ?? '',
    )
  ) {
    return 'STUCK_STAGE';
  }

  return 'NONE';
};

export const normalizeLinkedinUrl = (url: string | null | undefined): string => {
  if (!url) {
    return '';
  }

  return url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '');
};
