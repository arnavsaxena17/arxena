export const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
export const OPENAI_MCP_MODEL = 'gpt-5.1-chat-latest';
// export const MAX_TOKENS = 4096;
export const MAX_TOOL_ROUNDS = 10;

export const TABLE_LIST_KEYS = [
  'companies',
  'jobs',
  'candidates',
  'people',
] as const;

/** Tools that, when they return an error, should break the assistant flow and surface the error to the user. */
export const LINKEDIN_SEARCH_ERROR_TOOLS = new Set([
  'search_linkedin_parameters',
  'search_linkedin_with_query',
  'search_linkedin_people',
  'generate_linkedin_query_set',
  'generate_iterative_linkedin_query_set',
  'search_candidates',
]);

export const STREAMING_TOOL_NAMES = [
  'search_linkedin_with_query',
  'search_linkedin_people',
  'generate_search_parameters',
  'generate_unresolved_search_parameters',
  'generate_iterative_linkedin_query_set',
] as const;

/**
 * Tools that should NOT be offered to the "general" assistant flows.
 * They can still be explicitly enabled per-endpoint via `allowedToolNames`
 * in `callJsonWithTools`.
 */
export const INTERNAL_TOOL_NAMES = new Set<string>([
  'generate_unresolved_search_parameters',
  'resolve_parameters',
  'generate_linkedin_query_agent1',
  'generate_linkedin_query_agent2',
  'generate_linkedin_query_agent3',
  'generate_linkedin_query_agent4',
]);

export const REGENERATION_CHECKPOINT_TOOLS = new Set([
  'generate_linkedin_query_set',
  'generate_iterative_linkedin_query_set',
  'search_linkedin_parameters',
  'search_linkedin_people',
]);
