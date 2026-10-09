import { ToolCategory } from 'twenty-shared/ai';

import { type ToolIndexEntry } from 'src/engine/core-modules/tool-provider/types/tool-index-entry.type';

export const TOOL_CATALOG_DEFAULT_LIMIT = 50;
export const TOOL_CATALOG_MAX_LIMIT = 100;
const TOOL_CATALOG_DESCRIPTION_MAX_LENGTH = 140;

const EXTERNAL_MCP_NAMESPACE_SEPARATOR = '__';

export type ToolCatalogIndexEntry = {
  category: string;
  count: number;
  servers?: Array<{ slug: string; count: number }>;
};

export type ToolCatalogResponse = {
  index?: ToolCatalogIndexEntry[];
  catalog?: Record<string, Array<{ name: string; description: string }>>;
  message: string;
};

export type BuildToolCatalogResponseInput = {
  entries: ToolIndexEntry[];
  categories?: string[];
  server?: string;
  query?: string;
  limit?: number;
  offset?: number;
};

export const getExternalMcpServerSlug = (toolName: string): string | null => {
  const separatorIndex = toolName.indexOf(EXTERNAL_MCP_NAMESPACE_SEPARATOR);

  return separatorIndex > 0 ? toolName.slice(0, separatorIndex) : null;
};

const buildIndex = (entries: ToolIndexEntry[]): ToolCatalogIndexEntry[] => {
  const countsByCategory = new Map<string, number>();
  const serverCounts = new Map<string, number>();

  for (const entry of entries) {
    countsByCategory.set(
      entry.category,
      (countsByCategory.get(entry.category) ?? 0) + 1,
    );

    if (entry.category === ToolCategory.EXTERNAL_MCP) {
      const slug = getExternalMcpServerSlug(entry.name);

      if (slug !== null) {
        serverCounts.set(slug, (serverCounts.get(slug) ?? 0) + 1);
      }
    }
  }

  return [...countsByCategory.entries()].map(([category, count]) => ({
    category,
    count,
    ...(category === ToolCategory.EXTERNAL_MCP
      ? {
          servers: [...serverCounts.entries()]
            .map(([slug, serverCount]) => ({ slug, count: serverCount }))
            .sort((first, second) => second.count - first.count),
        }
      : {}),
  }));
};

const truncateDescription = (description: string): string => {
  const firstLine = description.split('\n')[0].trim();

  return firstLine.length > TOOL_CATALOG_DESCRIPTION_MAX_LENGTH
    ? `${firstLine.slice(0, TOOL_CATALOG_DESCRIPTION_MAX_LENGTH - 1)}…`
    : firstLine;
};

const countNameHits = (entry: ToolIndexEntry, terms: string[]): number => {
  const name = entry.name.toLowerCase();

  return terms.filter((term) => name.includes(term)).length;
};

const matchesQuery = (entry: ToolIndexEntry, terms: string[]): boolean => {
  const haystack = `${entry.name} ${entry.description}`.toLowerCase();

  return terms.every((term) => haystack.includes(term));
};

export const buildToolCatalogResponse = ({
  entries,
  categories,
  server,
  query,
  limit,
  offset,
}: BuildToolCatalogResponseInput): ToolCatalogResponse => {
  const hasFilter =
    (categories?.length ?? 0) > 0 ||
    (server?.length ?? 0) > 0 ||
    (query?.trim().length ?? 0) > 0;

  if (!hasFilter) {
    const index = buildIndex(entries);

    return {
      index,
      message: `${entries.length} tool(s) across ${index.length} category(ies). Call again with categories, server or query to list tool names.`,
    };
  }

  const categoryFilter = categories?.length ? new Set(categories) : undefined;
  const terms = (query ?? '')
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 0);

  const filtered = entries.filter((entry) => {
    if (categoryFilter && !categoryFilter.has(entry.category)) {
      return false;
    }

    if (server) {
      if (
        entry.category !== ToolCategory.EXTERNAL_MCP ||
        getExternalMcpServerSlug(entry.name) !== server
      ) {
        return false;
      }
    }

    return terms.length === 0 || matchesQuery(entry, terms);
  });

  // Name matches first so keyword searches surface the obvious tool, not a description mention
  const matching =
    terms.length === 0
      ? filtered
      : [...filtered].sort(
          (first, second) =>
            countNameHits(second, terms) - countNameHits(first, terms),
        );

  const pageSize = Math.min(
    Math.max(limit ?? TOOL_CATALOG_DEFAULT_LIMIT, 1),
    TOOL_CATALOG_MAX_LIMIT,
  );
  const start = Math.max(offset ?? 0, 0);
  const page = matching.slice(start, start + pageSize);

  const catalog: Record<string, Array<{ name: string; description: string }>> =
    {};

  for (const entry of page) {
    (catalog[entry.category] ??= []).push({
      name: entry.name,
      description: truncateDescription(entry.description),
    });
  }

  const remaining = matching.length - (start + page.length);
  const paginationHint =
    remaining > 0
      ? ` ${remaining} more not shown: pass offset=${start + page.length} or narrow with server/query.`
      : '';

  return {
    catalog,
    message: `Showing ${page.length} of ${matching.length} matching tool(s).${paginationHint}`,
  };
};
