import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import { callArxenaTool } from '../../lib';

const CONFIG = {
  apiToken: 'token',
  baseUrl: 'http://server.test',
  disabledToolNames: ['search_apollo_people'],
};

const originalFetch = globalThis.fetch;

const readText = (result: { content: Array<{ text: string }> }) =>
  JSON.parse(result.content[0].text) as Record<string, unknown>;

describe('library entry', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('refuses tools the server has disabled without asking the server', async () => {
    let fetchCalls = 0;

    globalThis.fetch = (async () => {
      fetchCalls += 1;

      return new Response('{}');
    }) as typeof fetch;

    const result = await callArxenaTool(CONFIG, 'execute_tool', {
      toolName: 'search_apollo_people',
      arguments: {},
    });

    assert.equal(readText(result).success, false);
    assert.equal(fetchCalls, 0);
  });

  it('learns schemas for catalog tools and reports unknown names', async () => {
    const result = await callArxenaTool(CONFIG, 'learn_tools', {
      toolNames: ['get_org_chart', 'not_a_real_tool', 'search_apollo_people'],
    });
    const payload = readText(result) as {
      tools: Array<{ name: string; inputSchema: object }>;
      notFound: string[];
    };

    assert.deepEqual(
      payload.tools.map((tool) => tool.name),
      ['get_org_chart'],
    );
    assert.deepEqual(payload.notFound.sort(), [
      'not_a_real_tool',
      'search_apollo_people',
    ]);
  });

  it('exposes search and fetch as top-level tools', async () => {
    const result = await callArxenaTool(CONFIG, 'fetch', { id: 'bad-id' });

    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /Invalid document id/);
  });

  it('does not offer internal tools through execute_tool', async () => {
    const result = await callArxenaTool(CONFIG, 'execute_tool', {
      toolName: 'resolve_parameters',
      arguments: {},
    });

    assert.equal(readText(result).success, false);
  });
});
