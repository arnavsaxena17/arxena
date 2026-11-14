export const OUTREACH_DECISION_KINDS = [
  'CONNECTION_NOTE',
  'COMMENT_DRAFT',
  'MESSAGE_DRAFT',
  'REPLY_DRAFT',
  'MEETING_ACTION',
] as const;

export type OutreachDecisionKind = (typeof OUTREACH_DECISION_KINDS)[number];

export type OutreachDecisionUrgency = 'NOW' | 'APPROVE';

export const outreachDecisionSourceKey = (
  workflowRunId: string,
  stepId: string,
): string => `${workflowRunId}:${stepId}`;

const RECOMMENDATION_BY_KIND: Record<OutreachDecisionKind, string> = {
  CONNECTION_NOTE: 'Approve the connection note',
  COMMENT_DRAFT: 'Approve the comment',
  MESSAGE_DRAFT: 'Approve the draft',
  REPLY_DRAFT: 'Approve the reply',
  MEETING_ACTION: 'Approve the meeting message',
};

export const decisionKindFromFormStepName = (
  stepName: string,
): { kind: OutreachDecisionKind; urgency: OutreachDecisionUrgency } => {
  const normalized = stepName.trim().toLowerCase();

  if (normalized.startsWith('approve connection note')) {
    return { kind: 'CONNECTION_NOTE', urgency: 'APPROVE' };
  }

  if (normalized.includes('comment')) {
    return { kind: 'COMMENT_DRAFT', urgency: 'APPROVE' };
  }

  if (
    normalized.includes('meeting reminder') ||
    normalized.includes('no-show') ||
    normalized.includes('reschedule')
  ) {
    return { kind: 'MEETING_ACTION', urgency: 'NOW' };
  }

  if (normalized.includes('follow-up')) {
    return { kind: 'MESSAGE_DRAFT', urgency: 'APPROVE' };
  }

  if (normalized.includes('reply') || normalized.includes('referral')) {
    return { kind: 'REPLY_DRAFT', urgency: 'NOW' };
  }

  return { kind: 'MESSAGE_DRAFT', urgency: 'APPROVE' };
};

export const outreachDecisionRecommendation = (
  kind: OutreachDecisionKind,
): string => RECOMMENDATION_BY_KIND[kind];

export const draftBodyFromFormFields = (
  fields: Array<{ name: string; value: unknown }>,
): string => {
  const editedBody = fields.find((field) => field.name === 'editedBody');

  if (typeof editedBody?.value === 'string') {
    return editedBody.value;
  }

  const message = fields.find((field) => field.name === 'message');

  if (typeof message?.value === 'string') {
    return message.value;
  }

  const textField = fields.find(
    (field) =>
      field.name !== 'approve' &&
      typeof field.value === 'string' &&
      field.value.trim().length > 0,
  );

  return typeof textField?.value === 'string' ? textField.value : '';
};

export const formatOutreachPersonName = (name: unknown): string => {
  if (typeof name === 'string') {
    return name.trim();
  }

  if (name && typeof name === 'object') {
    const record = name as { firstName?: unknown; lastName?: unknown };
    const firstName =
      typeof record.firstName === 'string' ? record.firstName.trim() : '';
    const lastName =
      typeof record.lastName === 'string' ? record.lastName.trim() : '';

    return [firstName, lastName].filter((part) => part.length > 0).join(' ');
  }

  return '';
};
