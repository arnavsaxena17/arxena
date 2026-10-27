const MCP_RESULT_MAX_CHARS = 100_000;

// The server routes these results into lists and never shows rows to the
// model, so a full 100-row page (company summaries are long) must reach it
// intact; a truncated page cannot be parsed into list rows.
const LIST_ROUTED_RESULT_MAX_CHARS = 500_000;
const LIST_ROUTED_TOOL_NAMES = new Set([
  'search_linkedin_companies',
  'search_linkedin_people',
  'search_linkedin_from_url',
  'search_linkedin_continue',
  'search_harvest_leads',
  'search_harvest_accounts',
]);

export const truncateToolResult = (
  value: unknown,
  toolName?: string,
): unknown => {
  const maxChars =
    toolName !== undefined && LIST_ROUTED_TOOL_NAMES.has(toolName)
      ? LIST_ROUTED_RESULT_MAX_CHARS
      : MCP_RESULT_MAX_CHARS;
  const serialized = JSON.stringify(value);
  if (serialized.length <= maxChars) {
    return value;
  }

  return {
    truncated: true,
    message: `Result exceeded ${maxChars} characters and was truncated.`,
    preview: serialized.slice(0, maxChars),
  };
};
