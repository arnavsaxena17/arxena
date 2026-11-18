import {
  ARXENA_TOOL_CATALOG,
  ARXENA_TOOL_NAMES,
} from 'src/engine/core-modules/arxena-tools/constants/arxena-tool-catalog.const';
import { readFileSync } from 'fs';
import { join } from 'path';

import {
  ARXENA_TOOL_SELECTION_QUERIES,
  countToolsInContext,
  scoreToolSelection,
} from 'src/engine/core-modules/arxena-tools/evaluation/arxena-tool-selection-queries';
import { ToolCategory } from 'twenty-shared/ai';

describe('Arxena tool catalog', () => {
  // SIMPLIFIED_SEARCH: this build serves Bright Data plus the tab/project/person
  // surface only, so the catalog is smaller and the provider families below are
  // absent. Restore the full-surface assertions with library/tools/index.ts.
  it('exposes Arxena tools without internal tools', () => {
    expect(ARXENA_TOOL_CATALOG.length).toBeGreaterThan(20);
    // Kept: Bright Data and the helpers the sourcing loop needs
    expect(ARXENA_TOOL_NAMES.has('search_bright_data_business')).toBe(true);
    expect(ARXENA_TOOL_NAMES.has('parse_job_description')).toBe(true);
    expect(ARXENA_TOOL_NAMES.has('expand_job_titles')).toBe(true);
    // Gone: every other database and the LinkedIn/Unipile families
    expect(ARXENA_TOOL_NAMES.has('get_org_chart')).toBe(false);
    expect(ARXENA_TOOL_NAMES.has('get_org_chart_node_people')).toBe(false);
    expect(ARXENA_TOOL_NAMES.has('google_serp_search')).toBe(false);
    expect(ARXENA_TOOL_NAMES.has('list_linkedin_relations')).toBe(false);
    expect(ARXENA_TOOL_NAMES.has('search_linkedin_people')).toBe(false);
    expect(ARXENA_TOOL_NAMES.has('search_harvest_leads')).toBe(false);
    expect(ARXENA_TOOL_NAMES.has('search_people_index')).toBe(false);
    expect(ARXENA_TOOL_NAMES.has('search_apollo_people')).toBe(false);
    expect(ARXENA_TOOL_NAMES.has('search_wikidata_companies')).toBe(false);
    expect(ARXENA_TOOL_NAMES.has('classify_taxonomy_profile')).toBe(false);
    expect(ARXENA_TOOL_NAMES.has('list_taxonomy_slice')).toBe(false);
    expect(ARXENA_TOOL_NAMES.has('generate_linkedin_query_agent1')).toBe(false);
  });

  it('registers classify_taxonomy_profile with profile or jobTitle', () => {
    const source = readFileSync(
      join(__dirname, '../library/tools/people-api-tools.ts'),
      'utf8',
    );

    expect(source).toContain("name: 'classify_taxonomy_profile'");
    expect(source).toContain("name: 'list_taxonomy_slice'");
    expect(source).toContain('args.profile');
    expect(source).toContain('args.jobTitle');
    expect(source).toContain('taxonomy/classify-llm');
    expect(source).toContain('taxonomy/slice');
  });
});

describe('tool selection evaluation harness', () => {
  it('is sales-weighted', () => {
    const sales = ARXENA_TOOL_SELECTION_QUERIES.filter(
      (query) => query.persona === 'sales',
    ).length;
    const total = ARXENA_TOOL_SELECTION_QUERIES.length;

    expect(sales / total).toBeGreaterThanOrEqual(0.5);
  });

  it('scores expected tool hints', () => {
    expect(
      scoreToolSelection(ARXENA_TOOL_SELECTION_QUERIES[1], ['get_org_chart']),
    ).toBe(true);
    expect(
      scoreToolSelection(ARXENA_TOOL_SELECTION_QUERIES[1], ['send_chat']),
    ).toBe(false);
  });

  it('counts tools in context without treating catalog as schemas', () => {
    const catalog = [
      {
        name: 'get_org_chart',
        label: 'Get Org Chart',
        description: 'x',
        category: 'ARXENA' as ToolCategory,
        executionRef: { kind: 'static' as const, toolId: 'get_org_chart' },
      },
      {
        name: 'apollo__search',
        label: 'Apollo Search',
        description: 'x',
        category: 'EXTERNAL_MCP' as ToolCategory,
        executionRef: { kind: 'static' as const, toolId: 'apollo__search' },
      },
    ];

    expect(countToolsInContext(catalog, ['get_org_chart'])).toEqual({
      catalogSize: 2,
      schemasInContext: 1,
      arxenaCount: 1,
      externalMcpCount: 1,
    });
  });
});
