import {
  MessagingChannel,
  normalizeMessagingChannel,
  type OutreachActionTimestampsEventKind,
} from 'twenty-shared/arx';

export type OutreachCoverageBucket = 'ZERO' | 'ONE_TWO' | 'THREE_PLUS';

export type OutreachFunnelStage =
  | 'ADDED'
  | 'REACHED'
  | 'COVERED'
  | 'REPLIED'
  | 'MEETING_BOOKED'
  | 'MEETING_HELD'
  | 'OPPORTUNITY';

export type OutreachSequenceStage =
  | 'QUEUED'
  | 'NEEDS_CONNECTION'
  | 'CONNECTION_SENT'
  | 'CONNECTION_ACCEPTED'
  | 'CONNECTION_IGNORED'
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

export type OutreachConnectionStatus = 'NONE' | 'SENT' | 'ACCEPTED' | 'IGNORED';

export type OutreachEnrichStatus =
  | 'NOT_STARTED'
  | 'RUNNING'
  | 'FOUND'
  | 'FAILED';

export type OutreachChannel =
  | 'LINKEDIN_CONNECT'
  | 'INMAIL'
  | 'COMMENT'
  | 'EMAIL'
  | 'WHATSAPP'
  | 'OTHER';

export type OutreachAttentionReason =
  | 'NONE'
  | 'NO_REPLY'
  | 'CONNECT_IGNORE'
  | 'ENRICH_MISS'
  | 'STUCK_STAGE'
  | 'NEEDS_CONNECTION';

export type OutreachSendMode = 'AUTO' | 'APPROVAL';

export const OUTREACH_ACTIVE_OUTREACH_STAGES: OutreachSequenceStage[] = [
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

export const isCandidatePastQueued = (
  stage: string | null | undefined,
): boolean => {
  if (!stage || stage === 'QUEUED') {
    return false;
  }

  return true;
};

export const OUTREACH_STAGES_THAT_IMPLY_OUTBOUND: readonly OutreachSequenceStage[] =
  [
    'CONNECTION_SENT',
    'CONNECTION_ACCEPTED',
    'CONNECTION_IGNORED',
    'COMMENTED',
    'EMAIL_ENRICHING',
    'EMAIL_SENT',
    'INMAIL_SENT',
    'WHATSAPP_SENT',
    'REPLIED',
    'NEGOTIATING',
    'MEETING_BOOKED',
    'FAILED_ENRICH',
    'FAILED_NO_REPLY',
  ];

export const OUTREACH_STAGES_THAT_IMPLY_CONNECTION_REQUEST_SENT: readonly OutreachSequenceStage[] =
  ['CONNECTION_SENT', 'CONNECTION_ACCEPTED'];

export const candidateStageImpliesConnectionRequestSent = (
  stage: string | null | undefined,
): boolean =>
  Boolean(
    stage &&
      OUTREACH_STAGES_THAT_IMPLY_CONNECTION_REQUEST_SENT.includes(
        stage as OutreachSequenceStage,
      ),
  );

export const candidateStageImpliesOutbound = (
  stage: string | null | undefined,
): boolean =>
  Boolean(
    stage &&
      OUTREACH_STAGES_THAT_IMPLY_OUTBOUND.includes(
        stage as OutreachSequenceStage,
      ),
  );

export const COVERED_PEOPLE_REACHED_THRESHOLD = 3;

// High-level events that auto-updaters emit
export type OutreachCandidateEventKind =
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
export type OutreachTouchKind =
  | 'outbound'
  | 'inbound'
  | 'meeting_booked'
  | 'meeting_held';

export const computeCoverageBucket = (
  peopleReached: number,
): OutreachCoverageBucket => {
  if (peopleReached <= 0) {
    return 'ZERO';
  }

  if (peopleReached <= 2) {
    return 'ONE_TWO';
  }

  return 'THREE_PLUS';
};

export {
  computeDaysBetween,
  computeTimeBucket,
} from 'twenty-shared/arx';

export const mapCandidateEventToOutreachActionTimestampsEvent = (
  event: OutreachCandidateEventKind,
): OutreachActionTimestampsEventKind | null => {
  switch (event) {
    case 'connection_sent':
    case 'connection_accepted':
    case 'comment_posted':
    case 'outbound_message':
    case 'inbound_reply':
    case 'inbound_reply_flush':
    case 'meeting_booked':
    case 'meeting_held':
      return event;
    default:
      return null;
  }
};

/** @deprecated Use mapCandidateEventToOutreachActionTimestampsEvent */
export const mapCandidateEventToOutreachSpeedEvent =
  mapCandidateEventToOutreachActionTimestampsEvent;

export const mapMessagingChannelToOutreachChannel = (
  messagingChannel: string | null | undefined,
): OutreachChannel => {
  const normalized = normalizeMessagingChannel(messagingChannel);

  switch (normalized) {
    case MessagingChannel.LINKEDIN_INMAIL:
      return 'INMAIL';
    case MessagingChannel.LINKEDIN_CONNECT:
      return 'LINKEDIN_CONNECT';
    case MessagingChannel.COMMENT:
      return 'COMMENT';
    case MessagingChannel.EMAIL:
      return 'EMAIL';
    case MessagingChannel.BAILEYS:
    case MessagingChannel.WHATSAPP_UNIPILE:
    case MessagingChannel.WHATSAPP_WEB:
    case MessagingChannel.WHATSAPP_OFFICIAL:
      return 'WHATSAPP';
    default:
      return 'OTHER';
  }
};

export const mapOutboundStageForChannel = (
  messagingChannel: string | null | undefined,
): OutreachSequenceStage | null => {
  const channel = mapMessagingChannelToOutreachChannel(messagingChannel);

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

const FUNNEL_ORDER: OutreachFunnelStage[] = [
  'ADDED',
  'REACHED',
  'COVERED',
  'REPLIED',
  'MEETING_BOOKED',
  'MEETING_HELD',
  'OPPORTUNITY',
];

export const advanceFunnelStage = (
  current: OutreachFunnelStage | string | null | undefined,
  target: OutreachFunnelStage,
): OutreachFunnelStage => {
  const currentIndex = FUNNEL_ORDER.indexOf(
    (current as OutreachFunnelStage) ?? 'ADDED',
  );
  const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;
  const targetIndex = FUNNEL_ORDER.indexOf(target);

  return FUNNEL_ORDER[Math.max(safeCurrentIndex, targetIndex)];
};

export const funnelStageForEvent = (
  event: OutreachCandidateEventKind,
): OutreachFunnelStage => {
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

export const rollupOutreachFunnelStage = ({
  current,
  event,
  peopleReached,
}: {
  current: OutreachFunnelStage | string | null | undefined;
  event: OutreachCandidateEventKind;
  peopleReached: number;
}): OutreachFunnelStage => {
  const stage = advanceFunnelStage(current, funnelStageForEvent(event));

  if (peopleReached >= COVERED_PEOPLE_REACHED_THRESHOLD) {
    return advanceFunnelStage(stage, 'COVERED');
  }

  if (peopleReached >= 1) {
    return advanceFunnelStage(stage, 'REACHED');
  }

  return stage;
};

export const buildCandidateEventUpdate = ({
  event,
  nowIso = new Date().toISOString(),
  messagingChannel,
  existingFirstOutboundAt,
  classifiedOutreachStage,
  outboundMessageKind,
  existingConvertedOnMessageKind,
  existingLastOutboundMessageKind,
}: {
  event: OutreachCandidateEventKind;
  nowIso?: string;
  messagingChannel?: string | null;
  existingFirstOutboundAt?: string | null;
  classifiedOutreachStage?: string | null;
  outboundMessageKind?: string | null;
  existingConvertedOnMessageKind?: string | null;
  existingLastOutboundMessageKind?: string | null;
}): Record<string, unknown> => {
  switch (event) {
    case 'connection_sent':
      return {
        outreachSequenceStage: 'CONNECTION_SENT',
        ...(outboundMessageKind
          ? { lastOutboundMessageKind: outboundMessageKind }
          : { lastOutboundMessageKind: 'CONNECT_NOTE' }),
      };
    case 'connection_accepted':
      return {
        outreachSequenceStage: 'CONNECTION_ACCEPTED',
      };
    case 'connection_ignored':
      return {
        outreachSequenceStage: 'CONNECTION_IGNORED',
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
      };
    case 'enrich_started':
      return {
        outreachSequenceStage: 'EMAIL_ENRICHING',
        enrichStatus: 'RUNNING',
      };
    case 'enrich_found':
      return {
        enrichStatus: 'FOUND',
      };
    case 'enrich_failed':
      return {
        outreachSequenceStage: 'FAILED_ENRICH',
        enrichStatus: 'FAILED',
      };
    case 'outbound_message': {
      const outboundStage = mapOutboundStageForChannel(messagingChannel);

      return {
        ...(outboundStage ? { outreachSequenceStage: outboundStage } : {}),
        ...(outboundMessageKind
          ? { lastOutboundMessageKind: outboundMessageKind }
          : {}),
      };
    }
    case 'inbound_reply':
      return {};
    case 'inbound_reply_flush':
      return {
        outreachSequenceStage: classifiedOutreachStage ?? 'REPLIED',
        // First real inbound only — skip if already stamped (accept is separate).
        ...(!existingConvertedOnMessageKind && existingLastOutboundMessageKind
          ? { convertedOnMessageKind: existingLastOutboundMessageKind }
          : {}),
      };
    case 'meeting_booked':
      return {
        outreachSequenceStage: 'MEETING_BOOKED',
        ...(!existingConvertedOnMessageKind && existingLastOutboundMessageKind
          ? { convertedOnMessageKind: existingLastOutboundMessageKind }
          : {}),
      };
    case 'meeting_held':
      return {
        outreachSequenceStage: 'MEETING_BOOKED',
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
  touch: OutreachTouchKind;
  nowIso?: string;
  existingFirstOutboundAt?: string | null;
  messagingChannel?: string | null;
}): Record<string, unknown> => {
  const eventByTouch: Record<OutreachTouchKind, OutreachCandidateEventKind> = {
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
  enrichStatus,
  outreachSequenceStage,
  daysSinceLastTouch,
  hasReply,
}: {
  enrichStatus?: string | null;
  outreachSequenceStage?: string | null;
  daysSinceLastTouch?: number | null;
  hasReply?: boolean;
}): OutreachAttentionReason => {
  if (outreachSequenceStage === 'NEEDS_CONNECTION') {
    return 'NEEDS_CONNECTION';
  }

  if (outreachSequenceStage === 'CONNECTION_IGNORED') {
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
