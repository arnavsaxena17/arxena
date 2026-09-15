import {
  OUTREACH_FETCH_LINKEDIN_MESSAGES_LOGIC_FUNCTION_NAME,
  OUTREACH_FETCH_LINKEDIN_PROFILE_LOGIC_FUNCTION_NAME,
  OUTREACH_FETCH_USER_COMMENTS_LOGIC_FUNCTION_NAME,
  OUTREACH_GET_CALENDAR_AVAILABILITY_LOGIC_FUNCTION_NAME,
  OUTREACH_SEARCH_POSTS_LOGIC_FUNCTION_NAME,
} from 'src/engine/core-modules/outreach-command/constants/outreach-logic-function-names.const';
import {
  formatOutreachSlotsForLlm,
  formatOutreachTranscriptForLlm,
} from 'src/engine/core-modules/outreach-command/utils/format-outreach-llm-context.util';

const LLM_FORMATTED_JSON_TEXT_LOGIC_FUNCTION_NAMES = new Set([
  OUTREACH_FETCH_LINKEDIN_PROFILE_LOGIC_FUNCTION_NAME,
  OUTREACH_FETCH_USER_COMMENTS_LOGIC_FUNCTION_NAME,
  OUTREACH_SEARCH_POSTS_LOGIC_FUNCTION_NAME,
]);

// Pretty-printed JSON string for AI_AGENT prompts ({{step.text}}).
// Structured fields stay on the result for field-level variable refs.
export const withLlmFormattedText = <T extends object>(
  result: T,
): T & { text: string } => ({
  ...result,
  text: JSON.stringify(result, null, 2),
});

export const withLlmFormattedSlotsText = <T extends { slots?: unknown }>(
  result: T,
): T & { text: string } => ({
  ...result,
  text: formatOutreachSlotsForLlm(result.slots) || '(none)',
});

export const withLlmFormattedTranscriptText = <T extends object>(
  result: T,
): T & { text: string } => ({
  ...result,
  text: formatOutreachTranscriptForLlm(result) || '(none)',
});

// Same wrap the live LogicFunctionWorkflowAction applies for {{step.text}} chips.
export const maybeWithLlmFormattedText = (
  logicFunctionName: string,
  result: object,
): object => {
  if (
    logicFunctionName === OUTREACH_GET_CALENDAR_AVAILABILITY_LOGIC_FUNCTION_NAME
  ) {
    return withLlmFormattedSlotsText(result as { slots?: unknown });
  }

  if (
    logicFunctionName === OUTREACH_FETCH_LINKEDIN_MESSAGES_LOGIC_FUNCTION_NAME
  ) {
    return withLlmFormattedTranscriptText(result);
  }

  if (!LLM_FORMATTED_JSON_TEXT_LOGIC_FUNCTION_NAMES.has(logicFunctionName)) {
    return result;
  }

  return withLlmFormattedText(result);
};
