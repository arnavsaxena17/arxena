import { SourcingJudgeService } from 'src/engine/core-modules/candidate-sourcing/run/sourcing-judge.service';
import { triageRow } from 'src/engine/core-modules/candidate-sourcing/run/triage.util';
import { type OutreachTabRow } from 'src/engine/core-modules/outreach-command/services/outreach-tab.service';
import { type SourcingSpec } from 'src/engine/core-modules/outreach-command/utils/sourcing-spec.util';

const spec: SourcingSpec = {
  hard: [
    { field: 'title', userWords: 'Plant head', normalized: ['plant head'] },
    { field: 'location', userWords: 'Gujarat', normalized: ['gujarat'] },
  ],
  soft: [],
  exclusions: [
    {
      field: 'company',
      userWords: 'Tata Chemicals',
      normalized: ['tata chemicals'],
    },
  ],
  normalized: { titles: ['plant head', 'factory head'], industries: [] },
  target: { count: 10 },
  coverage: 'best_effort',
};

const row = (
  id: string,
  overrides: Partial<OutreachTabRow> = {},
): OutreachTabRow => ({
  id,
  source: 'ephemeral',
  name: `Person ${id}`,
  title: 'Plant Head',
  locationName: 'Vadodara, Gujarat',
  linkedinUrl: `https://www.linkedin.com/in/person-${id}`,
  otherFields: {},
  ...overrides,
});

describe('triageRow', () => {
  it('should reject only a present field that plainly misses', () => {
    expect(triageRow(row('a'), spec)).toEqual({ pass: true });
    expect(triageRow(row('b', { title: 'Factory Head' }), spec)).toEqual({
      pass: true,
    });
    expect(triageRow(row('c', { title: 'Sales Manager' }), spec)).toEqual({
      pass: false,
      missed: ['Plant head'],
    });
    expect(
      triageRow(row('d', { title: undefined, locationName: '' }), spec),
    ).toEqual({ pass: true });
  });
});

describe('SourcingJudgeService', () => {
  const store = new Map<string, unknown>();
  const cache = {
    get: jest.fn(async (key: string) => store.get(key)),
    set: jest.fn(async (key: string, value: unknown) => {
      store.set(key, value);
    }),
  };
  const writeOtherFields = jest.fn().mockResolvedValue({
    ephemeralUpdated: 0,
    crmUpdated: 0,
  });
  const run = jest.fn(
    async (records: Array<{ id: string }>, _spec: unknown) => ({
      verdicts: records.map((record) => ({
        id: record.id,
        status: 'answered',
        keep: null,
        answers:
          record.id === 'tata'
            ? {
                must_1_title: 'pass',
                must_2_location: 'pass',
                red_1_company: 'pass',
              }
            : {
                must_1_title: 'pass',
                must_2_location: 'pass',
                red_1_company: 'fail',
              },
      })),
      stats: {},
    }),
  );
  const service = new SourcingJudgeService(
    { run } as never,
    { writeOtherFields } as never,
    cache as never,
  );

  beforeEach(() => {
    store.clear();
    run.mockClear();
    writeOtherFields.mockClear();
  });

  it('should judge with Jev, write outcome and stage, and reuse cached verdicts', async () => {
    const rows = [row('a'), row('tata')];
    const first = await service.judgeRows({
      workspaceId: 'w',
      projectId: 'p',
      rows,
      spec,
      level: 'snapshot',
    });

    expect(run.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        model: 'typesafe/jev-1.13',
        subject: 'person',
      }),
    );
    expect(first.counts).toEqual({
      qualified: 1,
      unknown: 0,
      to_confirm: 0,
      fail: 1,
    });
    expect(first.modelRows).toBe(2);

    const written = writeOtherFields.mock.calls[0][0].valuesByRowId as Map<
      string,
      Record<string, unknown>
    >;

    expect(written.get('a')).toEqual(
      expect.objectContaining({
        judgeOutcome: 'qualified',
        sourcingStage: 'verified',
      }),
    );
    expect(written.get('tata')).toEqual(
      expect.objectContaining({
        judgeOutcome: 'fail',
        sourcingStage: 'rejected',
        sourcingRejectedBy: expect.objectContaining({
          by: 'judge',
          flags: ['red_1_company'],
        }),
      }),
    );

    const second = await service.judgeRows({
      workspaceId: 'w',
      projectId: 'p',
      rows,
      spec,
      level: 'snapshot',
    });

    expect(run).toHaveBeenCalledTimes(1);
    expect(second.cachedRows).toBe(2);
    expect(second.costUsd).toBe(0);
  });

  it('should leave a row unknown when the model call fails', async () => {
    run.mockRejectedValueOnce(new Error('OpenRouter down'));

    const result = await service.judgeRows({
      workspaceId: 'w',
      projectId: 'p',
      rows: [row('x')],
      spec,
      level: 'snapshot',
    });

    expect(result.counts.unknown).toBe(1);
  });
});
