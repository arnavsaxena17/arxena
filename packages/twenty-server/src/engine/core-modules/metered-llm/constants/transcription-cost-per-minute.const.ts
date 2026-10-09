/* @license Enterprise */

// OpenAI audio transcription is priced per minute of audio, not per token.
// Check these against OpenAI's published pricing before relying on them.
export const TRANSCRIPTION_COST_PER_MINUTE_USD: Record<string, number> = {
  'whisper-1': 0.006,
  'gpt-4o-transcribe': 0.006,
  'gpt-4o-mini-transcribe': 0.003,
};
