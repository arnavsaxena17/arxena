/** Ensures modules that construct OpenAI clients at import time do not fail in Jest. */
process.env.OPENAI_API_KEY =
  process.env.OPENAI_API_KEY ?? 'jest-placeholder-openai-key';
