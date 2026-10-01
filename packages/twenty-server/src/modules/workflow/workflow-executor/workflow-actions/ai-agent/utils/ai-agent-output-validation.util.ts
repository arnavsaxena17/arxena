import { isDefined } from 'twenty-shared/utils';
import { DEFAULT_AI_AGENT_OUTPUT_VALIDATION_CHECKS } from 'twenty-shared/workflow';

// Question text was checked on labeled outreach drafts on 2026-10-01.
// Sendable samples stayed at or below 0.14. Matching defects were at least 0.80.
export const JEV_OUTPUT_DEFECT_THRESHOLD = 0.5;

export const AI_AGENT_OUTPUT_VALIDATION_MAX_ATTEMPTS = 3;

export const JEV_DECISIONS_URL = 'https://openrouter.ai/api/alpha/decisions';

export const JEV_OUTPUT_VALIDATION_MODEL_ID = 'typesafe/jev-1.13';

const TEMPLATE_TOKEN_PATTERNS = [
  /\{\{[\s\S]*?\}\}/,
  /\{[A-Za-z_][A-Za-z0-9_]*\}/,
  /\[[^\]\n]*(?:insert|placeholder|your name|company name|todo)[^\]\n]*\]/i,
  /\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/,
];

export type AiAgentOutputValidationCheck = {
  id: string;
  label: string;
  instructions: string;
  invalidWhen: string;
  validWhen: string;
};

export type AiAgentOutputValidationCheckResult = {
  id: string;
  label: string;
  noul?: number;
  failed: boolean;
};

export type AiAgentOutputValidationFieldResult = {
  fieldKey: string;
  skipped: boolean;
  codeFailure?: string;
  operatorNote?: number;
  unresolvedPlaceholder?: number;
  checkResults?: AiAgentOutputValidationCheckResult[];
  cleared: boolean;
};

export type AiAgentOutputValidationReport = {
  attempts: number;
  cleared: boolean;
  fields: AiAgentOutputValidationFieldResult[];
};

export type JevDraftField = {
  fieldKey: string;
  channel: string;
  text: string;
};

type JevNoulQuestion = {
  type: 'noul';
  instructions: string;
  criteria: {
    true: string;
    false: string;
  };
};

export const resolveOutputValidationChecks = (
  checks: readonly AiAgentOutputValidationCheck[] | undefined,
): AiAgentOutputValidationCheck[] => {
  if (!isDefined(checks)) {
    return DEFAULT_AI_AGENT_OUTPUT_VALIDATION_CHECKS.map((check) => ({
      ...check,
    }));
  }

  return checks.filter(
    (check) =>
      check.id.trim() !== '' &&
      check.instructions.trim() !== '' &&
      check.invalidWhen.trim() !== '' &&
      check.validWhen.trim() !== '',
  );
};

export const channelForOutputField = (fieldKey: string): string => {
  switch (fieldKey) {
    case 'whatsappMessage':
      return 'whatsapp';
    case 'emailSubject':
    case 'subject':
      return 'email_subject';
    case 'emailBody':
      return 'email';
    case 'linkedinMessage':
      return 'linkedin';
    case 'referralMessage':
      return 'referral_message';
    default:
      return 'message';
  }
};

export const findTemplateToken = (text: string): string | undefined => {
  for (const pattern of TEMPLATE_TOKEN_PATTERNS) {
    const match = text.match(pattern);

    if (match?.[0]) {
      return match[0];
    }
  }

  return undefined;
};

export const readOutputFieldText = (
  result: object,
  fieldKey: string,
): string | undefined => {
  const value = (result as Record<string, unknown>)[fieldKey];

  return typeof value === 'string' ? value : undefined;
};

export const scanOutputFields = (
  result: object,
  fieldKeys: string[],
): {
  fields: AiAgentOutputValidationFieldResult[];
  jevFields: JevDraftField[];
} => {
  const fields: AiAgentOutputValidationFieldResult[] = [];
  const jevFields: JevDraftField[] = [];

  for (const fieldKey of fieldKeys) {
    const text = readOutputFieldText(result, fieldKey);

    if (text === undefined || text.trim() === '') {
      fields.push({
        fieldKey,
        skipped: true,
        cleared: true,
      });
      continue;
    }

    const codeFailure = findTemplateToken(text);

    if (codeFailure) {
      fields.push({
        fieldKey,
        skipped: false,
        codeFailure,
        cleared: false,
      });
      continue;
    }

    fields.push({
      fieldKey,
      skipped: false,
      cleared: false,
    });
    jevFields.push({
      fieldKey,
      channel: channelForOutputField(fieldKey),
      text,
    });
  }

  return { fields, jevFields };
};

const noulQuestion = (
  instructions: string,
  criteria: { true: string; false: string },
): JevNoulQuestion => ({
  type: 'noul',
  instructions,
  criteria,
});

export const buildJevOutputValidationRequest = (
  jevFields: JevDraftField[],
  checks: AiAgentOutputValidationCheck[],
): {
  model: string;
  state: {
    drafts: Record<string, { channel: string; text: string }>;
  };
  questions: Record<string, JevNoulQuestion>;
} => {
  const drafts: Record<string, { channel: string; text: string }> = {};
  const questions: Record<string, JevNoulQuestion> = {};

  for (const field of jevFields) {
    drafts[field.fieldKey] = {
      channel: field.channel,
      text: field.text,
    };
    for (const check of checks) {
      questions[`${field.fieldKey}__${check.id}`] = noulQuestion(
        `For \`drafts.${field.fieldKey}.text\` on channel \`drafts.${field.fieldKey}.channel\`: ${check.instructions}`,
        {
          true: check.invalidWhen,
          false: check.validWhen,
        },
      );
    }
  }

  return {
    model: JEV_OUTPUT_VALIDATION_MODEL_ID,
    state: { drafts },
    questions,
  };
};

const isDefect = (probability: number | undefined): boolean =>
  probability !== undefined && probability >= JEV_OUTPUT_DEFECT_THRESHOLD;

export const applyJevNouls = (
  fields: AiAgentOutputValidationFieldResult[],
  answers: Record<string, { type?: string; noul?: number }>,
  checks: AiAgentOutputValidationCheck[],
): AiAgentOutputValidationFieldResult[] =>
  fields.map((field) => {
    if (field.skipped || field.codeFailure) {
      return field;
    }

    const checkResults = checks.map((check) => {
      const noul = answers[`${field.fieldKey}__${check.id}`]?.noul;

      return {
        id: check.id,
        label: check.label,
        noul,
        failed: isDefect(noul),
      };
    });
    const noulFor = (checkId: string) =>
      checkResults.find((checkResult) => checkResult.id === checkId)?.noul;

    return {
      ...field,
      operatorNote: noulFor('operatorNote'),
      unresolvedPlaceholder: noulFor('unresolvedPlaceholder'),
      checkResults,
      cleared: checkResults.every(
        (checkResult) => checkResult.failed === false,
      ),
    };
  });

const failureReason = (
  field: AiAgentOutputValidationFieldResult,
): string | undefined => {
  if (field.cleared || field.skipped) {
    return undefined;
  }

  if (field.codeFailure) {
    return `it still contains an unfilled token (${field.codeFailure})`;
  }

  const reasons = (field.checkResults ?? [])
    .filter((checkResult) => checkResult.failed)
    .map((checkResult) => {
      if (checkResult.id === 'operatorNote') {
        return 'it addresses the sender instead of the prospect';
      }

      if (checkResult.id === 'unresolvedPlaceholder') {
        return 'it still contains a blank the sender must fill';
      }

      return `it failed "${checkResult.label}"`;
    });

  return reasons.join(', ');
};

export const buildOutputValidationRepairPrompt = (
  userPrompt: string,
  result: object,
  fields: AiAgentOutputValidationFieldResult[],
): string => {
  const failures = fields.flatMap((field) => {
    const reason = failureReason(field);

    if (!reason) {
      return [];
    }

    const text = readOutputFieldText(result, field.fieldKey) ?? '';

    return [`- ${field.fieldKey}: ${reason}. Rejected text:\n${text}`];
  });

  return `${userPrompt}

The previous structured output was not cleared to send.
${failures.join('\n\n')}

Rewrite the failed fields as one message the prospect can receive as-is. Do not add notes to the sender, alternative options, or blanks to fill in. Keep fields that were already cleared or left empty unchanged.`;
};

export const formatOutputValidationError = (
  report: AiAgentOutputValidationReport,
): string => {
  const details = report.fields.flatMap((field) => {
    const reason = failureReason(field);

    return reason ? [`- ${field.fieldKey}: ${reason}`] : [];
  });

  return `Jev did not clear this draft after ${report.attempts} attempts.\n${details.join('\n')}`;
};
