import {
  ARXENA_INTERNAL_TOOL_NAMES,
  ARXENA_TOOL_CATALOG,
} from 'src/engine/core-modules/arxena-tools/constants/arxena-tool-catalog.const';
import assert from 'node:assert/strict';


import { getSkillContent, listSkillNames } from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/skill-library';

import { esIndexSearchTools } from 'src/engine/core-modules/arxena-tools/library/tools/es-index-search-tools';
import { harvestSearchTools } from 'src/engine/core-modules/arxena-tools/library/tools/harvest-search-tools';
import { linkedinSearchTools } from 'src/engine/core-modules/arxena-tools/library/tools/linkedin-search-tools';
import { orgChartTools } from 'src/engine/core-modules/arxena-tools/library/tools/org-chart-tools';
import { peopleApiTools } from 'src/engine/core-modules/arxena-tools/library/tools/people-api-tools';
import { unipileControllersTools } from 'src/engine/core-modules/arxena-tools/library/tools/unipile-controllers-tools';
import { wikidataTools } from 'src/engine/core-modules/arxena-tools/library/tools/wikidata-tools';
import { allTools } from '../index';

// Catalog entries whose MCP handlers are commented out today. Remove each name
// from here once its handler is restored or the catalog entry is deleted.
// Catalog entries whose MCP handlers are commented out. Empty today; add a name
// here only while its handler is being restored.
const KNOWN_CATALOG_ENTRIES_WITHOUT_HANDLER = new Set<string>();

// Tools the shared playbooks mention that only exist on the Ask AI surface.
const ASK_AI_ONLY_TOOL_NAMES = new Set(['search_help_center']);

// SIMPLIFIED_SEARCH: these provider tool families are commented out of ./index,
// so they are no longer in allTools or ARXENA_TOOL_CATALOG. The skill sections
// that name them still ship until the IS_SEARCH_* flags strip them at runtime.
const SWITCHED_OFF_PROVIDER_TOOL_NAMES: string[] = [
  ...linkedinSearchTools,
  ...harvestSearchTools,
  ...peopleApiTools,
  ...orgChartTools,
  ...esIndexSearchTools,
  ...wikidataTools,
  ...unipileControllersTools,
].map((tool) => tool.definition.name);
// The two Apollo tools are commented out inside candidateSearchTools, which
// still serves the LLM query-construction helpers.
const SWITCHED_OFF_APOLLO_TOOL_NAMES = [
  'search_apollo_people',
  'search_apollo_companies',
];

describe('outreach catalog vs MCP handlers', () => {
  it('has a handler or an internal marker for every catalog tool', () => {
    const handlerNames = new Set(allTools.map((tool) => tool.definition.name));

    const orphanNames = ARXENA_TOOL_CATALOG.map((entry) => entry.name).filter(
      (name) =>
        !handlerNames.has(name) &&
        !ARXENA_INTERNAL_TOOL_NAMES.has(name) &&
        !KNOWN_CATALOG_ENTRIES_WITHOUT_HANDLER.has(name),
    );

    assert.deepEqual(orphanNames, []);
  });

  it('only references tools that exist in the catalog or as handlers', () => {
    const knownNames = new Set([
      ...allTools.map((tool) => tool.definition.name),
      ...ARXENA_TOOL_CATALOG.map((entry) => entry.name),
      ...SWITCHED_OFF_PROVIDER_TOOL_NAMES,
      ...SWITCHED_OFF_APOLLO_TOOL_NAMES,
    ]);
    const toolNamePattern = /`([a-z][a-z0-9]*(?:_[a-z0-9]+)+)`/g;
    const unknownReferences: string[] = [];

    for (const name of listSkillNames()) {
      const content = getSkillContent(name);

      for (const match of content.matchAll(toolNamePattern)) {
        const candidate = match[1];

        if (
          candidate.startsWith('search_') &&
          !knownNames.has(candidate) &&
          !ASK_AI_ONLY_TOOL_NAMES.has(candidate)
        ) {
          unknownReferences.push(`${name}: ${candidate}`);
        }
      }
    }

    assert.deepEqual([...new Set(unknownReferences)], []);
  });
});
