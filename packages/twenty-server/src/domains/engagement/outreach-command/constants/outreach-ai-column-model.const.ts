// Default chat model for preview_ai_column / run_ai_column (design + row fill)
// when the column is not jev and not a web-search enrichment.
// OpenRouter OpenAI-compatible slug (passed to the OpenAI SDK with OpenRouter base URL).
export const OUTREACH_AI_COLUMN_DEFAULT_CHAT_MODEL =
  'deepseek/deepseek-v4-flash-0731';

// Registry id (openrouter/<slug>) for AI SDK / preferences.
export const OUTREACH_AI_COLUMN_DEFAULT_MODEL_ID =
  `openrouter/${OUTREACH_AI_COLUMN_DEFAULT_CHAT_MODEL}` as const;

// Alias the agent / filter UI may pass; maps to OUTREACH_AI_COLUMN_DEFAULT_CHAT_MODEL.
export const OUTREACH_AI_COLUMN_DEFAULT_MODEL_ALIAS = 'deepseek';
