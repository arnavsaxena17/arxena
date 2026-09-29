import { isNonEmptyString } from '@sniptt/guards';
import { isDefined, isPlainObject } from 'twenty-shared/utils';

import { isOutreachSequencerWorkflowName } from 'src/engine/core-modules/outreach-command/utils/resolve-outreach-pause-resume-workflow-ids.util';

// Later-stage re-entry: a new accepted/replied run supersedes older delay waits
// (QUEUED accept wait, accepted FU waits, prior WAITING_REPLY post-reply waits).
export const OUTREACH_SEQUENCER_SIBLING_CANCEL_ENTRY_STAGES = [
  'CONNECTION_ACCEPTED',
  'REPLIED',
] as const;

export type OutreachSequencerSiblingCancelEntryStage =
  (typeof OUTREACH_SEQUENCER_SIBLING_CANCEL_ENTRY_STAGES)[number];

export const isOutreachSequencerSiblingCancelEntryStage = (
  stage: string | null | undefined,
): stage is OutreachSequencerSiblingCancelEntryStage =>
  isNonEmptyString(stage) &&
  (
    OUTREACH_SEQUENCER_SIBLING_CANCEL_ENTRY_STAGES as readonly string[]
  ).includes(stage);

// Database-event trigger payload: properties.after.outreachSequenceStage.
// Manual / normalized payloads may carry the field at the top level.
export const readOutreachSequenceStageFromTriggerPayload = (
  triggerPayload: unknown,
): string | null => {
  if (!isPlainObject(triggerPayload)) {
    return null;
  }

  const properties = isPlainObject(triggerPayload.properties)
    ? triggerPayload.properties
    : undefined;
  const after = isPlainObject(properties?.after) ? properties.after : undefined;

  if (typeof after?.outreachSequenceStage === 'string') {
    return after.outreachSequenceStage;
  }

  if (typeof triggerPayload.outreachSequenceStage === 'string') {
    return triggerPayload.outreachSequenceStage;
  }

  const nestedPayload = isPlainObject(triggerPayload.payload)
    ? triggerPayload.payload
    : undefined;

  if (typeof nestedPayload?.outreachSequenceStage === 'string') {
    return nestedPayload.outreachSequenceStage;
  }

  return null;
};

export const shouldCancelOutreachSequencerSiblingRuns = ({
  workflowName,
  entryStage,
  candidateId,
}: {
  workflowName?: string | null;
  entryStage?: string | null;
  candidateId?: string | null;
}): boolean =>
  isOutreachSequencerWorkflowName(workflowName) &&
  isNonEmptyString(candidateId) &&
  isOutreachSequencerSiblingCancelEntryStage(entryStage);

export const isOlderWorkflowRunThan = ({
  siblingCreatedAt,
  currentCreatedAt,
}: {
  siblingCreatedAt: string | Date | null | undefined;
  currentCreatedAt: string | Date | null | undefined;
}): boolean => {
  if (!isDefined(siblingCreatedAt) || !isDefined(currentCreatedAt)) {
    return false;
  }

  return (
    new Date(siblingCreatedAt).getTime() < new Date(currentCreatedAt).getTime()
  );
};
