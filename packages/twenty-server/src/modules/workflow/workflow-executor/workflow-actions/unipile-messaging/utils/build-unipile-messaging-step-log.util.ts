import { type WorkflowRunStepLog } from 'twenty-shared/workflow';

import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type UnipileMessagingStepLogChannel } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/types/unipile-messaging-step-log-channel.type';

type BuildUnipileMessagingStepLogArgs = {
  channel: UnipileMessagingStepLogChannel;
  workspaceMemberId?: string;
  unipileAccountId?: string;
  recipient?: string;
  subject?: string;
  body?: string;
  output: ToolOutput;
  durationMs: number;
};

const BODY_PREVIEW_MAX_LENGTH = 200;

export const buildUnipileMessagingStepLog = ({
  channel,
  workspaceMemberId,
  unipileAccountId,
  recipient,
  subject,
  body,
  output,
  durationMs,
}: BuildUnipileMessagingStepLogArgs): WorkflowRunStepLog => {
  const bodyPreview =
    typeof body === 'string' && body.length > BODY_PREVIEW_MAX_LENGTH
      ? `${body.slice(0, BODY_PREVIEW_MAX_LENGTH)}...`
      : body;

  return {
    details: {
      type: 'UNIPILE_MESSAGING',
      channel,
      status: output.success ? 'SUCCESS' : 'ERROR',
      workspaceMemberId,
      unipileAccountId,
      recipient,
      subject,
      bodyPreview,
      error: output.error,
      durationMs,
    },
    entries: [],
    sizeBytes: 0,
  };
};
