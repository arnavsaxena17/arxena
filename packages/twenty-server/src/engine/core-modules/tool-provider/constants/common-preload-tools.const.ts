import { SEARCH_EXA_APP_TOOL_NAME } from 'src/engine/core-modules/arxena-tools/utils/search-tools-config';

// Tools whose schemas are always in the model's tool list. One list for Ask AI
// and the workspace MCP endpoint; unknown names are skipped when loading.
export const COMMON_PRELOAD_TOOLS: string[] = [
  'search_help_center',
  SEARCH_EXA_APP_TOOL_NAME,
];

// Drops tools the server has switched off, so the prompt never lists a tool
// that was not loaded
export const getPreloadToolNames = (
  excludedToolNames: ReadonlySet<string>,
): string[] =>
  COMMON_PRELOAD_TOOLS.filter((toolName) => !excludedToolNames.has(toolName));
