import { resolveOutreachLastInboundAt } from 'twenty-shared/arx';
import { isDefined } from 'twenty-shared/utils';

// Stages that mean the prospect already engaged, or an operator stopped them.
// Starting a run against any of these would re-open a warm thread or undo a
// deliberate stop, so every "should we touch them again" check shares this set.
export const OUTREACH_ENGAGED_STAGES: ReadonlySet<string> = new Set([
  'REPLIED',
  'NEGOTIATING',
  'MEETING_BOOKED',
  'STOPPED',
]);

type ReplySignalCandidate = {
  outreachSequenceStage?: string | null;
  outreachAnalytics?: unknown;
} | null;

// Stage is the primary signal, but it can lag behind the inbound webhook or be
// overwritten by a later step, so a recorded inbound message also counts.
export const hasOutreachReply = (
  candidate: ReplySignalCandidate | undefined,
): boolean => {
  if (!isDefined(candidate)) {
    return false;
  }

  if (
    isDefined(candidate.outreachSequenceStage) &&
    OUTREACH_ENGAGED_STAGES.has(candidate.outreachSequenceStage)
  ) {
    return true;
  }

  return isDefined(resolveOutreachLastInboundAt(candidate.outreachAnalytics));
};
