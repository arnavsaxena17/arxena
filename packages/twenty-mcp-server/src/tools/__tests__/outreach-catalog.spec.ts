import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ARXENA_INTERNAL_TOOL_NAMES,
  ARXENA_TOOL_CATALOG,
  getOutreachSkillContent,
  listOutreachSkillNames,
} from 'twenty-shared/outreach';

import { allTools } from '../index';

// Catalog entries whose MCP handlers are commented out today. Remove each name
// from here once its handler is restored or the catalog entry is deleted.
const KNOWN_CATALOG_ENTRIES_WITHOUT_HANDLER = new Set([
  'send_shortlist_to_client',
  'search_linkedin_with_query',
  'find_person_in_arxena_internal',
  'update_contact_info_in_arxena_internal',
  'get_candidate_fields_for_project',
  'get_candidate_field_values',
]);

// Tools the shared playbooks mention that only exist on the Ask AI surface.
const ASK_AI_ONLY_TOOL_NAMES = new Set(['search_help_center']);

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
    ]);
    const toolNamePattern = /`([a-z][a-z0-9]*(?:_[a-z0-9]+)+)`/g;
    const unknownReferences: string[] = [];

    for (const name of listOutreachSkillNames()) {
      const content = getOutreachSkillContent(name);

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
