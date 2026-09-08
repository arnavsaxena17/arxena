// Pretty-printed JSON string for AI_AGENT prompts ({{step.text}}).
// Structured fields stay on the result for field-level variable refs.
export const withLlmFormattedText = <T extends object>(
  result: T,
): T & { text: string } => ({
  ...result,
  text: JSON.stringify(result, null, 2),
});
