import { MCP_TOOL_DESCRIPTIONS } from 'src/engine/core-modules/arxena-tools/constants/mcp-tool-descriptions.const';
import assert from 'node:assert/strict';


import { resetSearchToolsConfigCacheForTests } from '../../api/search-tools-config';
import { type ArxenaConfig } from '../../config';
import { type McpTool } from '../../types/tool-types';
import { buildMetaTools, resolveSurfaceTools } from '../meta-tools';
import { searchFetchTools } from '../search-fetch-tools';

const CONFIG: ArxenaConfig = { apiToken: 'token', baseUrl: 'http://server.test' };

const originalFetch = globalThis.fetch;

const mockServerFlags = (flags: Record<string, boolean>) => {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(flags), { status: 200 })) as typeof fetch;
};

const buildFakeTool = (name: string): McpTool => ({
  definition: {
    name,
    title: name,
    description: name,
    inputSchema: { type: 'object', properties: {} },
  },
  handler: async () => ({ ran: name }),
});

const findMetaTool = (tools: McpTool[], name: string): McpTool => {
  const tool = tools.find((candidate) => candidate.definition.name === name);

  assert.ok(tool, `meta tool ${name} missing`);

  return tool;
};

describe('meta-tools provider flags', () => {
  beforeEach(() => resetSearchToolsConfigCacheForTests());
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('refuses execute_tool for a provider disabled on the server', async () => {
    mockServerFlags({ isSearchApolloPeopleEnabled: false });
    const tools = buildMetaTools([
      buildFakeTool('search_apollo_people'),
      buildFakeTool('search_linkedin_people'),
    ]);
    const executeTool = findMetaTool(tools, 'execute_tool');

    const disabled = (await executeTool.handler(
      { toolName: 'search_apollo_people', arguments: {} },
      CONFIG,
    )) as { success?: boolean };
    const enabled = (await executeTool.handler(
      { toolName: 'search_linkedin_people', arguments: {} },
      CONFIG,
    )) as { ran?: string };

    assert.equal(disabled.success, false);
    assert.equal(enabled.ran, 'search_linkedin_people');
  });
});

describe('library tool surface', () => {
  // Skills, catalog browsing and instructions are served by the NestJS /mcp only;
  // this process just executes tools for the server-side bridge.
  it('lists only the tools the server-side bridge calls', () => {
    const listed = resolveSurfaceTools(
      [...searchFetchTools, buildFakeTool('search_people_api')],
      { metaToolsOnly: true },
    );

    assert.deepEqual(
      listed.map((tool) => tool.definition.name).sort(),
      ['execute_tool', 'fetch', 'learn_tools', 'search'],
    );
  });

  it('uses the shared MCP tool descriptions for the generic tools', () => {
    const tools = [...buildMetaTools([]), ...searchFetchTools];

    for (const tool of tools) {
      const name = tool.definition.name as keyof typeof MCP_TOOL_DESCRIPTIONS;

      assert.ok(name in MCP_TOOL_DESCRIPTIONS, `${name} missing from twenty-shared`);
      assert.equal(
        tool.definition.description,
        MCP_TOOL_DESCRIPTIONS[name],
        `${name} description drifted from twenty-shared`,
      );
    }
  });
});
