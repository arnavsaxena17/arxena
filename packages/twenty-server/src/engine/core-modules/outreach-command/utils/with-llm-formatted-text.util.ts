import {
  OUTREACH_FETCH_LINKEDIN_MESSAGES_LOGIC_FUNCTION_NAME,
  OUTREACH_FETCH_LINKEDIN_PROFILE_LOGIC_FUNCTION_NAME,
  OUTREACH_FETCH_USER_COMMENTS_LOGIC_FUNCTION_NAME,
  OUTREACH_SEARCH_POSTS_LOGIC_FUNCTION_NAME,
} from 'src/engine/core-modules/outreach-command/constants/outreach-logic-function-names.const';

const LLM_FORMATTED_TEXT_LOGIC_FUNCTION_NAMES = new Set([
  OUTREACH_FETCH_LINKEDIN_PROFILE_LOGIC_FUNCTION_NAME,
  OUTREACH_FETCH_LINKEDIN_MESSAGES_LOGIC_FUNCTION_NAME,
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

// Same wrap the live LogicFunctionWorkflowAction applies for {{step.text}} chips.
export const maybeWithLlmFormattedText = (
  logicFunctionName: string,
  result: object,
): object => {
  if (!LLM_FORMATTED_TEXT_LOGIC_FUNCTION_NAMES.has(logicFunctionName)) {
    return result;
  }

  return withLlmFormattedText(result);
};
