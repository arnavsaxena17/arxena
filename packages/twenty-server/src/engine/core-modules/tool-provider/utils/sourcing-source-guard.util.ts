import {
  SEARCH_HARVEST_ACCOUNTS_TOOL_NAME,
  SEARCH_HARVEST_LEADS_TOOL_NAME,
  SEARCH_LINKEDIN_CONTINUE_TOOL_NAME,
} from 'src/engine/core-modules/arxena-tools/constants/arxena-tool-names.const';
import { SOURCING_SOURCES } from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/sourcing-sources.constant';

// The sources the user is asked to pick from at the start of a run. Others
// (the name resolver, Google Maps) are not part of that choice.
const CHOOSABLE_SOURCE_KEYS = [
  'internal-index',
  'bright-data',
  'serp',
  'harvest',
  'linkedin',
  'apollo',
  'exa',
  'wikidata',
];

// Tools a source entry does not list for learn_tools but that still call it
const EXTRA_TOOLS_BY_SOURCE: Record<string, string[]> = {
  harvest: [SEARCH_HARVEST_LEADS_TOOL_NAME, SEARCH_HARVEST_ACCOUNTS_TOOL_NAME],
  linkedin: [SEARCH_LINKEDIN_CONTINUE_TOOL_NAME],
};

const buildSourceKeyByToolName = (): Map<string, string> => {
  const map = new Map<string, string>();

  for (const source of SOURCING_SOURCES) {
    if (!CHOOSABLE_SOURCE_KEYS.includes(source.key)) {
      continue;
    }

    for (const toolName of [
      ...(source.people?.learnTools ?? []),
      ...(source.companies?.learnTools ?? []),
      ...(EXTRA_TOOLS_BY_SOURCE[source.key] ?? []),
    ]) {
      map.set(toolName, source.key);
    }
  }

  return map;
};

const SOURCE_KEY_BY_TOOL_NAME = buildSourceKeyByToolName();

export const sourceKeyOfTool = (toolName: string): string | undefined =>
  SOURCE_KEY_BY_TOOL_NAME.get(toolName);

// Undefined when the call may go ahead; otherwise the refusal text. No brief,
// or a brief without a source choice, restricts nothing.
export const sourceRefusalFor = (
  toolName: string,
  allowedSources: string[] | undefined,
): string | undefined => {
  const sourceKey = sourceKeyOfTool(toolName);

  if (sourceKey === undefined || allowedSources === undefined) {
    return undefined;
  }

  if (allowedSources.includes(sourceKey)) {
    return undefined;
  }

  const label =
    SOURCING_SOURCES.find((source) => source.key === sourceKey)?.label ??
    sourceKey;

  return `${label} was not picked as a data source for this run (picked: ${allowedSources.join(', ')}). Use a picked source, or ask the user whether to add ${label} and record it with get_sourcing_ledger({ brief: { sources } }).`;
};
