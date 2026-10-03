import { isNonEmptyString } from '@sniptt/guards';

import { type CandidateOutreachJourney } from '@/outreach-home/types/outreach-journey.types';
import {
  resolveOutreachJourneyStageLabel,
  resolveOutreachNextRetryAt,
  resolveOutreachPendingStepLabel,
} from '@/outreach-home/utils/resolveOutreachJourneyLabels';

const SHORT_DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
});

const SHORT_DATE_TIME_FORMAT = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export const formatDrawerDate = (value: string | null | undefined) => {
  if (!isNonEmptyString(value) || Number.isNaN(new Date(value).getTime())) {
    return null;
  }

  return SHORT_DATE_FORMAT.format(new Date(value));
};

export const formatDrawerDateTime = (value: string | null | undefined) => {
  if (!isNonEmptyString(value) || Number.isNaN(new Date(value).getTime())) {
    return null;
  }

  return SHORT_DATE_TIME_FORMAT.format(new Date(value));
};

export type CandidateDrawerNextStep = {
  label: string;
  at: string | null;
};

// What the sequence will do next, and when. Paused / failed journeys have no
// scheduled next step.
export const resolveCandidateDrawerNextStep = (
  journey: CandidateOutreachJourney | null,
): CandidateDrawerNextStep | null => {
  const primaryRun = journey?.activeRuns[0] ?? null;

  if (journey === null || primaryRun === null) {
    return null;
  }

  return {
    label: resolveOutreachPendingStepLabel({
      currentStepName: primaryRun.currentStepName,
      currentStepKind: primaryRun.currentStepKind,
      pendingReason: primaryRun.pendingReason,
      errorMessage: primaryRun.errorMessage,
      status: primaryRun.status,
    }),
    at:
      resolveOutreachNextRetryAt({
        currentStepKind: primaryRun.currentStepKind,
        resumeAt: primaryRun.resumeAt,
        pendingReason: primaryRun.pendingReason,
      }) ?? journey.outreachResumeAt,
  };
};

export const resolveCandidateDrawerStageLabel = (
  journey: CandidateOutreachJourney | null,
) =>
  journey === null
    ? null
    : resolveOutreachJourneyStageLabel({
        outreachSequenceStage: journey.outreachSequenceStage,
        linkedinFollowUpCount: journey.linkedinFollowUpCount,
        outreachConversationStage: journey.outreachConversationStage,
      });

// One plain-language line: where this person is, and what happens next.
// e.g. "Replied 30 Sep. Sequence paused, needs your call."
export const buildCandidateDrawerStatusLine = ({
  journey,
  hasOpenDecision,
}: {
  journey: CandidateOutreachJourney | null;
  hasOpenDecision: boolean;
}): string | null => {
  if (journey === null) {
    return null;
  }

  const stageLabel = resolveCandidateDrawerStageLabel(journey) ?? 'Enrolled';
  const lastStageChange = journey.stageHistory.at(-1)?.at ?? null;
  const stageDate = formatDrawerDate(lastStageChange);
  const where = stageDate ? `${stageLabel} ${stageDate}.` : `${stageLabel}.`;
  const needsCall = hasOpenDecision ? ' Needs your call.' : '';

  if (journey.outreachPaused) {
    return hasOpenDecision
      ? `${where} Sequence paused, needs your call.`
      : `${where} Sequence paused.`;
  }

  const nextStep = resolveCandidateDrawerNextStep(journey);

  if (nextStep === null) {
    if (journey.lastFailedRun !== null) {
      return `${where} Last run failed, see Activity.${needsCall}`;
    }

    return `${where} No step scheduled.${needsCall}`;
  }

  const nextDate = formatDrawerDateTime(nextStep.at);

  return `${where} Next: ${nextStep.label}${nextDate ? ` on ${nextDate}` : ''}.${needsCall}`;
};

const FAILURE_EXPLANATIONS: Array<{ pattern: RegExp; explanation: string }> = [
  {
    pattern: /concurrent|state conflict|version conflict/i,
    explanation:
      'Another run updated this person at the same moment, so this run could not save its progress. Safe to retry.',
  },
  {
    pattern: /rate.?limit|too many requests|429/i,
    explanation:
      'The channel rate-limited us. Retry later, or let the next send window pick it up.',
  },
  {
    pattern: /extension|unipile|not connected|disconnected|credentials/i,
    explanation:
      'The sending account was not connected when this step ran. Reconnect it, then retry.',
  },
  {
    pattern: /timeout|timed out|ETIMEDOUT/i,
    explanation: 'The step timed out waiting for a response. Safe to retry.',
  },
  {
    pattern: /not found|404/i,
    explanation:
      'Something this step needed (a profile, record or message) no longer exists.',
  },
];

export const describeOutreachRunFailure = ({
  errorMessage,
  currentStepName,
}: {
  errorMessage: string | null;
  currentStepName: string | null;
}): string => {
  const knownFailure = FAILURE_EXPLANATIONS.find(({ pattern }) =>
    pattern.test(errorMessage ?? ''),
  );

  if (knownFailure !== undefined) {
    return knownFailure.explanation;
  }

  return isNonEmptyString(currentStepName)
    ? `The "${currentStepName}" step failed.`
    : 'The run stopped with an error.';
};
