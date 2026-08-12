import { createHmac, timingSafeEqual } from 'crypto';

export type WorkflowFormDecisionPointerParts = {
  workspaceId: string;
  workflowRunId: string;
  stepId: string;
};

const POINTER_BODY_LENGTH = 96;
const POINTER_SIG_HEX_LENGTH = 16;

const getPointerSecret = (): string => {
  const secret =
    process.env.WORKFLOW_FORM_DECISION_SECRET?.trim() ||
    process.env.APP_SECRET?.trim();

  if (!secret || secret === 'replace_me_with_a_random_string') {
    // Dev fallback — set WORKFLOW_FORM_DECISION_SECRET or APP_SECRET in prod
    return 'workflow-form-decision-dev-secret';
  }

  return secret;
};

const compactUuid = (value: string): string => {
  const compact = value.replace(/-/g, '').toLowerCase();

  if (!/^[0-9a-f]{32}$/.test(compact)) {
    throw new Error(`Expected UUID, got: ${value}`);
  }

  return compact;
};

const expandUuid = (compact: string): string => {
  return [
    compact.slice(0, 8),
    compact.slice(8, 12),
    compact.slice(12, 16),
    compact.slice(16, 20),
    compact.slice(20, 32),
  ].join('-');
};

const signBody = (body: string): string => {
  return createHmac('sha256', getPointerSecret())
    .update(body)
    .digest('hex')
    .slice(0, POINTER_SIG_HEX_LENGTH);
};

// Compact signed pointer: {ws32}{run32}{step32}.{sig16}
// Round-tripped via WhatsApp flow_token / quick-reply payload / URL path
export const createWorkflowFormDecisionPointer = (
  parts: WorkflowFormDecisionPointerParts,
): string => {
  const body = `${compactUuid(parts.workspaceId)}${compactUuid(parts.workflowRunId)}${compactUuid(parts.stepId)}`;

  return `${body}.${signBody(body)}`;
};

export const verifyWorkflowFormDecisionPointer = (
  pointer: string,
): WorkflowFormDecisionPointerParts | null => {
  const trimmed = pointer.trim();
  const separatorIndex = trimmed.lastIndexOf('.');

  if (separatorIndex <= 0) {
    return null;
  }

  const body = trimmed.slice(0, separatorIndex);
  const signature = trimmed.slice(separatorIndex + 1).toLowerCase();

  if (
    body.length !== POINTER_BODY_LENGTH ||
    !/^[0-9a-f]{96}$/i.test(body) ||
    signature.length !== POINTER_SIG_HEX_LENGTH ||
    !/^[0-9a-f]+$/i.test(signature)
  ) {
    return null;
  }

  const expectedSignature = signBody(body.toLowerCase());

  try {
    const signatureBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      return null;
    }
  } catch {
    return null;
  }

  return {
    workspaceId: expandUuid(body.slice(0, 32).toLowerCase()),
    workflowRunId: expandUuid(body.slice(32, 64).toLowerCase()),
    stepId: expandUuid(body.slice(64, 96).toLowerCase()),
  };
};

// Quick-reply: wfd:{pointer}:approve|reject
export const buildWorkflowFormQuickReplyPayload = (
  pointer: string,
  decision: 'approve' | 'reject',
): string => {
  return `wfd:${pointer}:${decision}`;
};

export const parseWorkflowFormQuickReplyPayload = (
  payload: string,
): { pointer: string; decision: 'approve' | 'reject' } | null => {
  // wfd:{96hex}.{16hex}:approve|reject
  const match =
    /^wfd:([0-9a-f]{96}\.[0-9a-f]{16}):(approve|reject)$/i.exec(
      payload.trim(),
    );

  if (!match) {
    return null;
  }

  return {
    pointer: match[1].toLowerCase(),
    decision: match[2].toLowerCase() as 'approve' | 'reject',
  };
};
