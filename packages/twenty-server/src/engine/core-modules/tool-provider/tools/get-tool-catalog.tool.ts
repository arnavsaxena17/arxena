import { z } from 'zod';

import { ToolCategory } from 'twenty-shared/ai';
import { type ToolRegistryService } from 'src/engine/core-modules/tool-provider/services/tool-registry.service';
import { type ToolIndexEntry } from 'src/engine/core-modules/tool-provider/types/tool-index-entry.type';
import {
  TOOL_CATALOG_DEFAULT_LIMIT,
  TOOL_CATALOG_MAX_LIMIT,
  buildToolCatalogResponse,
  type ToolCatalogResponse,
} from 'src/engine/core-modules/tool-provider/utils/build-tool-catalog-response.util';

export const GET_TOOL_CATALOG_TOOL_NAME = 'get_tool_catalog';

const availableCategories = Object.values(ToolCategory)
  .map((entry) => entry.toString())
  .join(', ');

export const getToolCatalogInputSchema = z.object({
  categories: z
    .array(z.string())
    .optional()
    .describe(
      `Filter by category. Available categories: ${availableCategories}.`,
    ),
  server: z
    .string()
    .optional()
    .describe(
      'Connected MCP server slug (e.g. "unipile"). Lists only that server\'s tools. Slugs appear in the index under EXTERNAL_MCP.',
    ),
  query: z
    .string()
    .optional()
    .describe(
      'Keyword search over tool names and descriptions (all terms must match).',
    ),
  limit: z
    .number()
    .int()
    .optional()
    .describe(
      `Max tools to return (default ${TOOL_CATALOG_DEFAULT_LIMIT}, max ${TOOL_CATALOG_MAX_LIMIT}).`,
    ),
  offset: z.number().int().optional().describe('Pagination offset.'),
});

export type GetToolCatalogInput = z.infer<typeof getToolCatalogInputSchema>;

export type GetToolCatalogResult = ToolCatalogResponse;

export const createGetToolCatalogTool = (
  toolRegistry: ToolRegistryService,
  workspaceId: string,
  roleId: string,
  options?: {
    userId?: string;
    userWorkspaceId?: string;
    excludeTools?: Set<string>;
  },
) => ({
  description:
    'Discover tools without loading them. With no arguments returns a compact index (categories and connected MCP servers with counts). Pass categories, server (e.g. "unipile") or query to list tool names, then call learn_tools for only the ones you will run. Skip this when you already know the tool names (CRUD grammar, loaded skills).',
  inputSchema: getToolCatalogInputSchema,
  execute: async (
    parameters: GetToolCatalogInput,
  ): Promise<GetToolCatalogResult> => {
    const entries = (await toolRegistry.buildToolIndex(
      workspaceId,
      roleId,
      options,
    )) as ToolIndexEntry[];

    const excludeSet = options?.excludeTools;

    return buildToolCatalogResponse({
      entries: excludeSet
        ? entries.filter((entry) => !excludeSet.has(entry.name))
        : entries,
      categories: parameters.categories,
      server: parameters.server,
      query: parameters.query,
      limit: parameters.limit,
      offset: parameters.offset,
    });
  },
});
