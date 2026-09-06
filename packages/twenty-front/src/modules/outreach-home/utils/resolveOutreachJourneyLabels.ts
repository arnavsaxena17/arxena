import {
  OUTREACH_JOURNEY_TIMELINE_STAGES,
  type OutreachJourneyTimelineStageId,
} from '@/outreach-home/constants/outreach-journey-stages';
import {
  LINKEDIN_RATE_LIMIT_PENDING_REASON,
  OUTREACH_PROJECT_PAUSED_PENDING_REASON,
  OUTREACH_SEND_WINDOW_PENDING_REASON,
  OUTREACH_UNIPILE_PACING_PENDING_REASON,
  formatScheduledAtLabel,
  normalizeWorkflowPendingReason,
} from '@/unipile/utils/accountRateLimitError';

const OUTREACH_CANDIDATE_PAUSED_PENDING_REASON = 'outreach_candidate_paused';

const GENERIC_FORM_STEP_NAME_PATTERN =
  /^(human in the loop|form|needs approval)$/i;

type OutreachRunProgressInput = {
  currentStepName: string | null;
  currentStepKind: string | null;
  resumeAt: string | null;
  pendingReason: string | null;
  errorMessage?: string | null;
  status?: string | null;
};

const PENDING_REASON_STEP_SUFFIX: Record<string, string> = {
  [LINKEDIN_RATE_LIMIT_PENDING_REASON]: 'rate limited',
  [OUTREACH_SEND_WINDOW_PENDING_REASON]: 'send window',
  [OUTREACH_UNIPILE_PACING_PENDING_REASON]: 'pacing',
};

const PENDING_REASON_FALLBACK_LABEL: Record<string, string> = {
  [LINKEDIN_RATE_LIMIT_PENDING_REASON]: 'LinkedIn rate limit',
  [OUTREACH_SEND_WINDOW_PENDING_REASON]: 'Waiting for send window',
  [OUTREACH_UNIPILE_PACING_PENDING_REASON]: 'Outreach pacing',
  [OUTREACH_PROJECT_PAUSED_PENDING_REASON]: 'Outreach paused',
  [OUTREACH_CANDIDATE_PAUSED_PENDING_REASON]: 'Journey paused',
};

const isPausedPendingReason = (pendingReason: string | undefined): boolean =>
  pendingReason === OUTREACH_CANDIDATE_PAUSED_PENDING_REASON ||
  pendingReason === OUTREACH_PROJECT_PAUSED_PENDING_REASON;

const resolveNormalizedPendingReason = ({
  currentStepKind,
  pendingReason,
}: Pick<OutreachRunProgressInput, 'currentStepKind' | 'pendingReason'>):
  | string
  | undefined => {
  const normalizedPendingReason = normalizeWorkflowPendingReason(
    pendingReason ?? undefined,
  );

  if (normalizedPendingReason) {
    return normalizedPendingReason;
  }

  if (currentStepKind === 'RATE_LIMITED') {
    return LINKEDIN_RATE_LIMIT_PENDING_REASON;
  }

  return undefined;
};

const timelineLabelById = Object.fromEntries(
  OUTREACH_JOURNEY_TIMELINE_STAGES.map((timelineStage) => [
    timelineStage.id,
    timelineStage.label,
  ]),
) as Record<OutreachJourneyTimelineStageId, string>;

const isKnownTimelineStageId = (
  stageId: string,
): stageId is OutreachJourneyTimelineStageId =>
  Object.prototype.hasOwnProperty.call(timelineLabelById, stageId);

// Progress on the LinkedIn spine: late CRM stages win; follow-up count
// overlays bare CONNECTION_ACCEPTED; FORM is never a stage.
export function resolveOutreachJourneyTimelineStageId({
  outreachSequenceStage,
  linkedinFollowUpCount,
  outreachConversationStage,
}: {
  outreachSequenceStage: string;
  linkedinFollowUpCount?: number;
  outreachConversationStage?: string | null;
}): string {
  const stage = outreachSequenceStage.toUpperCase();
  const followUpCount = linkedinFollowUpCount ?? 0;
  const conversationStage = (outreachConversationStage ?? '').toUpperCase();

  if (stage === 'STOPPED') {
    return 'STOPPED';
  }

  if (stage === 'FAILED_NO_REPLY') {
    return 'FAILED_NO_REPLY';
  }

  if (stage === 'FAILED_ENRICH') {
    return 'FAILED_ENRICH';
  }

  if (stage === 'DEFERRED') {
    return 'DEFERRED';
  }

  if (stage === 'MEETING_BOOKED' || conversationStage === 'MEETING_BOOKED') {
    return 'MEETING_BOOKED';
  }

  if (stage === 'WAITING_REPLY') {
    return 'WAITING_REPLY';
  }

  if (stage === 'REPLIED' || stage === 'NEGOTIATING') {
    return 'REPLIED';
  }

  if (
    stage === 'EMAIL_SENT' ||
    stage === 'INMAIL_SENT' ||
    stage === 'WHATSAPP_SENT'
  ) {
    return 'EMAIL_SENT';
  }

  if (stage === 'QUEUED') {
    return 'QUEUED';
  }

  if (stage === 'CONNECTION_SENT') {
    return 'CONNECTION_SENT';
  }

  // Accept + silent follow-ups: count advances display while CRM stage stays
  // CONNECTION_ACCEPTED until FU3 fails or inbound flips to REPLIED.
  if (stage === 'CONNECTION_ACCEPTED' || followUpCount > 0) {
    if (followUpCount >= 3) {
      return 'FOLLOW_UP_3';
    }

    if (followUpCount === 2) {
      return 'FOLLOW_UP_2';
    }

    if (followUpCount === 1) {
      return 'FOLLOW_UP_1';
    }

    if (stage === 'CONNECTION_ACCEPTED') {
      return 'CONNECTION_ACCEPTED';
    }
  }

  return stage;
}

export function resolveOutreachJourneyStageLabel({
  outreachSequenceStage,
  linkedinFollowUpCount,
  outreachConversationStage,
}: {
  outreachSequenceStage: string;
  linkedinFollowUpCount?: number;
  outreachConversationStage?: string | null;
  // Kept for call-site compatibility; FORM is Next, not Stage.
  hasFormPending?: boolean;
  isPersonaDeferred?: boolean;
}): string {
  const timelineStageId = resolveOutreachJourneyTimelineStageId({
    outreachSequenceStage,
    linkedinFollowUpCount,
    outreachConversationStage,
  });

  if (isKnownTimelineStageId(timelineStageId)) {
    return timelineLabelById[timelineStageId];
  }

  return timelineStageId.replaceAll('_', ' ').toLowerCase();
}

export function resolveOutreachPendingStepLabel({
  currentStepName,
  currentStepKind,
  pendingReason,
  errorMessage,
  status,
}: Omit<OutreachRunProgressInput, 'resumeAt'>): string {
  if (status === 'FAILED' || currentStepKind === 'FAILED') {
    if (
      currentStepName !== null &&
      currentStepName.length > 0 &&
      isNonEmptyErrorMessage(errorMessage)
    ) {
      return `${currentStepName} · ${errorMessage}`;
    }

    if (isNonEmptyErrorMessage(errorMessage)) {
      return errorMessage;
    }

    if (currentStepName !== null && currentStepName.length > 0) {
      return `Failed · ${currentStepName}`;
    }

    return 'Workflow failed';
  }

  if (currentStepKind === 'FORM') {
    if (
      currentStepName !== null &&
      currentStepName.length > 0 &&
      !GENERIC_FORM_STEP_NAME_PATTERN.test(currentStepName.trim())
    ) {
      return currentStepName;
    }

    return 'Needs approval';
  }

  const normalizedPendingReason = resolveNormalizedPendingReason({
    currentStepKind,
    pendingReason,
  });

  if (isPausedPendingReason(normalizedPendingReason)) {
    return (
      PENDING_REASON_FALLBACK_LABEL[normalizedPendingReason ?? ''] ??
      'Journey paused'
    );
  }

  const reasonSuffix = normalizedPendingReason
    ? PENDING_REASON_STEP_SUFFIX[normalizedPendingReason]
    : undefined;

  if (currentStepName !== null && currentStepName.length > 0) {
    return reasonSuffix
      ? `${currentStepName} · ${reasonSuffix}`
      : currentStepName;
  }

  if (
    normalizedPendingReason &&
    PENDING_REASON_FALLBACK_LABEL[normalizedPendingReason]
  ) {
    return PENDING_REASON_FALLBACK_LABEL[normalizedPendingReason];
  }

  return '—';
}

const isNonEmptyErrorMessage = (
  errorMessage: string | null | undefined,
): errorMessage is string =>
  typeof errorMessage === 'string' && errorMessage.trim().length > 0;

export function resolveOutreachNextRetryAt({
  currentStepKind,
  resumeAt,
  pendingReason,
}: Omit<OutreachRunProgressInput, 'currentStepName'>): string | null {
  if (currentStepKind === 'FORM' || resumeAt === null) {
    return null;
  }

  const normalizedPendingReason = resolveNormalizedPendingReason({
    currentStepKind,
    pendingReason,
  });

  if (isPausedPendingReason(normalizedPendingReason)) {
    return null;
  }

  const resumeMs = new Date(resumeAt).getTime();

  if (!Number.isFinite(resumeMs)) {
    return null;
  }

  return resumeAt;
}

export function resolveOutreachNextRetryLabel(
  input: Omit<OutreachRunProgressInput, 'currentStepName'>,
): string | null {
  const nextRetryAt = resolveOutreachNextRetryAt(input);

  if (nextRetryAt === null) {
    return null;
  }

  return formatScheduledAtLabel(nextRetryAt);
}

export function resolveOutreachNextStepLabel(
  input: OutreachRunProgressInput,
): string {
  const pendingStepLabel = resolveOutreachPendingStepLabel(input);
  const nextRetryLabel = resolveOutreachNextRetryLabel(input);

  if (nextRetryLabel !== null) {
    return `${pendingStepLabel} · retry ${nextRetryLabel}`;
  }

  return pendingStepLabel;
}
