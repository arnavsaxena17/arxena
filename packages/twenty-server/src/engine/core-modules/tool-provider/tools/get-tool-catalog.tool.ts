import { z } from 'zod';

import { ToolCategory } from 'twenty-shared/ai';
import { type ToolRegistryService } from 'src/engine/core-modules/tool-provider/services/tool-registry.service';
import { type ToolIndexEntry } from 'src/engine/core-modules/tool-provider/types/tool-index-entry.type';

export const GET_TOOL_CATALOG_TOOL_NAME = 'get_tool_catalog';

const availableCategories = Object.values(ToolCategory)
  .map((entry) => entry.toString())
  .join(', ');

export const getToolCatalogInputSchema = z.object({
  categories: z
    .array(z.string())
    .optional()
    .describe(
      `Filter by category. Available categories: ${availableCategories}. Omit to get all.`,
    ),
});

export type GetToolCatalogInput = z.infer<typeof getToolCatalogInputSchema>;

export type GetToolCatalogResult = {
  catalog: Record<string, Array<{ name: string; description: string }>>;
  message: string;
};

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
    'Refresh-only. Browse available tools by category when the initialize instructions look stale or you need a category filter. Do not call this before learn_tools on the happy path. Construct CRUD names from grammar and take GTM names from loaded skills. Never request the full catalog when you already know the tool names.',
  inputSchema: getToolCatalogInputSchema,
  execute: async (
    parameters: GetToolCatalogInput,
  ): Promise<GetToolCatalogResult> => {
    const entries = await toolRegistry.buildToolIndex(
      workspaceId,
      roleId,
      options,
    );

    const categoryFilter = parameters.categories
      ? new Set(parameters.categories)
      : undefined;

    const excludeSet = options?.excludeTools;

    const catalog: Record<
      string,
      Array<{ name: string; description: string }>
    > = {};

    for (const entry of entries as ToolIndexEntry[]) {
      if (excludeSet?.has(entry.name)) {
        continue;
      }

      if (categoryFilter && !categoryFilter.has(entry.category)) {
        continue;
      }

      if (!catalog[entry.category]) {
        catalog[entry.category] = [];
      }

      catalog[entry.category].push({
        name: entry.name,
        description: entry.description,
      });
    }

    const totalTools = Object.values(catalog).reduce(
      (sum, tools) => sum + tools.length,
      0,
    );

    return {
      catalog,
      message: `Found ${totalTools} tool(s) across ${Object.keys(catalog).length} category(ies).`,
    };
  },
});
