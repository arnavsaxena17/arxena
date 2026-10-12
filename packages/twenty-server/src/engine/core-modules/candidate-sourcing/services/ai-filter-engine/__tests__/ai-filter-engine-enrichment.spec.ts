import { type FilterSpec } from 'src/engine/core-modules/candidate-sourcing/services/ai-filter-engine/ai-filter-contract';
import { AiFilterEngineService } from 'src/engine/core-modules/candidate-sourcing/services/ai-filter-engine/ai-filter-engine.service';

const enrichmentSpec = (overrides: Partial<FilterSpec> = {}): FilterSpec => ({
  name: 'Company size',
  subject: 'person',
  criteria: 'Number of employees of the company in companyName',
  fields: [
    { name: 'employees', type: 'integer' },
    {
      name: 'band',
      type: 'enum',
      enumValues: ['<50', '50-500', '>500'],
    },
    { name: 'source', type: 'text' },
  ],
  model: 'gpt4omini',
  metadataFields: ['name', 'companyName'],
  allowUnknown: true,
  ...overrides,
});

const rows = [
  { id: 'a', name: 'Ann', companyName: 'Acme' },
  { id: 'b', name: 'Bob', companyName: 'Obscure Ltd' },
];

const buildEngine = (arxWebSearch?: {
  isAvailable: () => boolean;
  isStructuredAvailable?: () => boolean;
  isSerpAvailable?: () => boolean;
  sonarBacklogMs?: number;
  completeStructured?: jest.Mock;
  search: jest.Mock;
}) => {
  const service = new AiFilterEngineService(
    {
      isConfigured: () => false,
      evaluate: jest.fn(),
    } as never,
    (arxWebSearch === undefined
      ? undefined
      : {
          isStructuredAvailable: () => false,
          isSerpAvailable: () => arxWebSearch.isAvailable(),
          sonarBacklogMs: 0,
          ...arxWebSearch,
        }) as never,
  );
  const chatCreate = jest.fn();
  const responsesCreate = jest.fn();

  jest.spyOn(service as never, 'getOpenAiClient').mockReturnValue({
    chat: { completions: { create: chatCreate } },
    responses: { create: responsesCreate },
  } as never);

  return { service, chatCreate, responsesCreate };
};

const chatReply = (results: Array<Record<string, unknown>>) => ({
  choices: [{ message: { content: JSON.stringify({ results }) } }],
  usage: { prompt_tokens: 100, completion_tokens: 20 },
});

describe('AiFilterEngineService enrichment columns', () => {
  const originalProvider = process.env.ARX_WEB_SEARCH_PROVIDER;

  afterEach(() => {
    if (originalProvider === undefined) {
      delete process.env.ARX_WEB_SEARCH_PROVIDER;
    } else {
      process.env.ARX_WEB_SEARCH_PROVIDER = originalProvider;
    }

    delete process.env.ARX_WEB_SEARCH_PROVIDERS;
    delete process.env.ARX_WEB_SEARCH_SPILL_MS;
  });

  it('should answer records without a keep field and keep numbers as numbers', async () => {
    const { service, chatCreate } = buildEngine();

    chatCreate.mockResolvedValue(
      chatReply([
        { id: 'a', employees: 1234.6, band: '>500', source: 'acme.com' },
        { id: 'b', employees: null, band: 'unknown', source: 'unknown' },
      ]),
    );

    const { verdicts, stats } = await service.run(rows, enrichmentSpec());

    expect(verdicts[0]).toMatchObject({
      status: 'answered',
      keep: null,
      answers: { employees: 1235, band: '>500', source: 'acme.com' },
    });
    // No credible figure is a valid answer, not a failure.
    expect(verdicts[1]).toMatchObject({
      status: 'answered',
      answers: { band: 'unknown', source: 'unknown' },
    });
    expect(verdicts[1].answers).not.toHaveProperty('employees');
    expect(stats).toMatchObject({
      engine: 'openai',
      inputTokens: 100,
      outputTokens: 20,
      webSearchCalls: 0,
    });
    expect(stats.estimatedCostUsd).toBeGreaterThan(0);
  });

  it('should reject an enum answer outside the list unless unknown is allowed', async () => {
    const { service, chatCreate } = buildEngine();

    chatCreate.mockResolvedValue(
      chatReply([
        { id: 'a', employees: 1, band: 'unknown', source: 'x' },
        { id: 'b', employees: 1, band: 'unknown', source: 'x' },
      ]),
    );

    const { verdicts } = await service.run(
      rows,
      enrichmentSpec({ allowUnknown: false }),
    );

    expect(verdicts.map((verdict) => verdict.status)).toEqual([
      'failed',
      'failed',
    ]);
  });

  it('should look each record up on its own through web search and count the searches', async () => {
    const { service, chatCreate, responsesCreate } = buildEngine();

    responsesCreate.mockImplementation(async ({ input }) => {
      const id = /RECORD (\S+)/.exec(input)?.[1];

      return {
        output_text: JSON.stringify({
          results: [
            { id, employees: 500, band: '50-500', source: 'example.com' },
          ],
        }),
        output: [{ type: 'web_search_call' }, { type: 'message' }],
        usage: { input_tokens: 400, output_tokens: 50 },
      };
    });

    const { verdicts, stats } = await service.run(
      rows,
      enrichmentSpec({ webSearch: true }),
    );

    expect(chatCreate).not.toHaveBeenCalled();
    expect(responsesCreate).toHaveBeenCalledTimes(2);
    expect(responsesCreate.mock.calls[0][0].tools).toEqual([
      { type: 'web_search_preview', search_context_size: 'low' },
    ]);
    expect(verdicts.map((verdict) => verdict.status)).toEqual([
      'answered',
      'answered',
    ]);
    expect(stats.webSearchCalls).toBe(2);
    // two searches at $0.025 dominate the token cost
    expect(stats.estimatedCostUsd).toBeGreaterThanOrEqual(0.05);
  });

  describe('web search provider chain', () => {
    it('should use the OpenAI web search tool and never call Perplexity when the chain is only openai', async () => {
      process.env.ARX_WEB_SEARCH_PROVIDERS = 'openai';

      const search = jest.fn();
      const completeStructured = jest.fn();
      const { service, chatCreate, responsesCreate } = buildEngine({
        isAvailable: () => true,
        isStructuredAvailable: () => true,
        completeStructured,
        search,
      });

      responsesCreate.mockResolvedValue({
        output_text: JSON.stringify({
          results: [
            { id: 'a', employees: 7, band: '<50', source: 'example.com' },
          ],
        }),
        output: [{ type: 'web_search_call' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      });

      const { verdicts, stats } = await service.run(
        [rows[0]],
        enrichmentSpec({ webSearch: true }),
      );

      expect(search).not.toHaveBeenCalled();
      expect(completeStructured).not.toHaveBeenCalled();
      expect(chatCreate).not.toHaveBeenCalled();
      expect(responsesCreate).toHaveBeenCalledTimes(1);
      expect(responsesCreate.mock.calls[0][0].tools[0]).toMatchObject({
        type: 'web_search_preview',
        search_context_size: 'low',
      });
      expect(verdicts[0].answers).toMatchObject({ employees: 7 });
      expect(stats).toMatchObject({ groundedSearches: 0, webSearchCalls: 1 });
    });
  });

  describe('web search provider chain order', () => {
    const sonarAnswer = {
      content: JSON.stringify({
        results: [
          { id: 'a', employees: 500, band: '50-500', source: 'acme.com' },
        ],
      }),
      inputTokens: 100,
      outputTokens: 20,
      costUsd: 0.006,
    };
    const serpEvidence = {
      query: 'acme employees',
      provider: 'bright-data-serp',
      costUsd: 0.0015,
      aiOverview: null,
      snippets: [],
      text: 'SEARCH RESULTS:\n1. Acme (https://acme.com)\n500 employees',
    };
    const openAiReply = {
      output_text: JSON.stringify({
        results: [
          { id: 'a', employees: 900, band: '>500', source: 'example.com' },
        ],
      }),
      output: [{ type: 'web_search_call' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    };
    const mockSerpChat = (chatCreate: jest.Mock) =>
      chatCreate.mockImplementation(async ({ messages }) =>
        messages[0].content.startsWith('Write one Google search query')
          ? {
              choices: [{ message: { content: 'acme employees' } }],
              usage: { prompt_tokens: 50, completion_tokens: 5 },
            }
          : chatReply([
              { id: 'a', employees: 500, band: '50-500', source: 'acme.com' },
            ]),
      );

    it('should answer from Sonar first and leave SERP and OpenAI untouched by default', async () => {
      const search = jest.fn();
      const { service, responsesCreate } = buildEngine({
        isAvailable: () => true,
        isStructuredAvailable: () => true,
        completeStructured: jest.fn().mockResolvedValue(sonarAnswer),
        search,
      });

      const { stats } = await service.run(
        [rows[0]],
        enrichmentSpec({ webSearch: true }),
      );

      expect(search).not.toHaveBeenCalled();
      expect(responsesCreate).not.toHaveBeenCalled();
      expect(stats.webSearchProviders).toEqual({ perplexity: 1 });
    });

    it('should hand the record to the SERP when Sonar fails', async () => {
      const search = jest.fn().mockResolvedValue(serpEvidence);
      const { service, chatCreate, responsesCreate } = buildEngine({
        isAvailable: () => true,
        isStructuredAvailable: () => true,
        completeStructured: jest.fn().mockResolvedValue(null),
        search,
      });

      mockSerpChat(chatCreate);

      const { verdicts, stats } = await service.run(
        [rows[0]],
        enrichmentSpec({ webSearch: true }),
      );

      expect(search).toHaveBeenCalledWith('acme employees', {
        serpOnly: true,
      });
      expect(responsesCreate).not.toHaveBeenCalled();
      expect(verdicts[0].answers).toMatchObject({ employees: 500 });
      expect(stats.webSearchProviders).toEqual({ serp: 1 });
    });

    it('should end on the paid OpenAI web search only after Sonar and the SERP gave nothing', async () => {
      const { service, chatCreate, responsesCreate } = buildEngine({
        isAvailable: () => true,
        isStructuredAvailable: () => true,
        completeStructured: jest.fn().mockResolvedValue(null),
        search: jest.fn().mockResolvedValue(null),
      });

      chatCreate.mockResolvedValue({
        choices: [{ message: { content: 'acme employees' } }],
        usage: { prompt_tokens: 50, completion_tokens: 5 },
      });
      responsesCreate.mockResolvedValue(openAiReply);

      const { verdicts, stats } = await service.run(
        [rows[0]],
        enrichmentSpec({ webSearch: true }),
      );

      expect(verdicts[0].answers).toMatchObject({ employees: 900 });
      expect(stats.webSearchProviders).toEqual({ openai: 1 });
    });

    it('should leave the record unanswered, not pay for OpenAI, when the chain has no openai step', async () => {
      process.env.ARX_WEB_SEARCH_PROVIDERS = 'perplexity,serp';

      const { service, responsesCreate } = buildEngine({
        isAvailable: () => true,
        isStructuredAvailable: () => true,
        completeStructured: jest.fn().mockResolvedValue(null),
        search: jest.fn().mockResolvedValue(null),
      });

      const { verdicts } = await service.run(
        [rows[0]],
        enrichmentSpec({ webSearch: true }),
      );

      expect(responsesCreate).not.toHaveBeenCalled();
      expect(verdicts[0].status).toBe('failed');
    });

    it('should skip a backed-up Sonar for the SERP when a spill limit is set', async () => {
      process.env.ARX_WEB_SEARCH_SPILL_MS = '1000';

      const completeStructured = jest.fn().mockResolvedValue(sonarAnswer);
      const { service, chatCreate } = buildEngine({
        isAvailable: () => true,
        isStructuredAvailable: () => true,
        sonarBacklogMs: 5_000,
        completeStructured,
        search: jest.fn().mockResolvedValue(serpEvidence),
      });

      mockSerpChat(chatCreate);

      const { stats } = await service.run(
        [rows[0]],
        enrichmentSpec({ webSearch: true }),
      );

      expect(completeStructured).not.toHaveBeenCalled();
      expect(stats.webSearchProviders).toEqual({ serp: 1 });
    });
  });

  describe('web search grounded in cheap search evidence', () => {
    beforeEach(() => {
      process.env.ARX_WEB_SEARCH_PROVIDER = 'perplexity';
    });

    const evidence = {
      query: 'acme employees',
      provider: 'perplexity',
      costUsd: 0.005,
      aiOverview: null,
      snippets: [],
      text: 'SEARCH RESULTS:\n1. Acme (https://acme.com)\n500 employees',
    };
    const queryReply = {
      choices: [{ message: { content: 'acme employees' } }],
      usage: { prompt_tokens: 50, completion_tokens: 5 },
    };

    it('should answer from search evidence without calling the paid web search tool', async () => {
      const search = jest.fn().mockResolvedValue(evidence);
      const { service, chatCreate, responsesCreate } = buildEngine({
        isAvailable: () => true,
        search,
      });

      chatCreate.mockImplementation(async ({ messages }) =>
        messages[0].content.startsWith('Write one Google search query')
          ? queryReply
          : chatReply([
              { id: 'a', employees: 500, band: '50-500', source: 'acme.com' },
            ]),
      );

      const { verdicts, stats } = await service.run(
        [rows[0]],
        enrichmentSpec({ webSearch: true }),
      );

      expect(responsesCreate).not.toHaveBeenCalled();
      expect(search).toHaveBeenCalledWith('acme employees', {
        serpOnly: true,
      });
      expect(verdicts[0]).toMatchObject({
        status: 'answered',
        answers: { employees: 500 },
      });
      expect(stats).toMatchObject({ groundedSearches: 1, webSearchCalls: 0 });
      expect(stats.groundedSearchCostUsd).toBe(0.005);
      expect(stats.estimatedCostUsd).toBeLessThan(0.01);
    });

    it('should fall back to the web search tool when no provider gave anything', async () => {
      const { service, chatCreate, responsesCreate } = buildEngine({
        isAvailable: () => true,
        search: jest.fn().mockResolvedValue(null),
      });

      chatCreate.mockResolvedValue(queryReply);
      responsesCreate.mockResolvedValue({
        output_text: JSON.stringify({
          results: [
            { id: 'a', employees: 7, band: '<50', source: 'example.com' },
          ],
        }),
        output: [{ type: 'web_search_call' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      });

      const { verdicts, stats } = await service.run(
        [rows[0]],
        enrichmentSpec({ webSearch: true }),
      );

      expect(responsesCreate).toHaveBeenCalledTimes(1);
      expect(verdicts[0].answers).toMatchObject({ employees: 7 });
      expect(stats).toMatchObject({ groundedSearches: 0, webSearchCalls: 1 });
    });

    it('should fall back when the evidence held no answer', async () => {
      const { service, chatCreate, responsesCreate } = buildEngine({
        isAvailable: () => true,
        search: jest.fn().mockResolvedValue(evidence),
      });

      chatCreate.mockImplementation(async ({ messages }) =>
        messages[0].content.startsWith('Write one Google search query')
          ? queryReply
          : chatReply([
              { id: 'a', employees: null, band: 'unknown', source: 'unknown' },
            ]),
      );
      responsesCreate.mockResolvedValue({
        output_text: JSON.stringify({
          results: [
            { id: 'a', employees: 900, band: '>500', source: 'example.com' },
          ],
        }),
        output: [{ type: 'web_search_call' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      });

      const { verdicts, stats } = await service.run(
        [rows[0]],
        enrichmentSpec({ webSearch: true }),
      );

      expect(verdicts[0].answers).toMatchObject({ employees: 900 });
      expect(stats).toMatchObject({ groundedSearches: 1, webSearchCalls: 1 });
    });
  });

  describe('web search through Perplexity Sonar structured answers', () => {
    beforeEach(() => {
      process.env.ARX_WEB_SEARCH_PROVIDER = 'perplexity';
    });

    it('should answer from one Sonar call and never use the paid OpenAI web search tool', async () => {
      const completeStructured = jest.fn().mockResolvedValue({
        content: JSON.stringify({
          results: [
            { id: 'a', employees: 500, band: '50-500', source: 'acme.com' },
          ],
        }),
        inputTokens: 120,
        outputTokens: 30,
        costUsd: 0.006,
      });
      const { service, chatCreate, responsesCreate } = buildEngine({
        isAvailable: () => true,
        isStructuredAvailable: () => true,
        completeStructured,
        search: jest.fn(),
      });

      const { verdicts, stats } = await service.run(
        [rows[0]],
        enrichmentSpec({ webSearch: true }),
      );

      expect(completeStructured).toHaveBeenCalledTimes(1);
      expect(chatCreate).not.toHaveBeenCalled();
      expect(responsesCreate).not.toHaveBeenCalled();
      expect(verdicts[0]).toMatchObject({
        status: 'answered',
        answers: { employees: 500 },
      });
      expect(stats).toMatchObject({ groundedSearches: 1, webSearchCalls: 0 });
      expect(stats.groundedSearchCostUsd).toBe(0.006);
    });

    it('should treat an empty Sonar answer as no credible answer, not a failure or a paid retry', async () => {
      const { service, responsesCreate } = buildEngine({
        isAvailable: () => true,
        isStructuredAvailable: () => true,
        completeStructured: jest.fn().mockResolvedValue({
          content: JSON.stringify({
            results: [
              { id: 'a', employees: null, band: 'unknown', source: 'unknown' },
            ],
          }),
          inputTokens: 100,
          outputTokens: 20,
          costUsd: 0.006,
        }),
        search: jest.fn(),
      });

      const { verdicts } = await service.run(
        [rows[0]],
        enrichmentSpec({ webSearch: true }),
      );

      expect(responsesCreate).not.toHaveBeenCalled();
      expect(verdicts[0].status).toBe('answered');
    });
  });

  it('should stop retrying and say so when OpenAI credits are exhausted', async () => {
    const { service, chatCreate } = buildEngine();

    chatCreate.mockRejectedValue(
      Object.assign(new Error('429 no credits'), {
        status: 429,
        code: 'credit_balance_exhausted',
      }),
    );

    const { verdicts } = await service.run(rows, enrichmentSpec());

    expect(chatCreate).toHaveBeenCalledTimes(1);
    expect(verdicts[0].status).toBe('failed');
    expect(verdicts[0].error).toContain('credits are exhausted');
  });
});
