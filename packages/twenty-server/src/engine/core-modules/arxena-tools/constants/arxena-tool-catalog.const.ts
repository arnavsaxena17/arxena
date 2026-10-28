import {
  ARXENA_INTERNAL_TOOL_NAMES,
  UNLISTED_LIBRARY_TOOLS,
} from 'src/engine/core-modules/arxena-tools/constants/arxena-tool-listing.const';
import { allTools } from 'src/engine/core-modules/arxena-tools/library/tools/index';

export type ArxenaToolCatalogEntry = {
  name: string;
  label: string;
  description: string;
};

export { ARXENA_INTERNAL_TOOL_NAMES, UNLISTED_LIBRARY_TOOLS };

const toCatalogLabel = (name: string, title?: string): string =>
  title ??
  name
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

// Built-in Arxena tools exposed via ToolCategory.ARXENA.
// Names, labels, and descriptions come from library/tools (schema + handler).
// Schemas for learn_tools are still loaded on demand from the MCP catalog cache.
export const ARXENA_TOOL_CATALOG: readonly ArxenaToolCatalogEntry[] = allTools
  .filter((tool) => !UNLISTED_LIBRARY_TOOLS.has(tool.definition.name))
  .map((tool) => ({
    name: tool.definition.name,
    label: toCatalogLabel(tool.definition.name, tool.definition.title),
    description: tool.definition.description,
  }));

export const ARXENA_TOOL_NAMES = new Set(
  ARXENA_TOOL_CATALOG.map((entry) => entry.name),
);
