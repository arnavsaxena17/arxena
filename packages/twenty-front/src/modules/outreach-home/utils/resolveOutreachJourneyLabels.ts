import { OUTREACH_JOURNEY_TIMELINE_STAGES } from '@/outreach-home/constants/outreach-journey-stages';
import {
  LINKEDIN_RATE_LIMIT_PENDING_REASON,
  OUTREACH_PROJECT_PAUSED_PENDING_REASON,
  OUTREACH_SEND_WINDOW_PENDING_REASON,
  OUTREACH_UNIPILE_PACING_PENDING_REASON,
  formatScheduledAtLabel,
  normalizeWorkflowPendingReason,
} from '@/unipile/utils/accountRateLimitError';

const OUTREACH_CANDIDATE_PAUSED_PENDING_REASON = 'outreach_candidate_paused';

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

export function resolveOutreachJourneyStageLabel({
  outreachSequenceStage,
  linkedinFollowUpCount,
  hasFormPending,
}: {
  outreachSequenceStage: string;
  linkedinFollowUpCount?: number;
  hasFormPending?: boolean;
  isPersonaDeferred?: boolean;
}): string {
  const stage = outreachSequenceStage.toUpperCase();

  if (hasFormPending === true) {
    return 'Follow-up with action / reminder';
  }

  if (stage === 'WAITING_REPLY') {
    return 'Waiting for reply';
  }

  if (stage === 'FAILED_NO_REPLY') {
    return 'Failed no reply';
  }

  if (stage === 'DEFERRED') {
    return 'Waiting for slot';
  }

  if (stage === 'CONNECTION_ACCEPTED') {
    return 'Connection accepted';
  }

  if (stage === 'NEGOTIATING') {
    return 'Negotiating';
  }

  if ((linkedinFollowUpCount ?? 0) >= 3) {
    return 'Followed up 3';
  }

  if ((linkedinFollowUpCount ?? 0) === 2) {
    return 'Followed up 2';
  }

  if ((linkedinFollowUpCount ?? 0) === 1) {
    return 'Followed up';
  }

  return (
    OUTREACH_JOURNEY_TIMELINE_STAGES.find(
      (timelineStage) => timelineStage.id === stage,
    )?.label ?? stage.replaceAll('_', ' ').toLowerCase()
  );
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
