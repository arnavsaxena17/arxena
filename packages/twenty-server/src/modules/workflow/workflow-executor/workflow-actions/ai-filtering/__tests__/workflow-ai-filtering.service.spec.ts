import { type RecordVerdict } from 'src/engine/core-modules/candidate-sourcing/services/ai-filter-engine/ai-filter-contract';
import { buildFilterContextText } from 'src/modules/workflow/workflow-executor/workflow-actions/ai-filtering/ai-filter-context.service';
import { WorkflowAiFilteringService } from 'src/modules/workflow/workflow-executor/workflow-actions/ai-filtering/workflow-ai-filtering.service';

const filter = {
  name: 'Keep people',
  prompt: 'Senior GTM only',
  selectedModel: 'typesafe-ai/jev',
  selectedMetadataFields: ['name', 'title'],
  subject: 'person' as const,
  keepField: 'keep',
  fields: [
    { name: 'keep', type: 'boolean' },
    { name: 'reason', type: 'text', optional: true },
  ],
};

const verdict = (
  id: string,
  overrides: Partial<RecordVerdict>,
): RecordVerdict => ({
  id,
  status: 'answered',
  keep: true,
  answers: { keep: true },
  ...overrides,
});

const buildService = (verdicts: RecordVerdict[]) => {
  const run = jest.fn().mockResolvedValue({
    verdicts,
    stats: {
      engine: 'openai',
      model: 'gpt-4o-mini',
      calls: 1,
      retriedRecords: 0,
      durationMs: 5,
    },
  });
  const service = new WorkflowAiFilteringService(
    { run } as never,
    {} as never,
    { add: jest.fn() } as never,
    { resolveForWorkspace: jest.fn().mockResolvedValue('') } as never,
  );

  return { service, run };
};

const candidates = [
  { id: 'a', name: 'Arapa Hara', title: 'Head of Sales' },
  { id: 'b', name: 'Jordan Lee', title: 'SDR' },
  { id: 'c', name: 'Sam Roy', title: 'CRO' },
];

describe('WorkflowAiFilteringService.processAndBuildResult', () => {
  it('splits records into kept, rejected (with reason) and failed', async () => {
    const { service } = buildService([
      verdict('a', { keep: true, answers: { keep: true } }),
      verdict('b', {
        keep: false,
        answers: { keep: false, reason: 'Junior' },
        reason: 'Junior',
      }),
      verdict('c', {
        status: 'failed',
        keep: null,
        answers: {},
        error: 'timeout',
      }),
    ]);

    const result = await service.processAndBuildResult({ candidates, filter });

    expect(result.kept?.map((record) => record.id)).toEqual(['a']);
    expect(
      result.rejected?.map((record) => [record.id, record.reason]),
    ).toEqual([['b', 'Junior']]);
    expect(result.failed?.map((record) => [record.id, record.error])).toEqual([
      ['c', 'timeout'],
    ]);
    expect(result.candidates[1].aiFilter).toEqual({
      keep: false,
      reason: 'Junior',
    });
    expect(result.stats).toMatchObject({ kept: 1, rejected: 1, failed: 1 });
  });

  it('gives a rejected record a default reason when the model sent none', async () => {
    const { service } = buildService([
      verdict('a', { keep: false, answers: { keep: false } }),
      verdict('b', { keep: true }),
      verdict('c', { keep: true }),
    ]);

    const result = await service.processAndBuildResult({ candidates, filter });

    expect(result.rejected?.[0].reason).toBe('Did not meet "keep"');
  });

  it('fails the step when no record got a valid answer', async () => {
    const { service } = buildService(
      candidates.map((candidate) =>
        verdict(candidate.id, {
          status: 'failed',
          keep: null,
          answers: {},
          error: 'OPENAI_API_KEY is required',
        }),
      ),
    );

    await expect(
      service.processAndBuildResult({ candidates, filter }),
    ).rejects.toThrow('no valid answer for any of 3 records');
  });

  it('passes the criteria, merged context and fields to the engine', async () => {
    const { service, run } = buildService(
      candidates.map((candidate) => verdict(candidate.id, {})),
    );

    await service.processAndBuildResult({
      candidates,
      filter: { ...filter, context: 'Campaign: fintech' },
      workspaceContext: 'Target locations: India',
    });

    const spec = run.mock.calls[0][1];

    expect(spec.criteria).toBe('Senior GTM only');
    expect(spec.context).toBe('Campaign: fintech\nTarget locations: India');
    expect(spec.subject).toBe('person');
    expect(spec.keepField).toBe('keep');
    expect(spec.fields[1]).toMatchObject({
      name: 'reason',
      type: 'text',
      optional: true,
    });
  });
});

describe('buildFilterContextText', () => {
  it('lists sender, offer, titles and locations when the workspace has them', () => {
    expect(
      buildFilterContextText({
        displayName: 'Arxena',
        enrichmentJson: { whatTheySell: 'AI recruiting agents' },
        icpSpec: JSON.stringify({
          targetTitles: ['VP Sales'],
          locations: ['India'],
        }),
      }),
    ).toBe(
      'Sender company: Arxena\nWhat the sender sells: AI recruiting agents\nTarget titles: VP Sales\nTarget locations: India',
    );
  });

  it('is empty when there is no workspace', () => {
    expect(buildFilterContextText(null)).toBe('');
  });
});
