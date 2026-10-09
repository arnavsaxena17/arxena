/* @license Enterprise */

// Files that still call an LLM provider directly instead of going through
// MeteredLlmService, so their usage is not billed. This list may only shrink:
// migrate a file, then delete its line. A guard test fails if a file outside
// this list makes a raw provider call, or if a listed file no longer does.
export const UNMETERED_LLM_CALL_SITES: readonly string[] = [
  'engine/core-modules/arx-chat/services/candidate-engagement/candidate-data-processor.service.ts',
  'engine/core-modules/arx-chat/services/llm-agents/arx-multi-step-client.ts',
  'engine/core-modules/arx-chat/services/llm-agents/human-or-bot-classification.ts',
  'engine/core-modules/arx-chat/services/llm-agents/stage-classification.ts',
  'engine/core-modules/arx-chat/utils/arx-chat-agent-utils.ts',
  'engine/core-modules/assistant/mcp-anthropic-message-processor.service.ts',
  'engine/core-modules/assistant/mcp-assistant.service.ts',
  'engine/core-modules/candidate-search/controllers/candidate-search-pipeline.controller.ts',
  'engine/core-modules/candidate-search/services/classify-message.service.ts',
  'engine/core-modules/candidate-search/services/cleanup.service.ts',
  'engine/core-modules/candidate-search/services/job-description.service.ts',
  'engine/core-modules/candidate-search/services/stream-processing.service.ts',
  'engine/core-modules/candidate-sourcing/services/ai-filter-engine/ai-filter-engine.service.ts',
  'engine/core-modules/linkedin-query-generation/services/linkedin-query-generation.service.ts',
  'engine/core-modules/org-chart-outreach/icp-extraction.service.ts',
  'engine/core-modules/org-chart/services/org-chart-company-news.service.ts',
  'engine/core-modules/outreach-command/services/outreach-inbound-reply-classifier.service.ts',
  'engine/core-modules/people-api/services/people-natural-language-parser.service.ts',
  'engine/core-modules/search-models/services/search-models.service.ts',
  'engine/core-modules/video-interview/transcribe.ts',
  'engine/core-modules/video-interview/transcription.service.ts',
  'modules/linkedin-xray/linkedin-xray.service.ts',
];
