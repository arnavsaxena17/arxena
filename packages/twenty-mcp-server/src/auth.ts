const MCP_RESULT_MAX_CHARS = 100_000;

export const truncateToolResult = (value: unknown): unknown => {
  const serialized = JSON.stringify(value);
  if (serialized.length <= MCP_RESULT_MAX_CHARS) {
    return value;
  }

  return {
    truncated: true,
    message: `Result exceeded ${MCP_RESULT_MAX_CHARS} characters and was truncated.`,
    preview: serialized.slice(0, MCP_RESULT_MAX_CHARS),
  };
};
