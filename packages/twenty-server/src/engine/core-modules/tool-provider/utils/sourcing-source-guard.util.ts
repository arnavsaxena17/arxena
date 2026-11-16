import { isNonEmptyString } from '@sniptt/guards';

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
  linkedin: [
    SEARCH_LINKEDIN_CONTINUE_TOOL_NAME,
    'search_linkedin_from_url',
    'search_linkedin_jobs',
    'search_linkedin_posts',
    'list_linkedin_relations',
  ],
  apollo: ['fetch_contacts_from_apollo'],
  'internal-index': [
    'search_org_charts_by_country',
    'search_org_charts_by_function',
  ],
};

// Contact reveal changes who is reachable, not who is found, and these
// providers are not on the list the user picks from, so the pick cannot refuse
// them; the budget service still meters them
export const SOURCE_GUARD_EXEMPT_TOOLS: Record<string, string> = {
  fetch_contacts: 'contact waterfall across Arxena, ContactOut, Lusha, Apollo',
  fetch_contacts_from_arxena: 'Arxena contact store',
  fetch_contacts_from_contactout: 'ContactOut contact reveal',
  fetch_contacts_from_lusha: 'Lusha contact reveal',
  fetch_email: 'contact waterfall, email only',
  fetch_phone: 'contact waterfall, phone only',
  search_local_businesses: 'Google Maps places, not a people or company pick',
  search_local_businesses_nearby:
    'Google Maps places, not a people or company pick',
};

// search_people_by_job_title is an alias of search_people_api
const PEOPLE_API_TOOL_NAMES = [
  'search_people_api',
  'search_people_by_job_title',
];

// People API dataSource -> source key. pdl and contactout are not choosable.
const SOURCE_KEY_BY_PEOPLE_API_DATA_SOURCE: Record<string, string> = {
  index: 'internal-index',
  apollo: 'apollo',
  harvest: 'harvest',
  unipile: 'linkedin',
  pool: 'linkedin',
  bright_data: 'bright-data',
};

// auto resolves at call time to the member's Unipile seat, else the index
const PEOPLE_API_AUTO_SOURCE_KEYS = ['linkedin', 'internal-index'];

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

// The source keys one call may spend on; empty when the call is no source
export const sourceKeysOfCall = (
  toolName: string,
  args: Record<string, unknown> | undefined,
): string[] => {
  if (!PEOPLE_API_TOOL_NAMES.includes(toolName)) {
    const sourceKey = sourceKeyOfTool(toolName);

    return sourceKey === undefined ? [] : [sourceKey];
  }

  const dataSource =
    typeof args?.dataSource === 'string' ? args.dataSource : 'auto';

  if (dataSource === 'auto') {
    return PEOPLE_API_AUTO_SOURCE_KEYS;
  }

  const sourceKey = SOURCE_KEY_BY_PEOPLE_API_DATA_SOURCE[dataSource];

  return sourceKey === undefined ? [] : [sourceKey];
};

// Undefined when the call may go ahead; otherwise the refusal text. No brief,
// or a brief without a source choice, restricts nothing.
export const sourceRefusalFor = (
  toolName: string,
  allowedSources: string[] | undefined,
  args?: Record<string, unknown>,
): string | undefined => {
  if (allowedSources === undefined) {
    return undefined;
  }

  const sourceKey = sourceKeysOfCall(toolName, args).find(
    (key) => !allowedSources.includes(key),
  );

  if (sourceKey === undefined) {
    return undefined;
  }

  if (
    PEOPLE_API_TOOL_NAMES.includes(toolName) &&
    !isNonEmptyString(args?.dataSource)
  ) {
    return `${toolName} without dataSource may use LinkedIn or the internal index, and not both were picked (picked: ${allowedSources.join(', ')}). Pass dataSource for a picked source.`;
  }

  const label =
    SOURCING_SOURCES.find((source) => source.key === sourceKey)?.label ??
    sourceKey;

  return `${label} was not picked as a data source for this run (picked: ${allowedSources.join(', ')}). Use a picked source, or ask the user whether to add ${label} and record it with get_sourcing_ledger({ brief: { sources } }).`;
};
