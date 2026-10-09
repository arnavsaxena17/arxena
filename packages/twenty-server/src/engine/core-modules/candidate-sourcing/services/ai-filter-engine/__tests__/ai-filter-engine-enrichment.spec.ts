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

const buildEngine = () => {
  const service = new AiFilterEngineService({
    isConfigured: () => false,
    evaluate: jest.fn(),
  } as never);
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
      { type: 'web_search_preview' },
    ]);
    expect(verdicts.map((verdict) => verdict.status)).toEqual([
      'answered',
      'answered',
    ]);
    expect(stats.webSearchCalls).toBe(2);
    // two searches at $0.025 dominate the token cost
    expect(stats.estimatedCostUsd).toBeGreaterThanOrEqual(0.05);
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
