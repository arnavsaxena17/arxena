import { OUTREACH_JOURNEY_TIMELINE_STAGES } from '@/outreach-home/constants/outreach-journey-stages';

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

export function resolveOutreachNextStepLabel({
  currentStepName,
  currentStepKind,
  resumeAt,
  pendingReason,
}: {
  currentStepName: string | null;
  currentStepKind: string | null;
  resumeAt: string | null;
  pendingReason: string | null;
}): string {
  if (currentStepKind === 'FORM') {
    return 'Needs approval';
  }

  if (currentStepKind === 'DELAY' && resumeAt !== null) {
    return `Scheduled ${new Date(resumeAt).toLocaleString()}`;
  }

  if (pendingReason === 'outreach_send_window') {
    return 'Waiting for send window';
  }

  if (pendingReason === 'linkedin_rate_limit') {
    return 'LinkedIn rate limit';
  }

  if (pendingReason === 'outreach_candidate_paused') {
    return 'Journey paused';
  }

  if (currentStepName !== null && currentStepName.length > 0) {
    return currentStepName;
  }

  return '—';
}
