import { z } from 'zod';

import { MCP_TOOL_DESCRIPTIONS } from 'src/engine/core-modules/arxena-tools/constants/mcp-tool-descriptions.const';

// Top-level `search` and `fetch` follow the OpenAI company-knowledge contract:
// search -> { results: [{ id, title, url }] }, fetch -> { id, title, text, url, metadata }.
export const SEARCH_TOOL_NAME = 'search';
export const FETCH_TOOL_NAME = 'fetch';

export const searchInputSchema = z.object({
  query: z
    .string()
    .describe('Search query for companies, org charts, jobs, or candidates'),
});

export const fetchInputSchema = z.object({
  id: z.string().describe('Document id from search results'),
});

export type RunArxenaTool = (
  toolName: string,
  args: Record<string, unknown>,
) => Promise<{ success: boolean; result?: object; error?: string }>;

const unwrapToolResult = async (
  runArxenaTool: RunArxenaTool,
  toolName: string,
  args: Record<string, unknown>,
): Promise<object> => {
  const output = await runArxenaTool(toolName, args);

  if (!output.success || output.result === undefined) {
    throw new Error(output.error ?? `${toolName} failed`);
  }

  const failure = output.result as { success?: boolean; error?: string };

  // The bridged handler reports its own failures as { success: false, error }
  if (failure.success === false) {
    throw new Error(failure.error ?? `${toolName} failed`);
  }

  return output.result;
};

export const createSearchTool = (runArxenaTool: RunArxenaTool) => ({
  description: MCP_TOOL_DESCRIPTIONS.search,
  inputSchema: searchInputSchema,
  execute: async (parameters: z.infer<typeof searchInputSchema>) => {
    const query = parameters.query.trim();

    if (query.length === 0) {
      throw new Error('query is required');
    }

    return unwrapToolResult(runArxenaTool, SEARCH_TOOL_NAME, { query });
  },
});

export const createFetchTool = (runArxenaTool: RunArxenaTool) => ({
  description: MCP_TOOL_DESCRIPTIONS.fetch,
  inputSchema: fetchInputSchema,
  execute: async (parameters: z.infer<typeof fetchInputSchema>) => {
    const id = parameters.id.trim();

    if (id.length === 0) {
      throw new Error('id is required');
    }

    return unwrapToolResult(runArxenaTool, FETCH_TOOL_NAME, { id });
  },
});
