import { resolveInput } from 'twenty-shared/utils';

import { type WorkflowFormNotifyOnPending } from 'src/modules/workflow/workflow-executor/workflow-actions/form/types/workflow-form-action-settings.type';

export type ResolvedNotifyOnPendingRecipients = NonNullable<
  WorkflowFormNotifyOnPending['recipients']
>;

const resolveRecipientField = (
  value: string | undefined,
  context: Record<string, unknown>,
): string | undefined => {
  if (!value) {
    return undefined;
  }

  const resolved = resolveInput(value, context);

  if (resolved === undefined || resolved === null) {
    return undefined;
  }

  return String(resolved);
};

export const resolveNotifyOnPendingRecipients = (
  recipients: WorkflowFormNotifyOnPending['recipients'] | undefined,
  context: Record<string, unknown>,
): ResolvedNotifyOnPendingRecipients => {
  const source = recipients ?? {};

  return {
    WHATSAPP_OFFICIAL: resolveRecipientField(
      source.WHATSAPP_OFFICIAL,
      context,
    ),
    WHATSAPP_UNIPILE: resolveRecipientField(source.WHATSAPP_UNIPILE, context),
    unipileAccountId: resolveRecipientField(source.unipileAccountId, context),
  };
};
