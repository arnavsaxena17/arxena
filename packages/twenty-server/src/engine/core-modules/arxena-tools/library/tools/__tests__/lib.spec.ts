import assert from 'node:assert/strict';

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

  it('answers a route in process, without calling the server over HTTP', async () => {
    let fetchCalls = 0;
    const requests: Array<{ pathPrefix: string; endpoint: string; body?: unknown }> = [];

    globalThis.fetch = (async () => {
      fetchCalls += 1;

      return new Response('{}');
    }) as typeof fetch;

    const result = await callArxenaTool(
      {
        ...CONFIG,
        restTransport: async (request) => {
          requests.push(request);

          return request.pathPrefix === 'bright-data/business-search'
            ? { handled: true, data: { success: true, message: 'in process' } }
            : { handled: false };
        },
      },
      'execute_tool',
      {
        toolName: 'search_bright_data_business',
        arguments: { entity: 'people', query: 'CEO of Acme', autoExecute: true },
      },
    );

    assert.equal(readText(result).message, 'in process');
    assert.equal(fetchCalls, 0);
    assert.equal(requests[0].endpoint, 'people');
    assert.deepEqual(
      { query: (requests[0].body as { query: string }).query },
      { query: 'CEO of Acme' },
    );
  });

  it('falls back to HTTP for a route the transport does not answer', async () => {
    let fetchCalls = 0;

    globalThis.fetch = (async () => {
      fetchCalls += 1;

      return new Response(JSON.stringify({ success: true, message: 'over http' }));
    }) as typeof fetch;

    const result = await callArxenaTool(
      { ...CONFIG, restTransport: async () => ({ handled: false }) },
      'execute_tool',
      {
        toolName: 'search_bright_data_business',
        arguments: { entity: 'people', query: 'CEO of Acme' },
      },
    );

    assert.equal(readText(result).message, 'over http');
    assert.equal(fetchCalls, 1);
  });
});
