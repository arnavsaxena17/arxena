import { type FilterSpec } from 'src/engine/core-modules/candidate-sourcing/services/ai-filter-engine/ai-filter-contract';
import { AiFilterEngineService } from 'src/engine/core-modules/candidate-sourcing/services/ai-filter-engine/ai-filter-engine.service';

type Decision = { keep: boolean; confidence?: string; reason?: string };

const fields: FilterSpec['fields'] = [
  { name: 'keep', type: 'boolean' },
  { name: 'confidence', type: 'enum', enumValues: ['strong', 'borderline'] },
  { name: 'reason', type: 'text', optional: true },
];

const baseSpec = (overrides: Partial<FilterSpec> = {}): FilterSpec => ({
  name: 'Keep people',
  subject: 'person',
  criteria: 'Senior sales leaders',
  fields,
  keepField: 'keep',
  model: 'gpt4omini',
  metadataFields: ['name', 'title'],
  ...overrides,
});

const people = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `p${index}`,
    name: `Person ${index}`,
    title: index % 2 === 0 ? 'VP Sales' : 'Intern',
  }));

// A decision table stands in for "the right answer"; each fake model renders
// it in its own wire format.
const decide = (id: string): Decision => {
  const even = Number(id.slice(1)) % 2 === 0;

  return {
    keep: even,
    confidence: 'strong',
    reason: even ? 'Senior sales role' : 'Not a decision maker',
  };
};

const openAiReply = (userContent: string, drop: string[] = []) => ({
  choices: [
    {
      message: {
        content: JSON.stringify({
          results: [...userContent.matchAll(/RECORD (\S+)/g)]
            .map((match) => match[1])
            .filter((id) => !drop.includes(id))
            .map((id) => ({ id, ...decide(id) })),
        }),
      },
    },
  ],
});

const buildEngine = ({
  jevConfigured = false,
  evaluate = jest.fn(),
}: {
  jevConfigured?: boolean;
  evaluate?: jest.Mock;
} = {}) => {
  const jev = { isConfigured: () => jevConfigured, evaluate };
  const service = new AiFilterEngineService(jev as never);
  const create = jest.fn();

  jest
    .spyOn(service as never, 'getOpenAiClient')
    .mockReturnValue({ chat: { completions: { create } } } as never);

  return { service, create, evaluate };
};

describe('AiFilterEngineService', () => {
  afterEach(() => jest.useRealTimers());

  describe('engine choice', () => {
    it('uses jev only when configured and all required fields are boolean/enum', () => {
      const { service } = buildEngine({ jevConfigured: true });

      expect(
        service.resolveEngine(baseSpec({ model: 'typesafe-ai/jev' })),
      ).toBe('jev');
      expect(service.resolveEngine(baseSpec({ model: 'gpt4omini' }))).toBe(
        'openai',
      );
      expect(
        service.resolveEngine(
          baseSpec({
            model: 'typesafe-ai/jev',
            fields: [{ name: 'note', type: 'text' }],
            keepField: 'note',
          }),
        ),
      ).toBe('openai');
    });

    it('falls back to OpenAI when jev has no key', () => {
      const { service } = buildEngine({ jevConfigured: false });

      expect(
        service.resolveEngine(baseSpec({ model: 'typesafe-ai/jev' })),
      ).toBe('openai');
    });
  });

  describe('OpenAI adapter', () => {
    it('sends records in batches and answers every record', async () => {
      const { service, create } = buildEngine();

      create.mockImplementation(async ({ messages }) =>
        openAiReply(messages[1].content),
      );

      const { verdicts, stats } = await service.run(
        people(25),
        baseSpec({ batchSize: 10 }),
      );

      expect(create).toHaveBeenCalledTimes(3);
      expect(stats.calls).toBe(3);
      expect(verdicts.map((verdict) => verdict.keep)).toEqual(
        people(25).map((person) => decide(person.id).keep),
      );
      expect(verdicts[0].reason).toBe('Senior sales role');
    });

    it('requests strict structured output with the enum values', async () => {
      const { service, create } = buildEngine();

      create.mockImplementation(async ({ messages }) =>
        openAiReply(messages[1].content),
      );
      await service.run(people(2), baseSpec());

      const request = create.mock.calls[0][0];
      const itemSchema =
        request.response_format.json_schema.schema.properties.results.items;

      expect(request.response_format.json_schema.strict).toBe(true);
      expect(itemSchema.properties.confidence.enum).toEqual([
        'strong',
        'borderline',
      ]);
      expect(itemSchema.required).toEqual([
        'id',
        'keep',
        'confidence',
        'reason',
      ]);
    });

    it('retries only the records a batch left out, one by one', async () => {
      const { service, create } = buildEngine();

      create.mockImplementation(async ({ messages }) =>
        openAiReply(
          messages[1].content,
          messages[1].content.includes('RECORD p1') &&
            messages[1].content.includes('RECORD p2')
            ? ['p1']
            : [],
        ),
      );

      const { verdicts, stats } = await service.run(
        people(3),
        baseSpec({ batchSize: 10 }),
      );

      expect(verdicts.every((verdict) => verdict.status === 'answered')).toBe(
        true,
      );
      expect(stats.retriedRecords).toBe(1);
      expect(create).toHaveBeenCalledTimes(2);
    });

    it('marks a record failed, not rejected, when the model never answers it', async () => {
      const { service, create } = buildEngine();

      create.mockImplementation(async ({ messages }) =>
        openAiReply(messages[1].content, ['p1']),
      );

      const { verdicts } = await service.run(people(3), baseSpec());

      expect(verdicts[1].status).toBe('failed');
      expect(verdicts[1].keep).toBeNull();
      expect(verdicts[0].status).toBe('answered');
    });

    it('backs off and succeeds after a rate limit', async () => {
      jest.useFakeTimers();
      const { service, create } = buildEngine();

      create
        .mockRejectedValueOnce(
          Object.assign(new Error('rate'), { status: 429 }),
        )
        .mockImplementation(async ({ messages }) =>
          openAiReply(messages[1].content),
        );

      const pending = service.run(people(2), baseSpec());

      await jest.advanceTimersByTimeAsync(10_000);
      const { verdicts } = await pending;

      expect(create).toHaveBeenCalledTimes(2);
      expect(verdicts.every((verdict) => verdict.status === 'answered')).toBe(
        true,
      );
    });

    it('fails every record without retrying a permanent error', async () => {
      const { service, create } = buildEngine();

      create.mockRejectedValue(
        Object.assign(new Error('bad key'), { status: 401 }),
      );

      const { verdicts } = await service.run(people(3), baseSpec());

      expect(verdicts.every((verdict) => verdict.status === 'failed')).toBe(
        true,
      );
      expect(verdicts[0].error).toContain('bad key');
    });

    it('never has more calls in flight than the concurrency limit', async () => {
      const { service, create } = buildEngine();
      let inFlight = 0;
      let peak = 0;

      create.mockImplementation(async ({ messages }) => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 10));
        inFlight -= 1;

        return openAiReply(messages[1].content);
      });

      await service.run(people(40), baseSpec({ batchSize: 2, concurrency: 3 }));

      expect(peak).toBeLessThanOrEqual(3);
      expect(peak).toBeGreaterThan(1);
    });
  });

  describe('jev adapter', () => {
    const jevAnswer = (id: string) => ({
      model: 'typesafe-ai/jev',
      answers: {
        keep: { type: 'boolean', probability: decide(id).keep ? 0.9 : 0.1 },
        confidence: {
          type: 'choice',
          choice: 'strong',
          probabilities: { strong: 1, borderline: 0 },
        },
      },
    });

    it('asks only the required boolean/enum questions, one call per record', async () => {
      const evaluate = jest.fn(async ({ state }) =>
        jevAnswer(String(state.candidate).includes('Intern') ? 'p1' : 'p0'),
      );
      const { service } = buildEngine({ jevConfigured: true, evaluate });

      const { verdicts, stats } = await service.run(
        people(4),
        baseSpec({ model: 'typesafe-ai/jev' }),
      );

      expect(stats.engine).toBe('jev');
      expect(evaluate).toHaveBeenCalledTimes(4);
      expect(Object.keys(evaluate.mock.calls[0][0].questions)).toEqual([
        'keep',
        'confidence',
      ]);
      expect(verdicts.map((verdict) => verdict.keep)).toEqual([
        true,
        false,
        true,
        false,
      ]);
      expect(verdicts[0].reason).toBeUndefined();
    });

    it('fails only the record whose call errored', async () => {
      const evaluate = jest
        .fn()
        .mockResolvedValueOnce(jevAnswer('p0'))
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce(jevAnswer('p2'));
      const { service } = buildEngine({ jevConfigured: true, evaluate });

      const { verdicts } = await service.run(
        people(3),
        baseSpec({ model: 'typesafe-ai/jev', concurrency: 1 }),
      );

      expect(verdicts.map((verdict) => verdict.status)).toEqual([
        'answered',
        'failed',
        'answered',
      ]);
    });
  });

  // The point of the contract: swap the model and the node's output keeps the
  // same shape and, for the same decisions, the same keep/reject split.
  it('produces the same keep decisions and verdict shape on jev and OpenAI', async () => {
    const records = people(6);
    const jevEngine = buildEngine({
      jevConfigured: true,
      evaluate: jest.fn(async ({ state }) => ({
        model: 'jev',
        answers: {
          keep: {
            type: 'boolean',
            probability: String(state.candidate).includes('VP Sales')
              ? 0.8
              : 0.2,
          },
          confidence: {
            type: 'choice',
            choice: 'strong',
            probabilities: { strong: 1, borderline: 0 },
          },
        },
      })),
    });
    const openAiEngine = buildEngine();

    openAiEngine.create.mockImplementation(async ({ messages }) =>
      openAiReply(messages[1].content),
    );

    const viaJev = await jevEngine.service.run(
      records,
      baseSpec({ model: 'typesafe-ai/jev' }),
    );
    const viaOpenAi = await openAiEngine.service.run(records, baseSpec());

    expect(viaJev.verdicts.map((verdict) => verdict.keep)).toEqual(
      viaOpenAi.verdicts.map((verdict) => verdict.keep),
    );
    for (const verdict of [...viaJev.verdicts, ...viaOpenAi.verdicts]) {
      expect(Object.keys(verdict).sort()).toEqual(
        expect.arrayContaining(['id', 'status', 'answers', 'keep']),
      );
      expect(verdict.answers.confidence).toBe('strong');
    }
  });
});
