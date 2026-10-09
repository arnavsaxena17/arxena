import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { resetSearchToolsConfigCacheForTests } from '../../api/search-tools-config';
import { type ArxenaConfig } from '../../config';
import { type McpTool } from '../../types/tool-types';
import { buildMetaServerInstructions, buildMetaTools } from '../meta-tools';

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

  it('strips disabled provider sections from the search skill', async () => {
    mockServerFlags({ isSearchApolloCompaniesEnabled: false });
    const loadSkills = findMetaTool(buildMetaTools([]), 'load_skills');

    const result = (await loadSkills.handler(
      { skillNames: ['search'] },
      CONFIG,
    )) as { skills: Array<{ content: string }> };

    assert.ok(result.skills[0].content.includes('resolve_company_from_raw_name'));
    assert.ok(
      !result.skills[0].content.includes(
        '<!-- search-apollo-companies-provider-row:start -->',
      ),
    );
  });

  it('serves every provider when the server flags cannot be fetched', async () => {
    globalThis.fetch = (async () => {
      throw new Error('offline');
    }) as typeof fetch;
    const loadSkills = findMetaTool(buildMetaTools([]), 'load_skills');

    const result = (await loadSkills.handler(
      { skillNames: ['search'] },
      CONFIG,
    )) as { skills: Array<{ content: string }> };

    assert.ok(
      result.skills[0].content.includes(
        '<!-- search-apollo-companies-provider-row:start -->',
      ),
    );
  });

  it('lists the same skill names as the shared Ask AI playbooks', async () => {
    const listSkills = findMetaTool(buildMetaTools([]), 'list_skills');

    const result = (await listSkills.handler({}, CONFIG)) as {
      skillNames: string[];
    };

    assert.deepEqual(result.skillNames.sort(), [
      'local-business-search',
      'org-structure-insights',
      'outreach',
      'resolve-company-name',
      'search',
      'setup',
    ]);
  });
});

describe('meta server instructions', () => {
  it('shares intent routing and destination rules with Ask AI', () => {
    const instructions = buildMetaServerInstructions();

    assert.ok(instructions.includes('load_skills(["search"])'));
    assert.ok(instructions.includes('### Destination verbs (choose before tools)'));
    assert.ok(instructions.includes('Do NOT enroll until the user confirms'));
    assert.ok(!instructions.includes('workflow-building'));
    assert.ok(!instructions.includes('highlight_org_chart'));
  });
});
