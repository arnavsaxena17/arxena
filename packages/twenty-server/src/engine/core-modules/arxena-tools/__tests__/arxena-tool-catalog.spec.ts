import {
  ARXENA_TOOL_CATALOG,
  ARXENA_TOOL_NAMES,
} from 'src/engine/core-modules/arxena-tools/constants/arxena-tool-catalog.const';
import {
  ARXENA_TOOL_SELECTION_QUERIES,
  countToolsInContext,
  scoreToolSelection,
} from 'src/engine/core-modules/arxena-tools/evaluation/arxena-tool-selection-queries';
import { ToolCategory } from 'twenty-shared/ai';

describe('Arxena tool catalog', () => {
  it('exposes GTM packs without internal tools', () => {
    expect(ARXENA_TOOL_CATALOG.length).toBeGreaterThan(50);
    expect(ARXENA_TOOL_NAMES.has('get_org_chart')).toBe(true);
    expect(ARXENA_TOOL_NAMES.has('generate_linkedin_query_agent1')).toBe(
      false,
    );
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
