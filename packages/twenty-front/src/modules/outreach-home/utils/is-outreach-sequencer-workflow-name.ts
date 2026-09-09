import {
  OUTREACH_WORKFLOW_B_NAME,
  OUTREACH_WORKFLOW_C_NAME,
} from '@/outreach-home/constants/outreach-command.constants';

export const OUTREACH_SEQUENCER_WORKFLOW_NAMES = [
  OUTREACH_WORKFLOW_B_NAME,
  OUTREACH_WORKFLOW_C_NAME,
] as const;

export const isOutreachSequencerWorkflowName = (
  workflowName: string | null | undefined,
): boolean =>
  typeof workflowName === 'string' &&
  (OUTREACH_SEQUENCER_WORKFLOW_NAMES as readonly string[]).includes(
    workflowName,
  );
