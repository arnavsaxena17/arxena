import { buildRecordText } from 'src/engine/core-modules/candidate-sourcing/services/ai-filter-engine/ai-filter-prompt';
import { type FilterSpec } from 'src/engine/core-modules/candidate-sourcing/services/ai-filter-engine/ai-filter-contract';
import {
  OutreachAiColumnService,
  buildFitmentFilter,
  findLookAlikeColumns,
  readExistingAiColumns,
  toRecordForModel,
  wholeRecordFields,
} from 'src/engine/core-modules/outreach-command/services/outreach-ai-column.service';
import { type OutreachWorkingSetRow } from 'src/engine/core-modules/outreach-command/services/outreach-working-set.service';

describe('toRecordForModel', () => {
  const person: OutreachWorkingSetRow = {
    id: 'p1',
    source: 'ephemeral',
    name: 'Jorge Areosa',
    title: 'Chief Executive Officer',
    companyName: 'ARCO Interiors',
    locationName: 'Abu Dhabi',
    otherFields: {},
  };

  it('should show the job title to the model when jobTitle is requested', () => {
    const text = buildRecordText(toRecordForModel(person), [
      'name',
      'jobTitle',
      'companyName',
    ]);

    expect(text).toContain('jobTitle: Chief Executive Officer');
    expect(text).toContain('companyName: ARCO Interiors');
  });

  it('should show the job title when the flat title key is requested', () => {
    const text = buildRecordText(toRecordForModel(person), ['title']);

    expect(text).toBe('title: Chief Executive Officer');
  });

  it('should expose company fields for company rows', () => {
    const text = buildRecordText(
      toRecordForModel({
        id: 'c1',
        source: 'ephemeral',
        name: 'Acme',
        domain: 'acme.com',
        employees: '501-1000',
        otherFields: {},
      }),
      ['name', 'domain', 'size'],
    );

    expect(text).toContain('domain: acme.com');
    expect(text).toContain('company size (employees): 501-1000');
  });
});

describe('wholeRecordFields', () => {
  it('should send every field the row has, not only the designed ones', () => {
    const company: OutreachWorkingSetRow = {
      id: 'c1',
      source: 'ephemeral',
      name: 'Acme Stores',
      domain: 'acme.com',
      industry: 'Retail',
      employees: '501-1000',
      otherFields: {
        about: 'Operates 120 stores across India',
        specialties: 'retail, fashion',
        aiColumns: { isConsumerBrand: { status: 'ok' } },
        isConsumerBrand: true,
        storeCountIndia: 120,
        empty: '',
      },
    } as OutreachWorkingSetRow;
    const fields = wholeRecordFields({
      records: [toRecordForModel(company)],
      preferredFields: ['name'],
      excludedFields: ['storeCountIndia'],
    });

    expect(fields[0]).toBe('name');
    expect(fields).toEqual(
      expect.arrayContaining([
        'domain',
        'industry',
        'employees',
        'about',
        'specialties',
        'isConsumerBrand',
      ]),
    );
    expect(fields).not.toContain('aiColumns');
    expect(fields).not.toContain('storeCountIndia');
    expect(fields).not.toContain('empty');
    expect(fields).not.toContain('people');
  });
});

describe('existing AI columns', () => {
  const existing = [
    {
      key: 'physicalStoresCount',
      label: 'Store count',
      type: 'integer',
      filled: 113,
    },
    {
      key: 'annualRevenueInrCrore',
      label: 'Revenue',
      type: 'number',
      filled: 113,
    },
    { key: 'brandCat', label: 'Brand category', type: 'enum', filled: 1082 },
    {
      key: 'headquarteredInIndia',
      label: 'HQ in India',
      type: 'boolean',
      filled: 1082,
    },
  ];

  it('should flag new fields that repeat an existing column', () => {
    const warnings = findLookAlikeColumns(
      [
        'storeCount',
        'annualRevenueUsd',
        'brandCategory',
        'isIndiaHeadquartered',
      ],
      existing,
    );

    expect(warnings).toHaveLength(4);
    expect(warnings[0]).toContain('physicalStoresCount');
    expect(warnings[1]).toContain('annualRevenueInrCrore');
    expect(warnings[2]).toContain('brandCat');
    expect(warnings[3]).toContain('headquarteredInIndia');
  });

  it('should not flag the existing key itself or an unrelated fact', () => {
    expect(
      findLookAlikeColumns(
        ['physicalStoresCount', 'isFranchiseModel'],
        existing,
      ),
    ).toEqual([]);
  });

  it('should read existing columns with how many rows are filled', () => {
    const rows = [
      {
        id: 'a',
        otherFields: {
          aiColumns: {
            brandCat: {
              label: 'Brand category',
              type: 'enum',
              enumValues: ['Food', 'Apparel'],
            },
          },
          brandCat: 'Food',
        },
      },
      {
        id: 'b',
        otherFields: {
          aiColumns: {
            brandCat: {
              label: 'Brand category',
              type: 'enum',
              enumValues: ['Food', 'Apparel'],
            },
          },
        },
      },
    ] as unknown as OutreachWorkingSetRow[];

    expect(readExistingAiColumns(rows)).toEqual([
      {
        key: 'brandCat',
        label: 'Brand category',
        type: 'enum',
        enumValues: ['Food', 'Apparel'],
        filled: 1,
      },
    ]);
  });
});

describe('fitment columns', () => {
  const criteria = [
    { key: 'isCeo', description: 'is a CEO', mustHave: true, weight: 1 },
    { key: 'inIndia', description: 'is in India', mustHave: false, weight: 1 },
  ];
  const rows = [
    {
      id: 'p1',
      source: 'ephemeral',
      name: 'Asha',
      title: 'CEO',
      otherFields: {},
    },
    {
      id: 'p2',
      source: 'ephemeral',
      name: 'Ben',
      title: 'Intern',
      otherFields: {},
    },
    {
      id: 'p3',
      source: 'ephemeral',
      name: 'Cy',
      title: 'Founder',
      otherFields: {},
    },
  ] as OutreachWorkingSetRow[];

  const buildService = () => {
    const run = jest.fn(async (_records: unknown[], spec: FilterSpec) => ({
      verdicts: [
        {
          id: 'p1',
          status: 'answered' as const,
          answers: { isCeo: 'pass', inIndia: 'pass' },
          keep: null,
        },
        {
          id: 'p2',
          status: 'answered' as const,
          answers: { isCeo: 'fail', inIndia: 'pass', outcome: 'pass' },
          keep: null,
        },
        {
          id: 'p3',
          status: 'answered' as const,
          answers: { isCeo: 'unknown', inIndia: 'pass' },
          keep: null,
        },
      ],
      stats: {
        engine: 'jev' as const,
        model: spec.model,
        calls: 3,
        retriedRecords: 0,
        durationMs: 1,
        inputTokens: 0,
        outputTokens: 0,
        webSearchCalls: 0,
        groundedSearches: 0,
        groundedSearchCostUsd: 0,
        webSearchProviders: {},
        estimatedCostUsd: null,
      },
    }));
    const service = new OutreachAiColumnService(
      { set: jest.fn() } as never,
      { getAll: jest.fn(async () => rows) } as never,
      { run } as never,
      {} as never,
      {} as never,
    );

    return { service, run };
  };

  it('should build the column from the criteria without a design call', () => {
    const filter = buildFitmentFilter({ stage: 'snapshot', criteria });

    expect(filter.selectedModel).toBe('jev');
    expect(filter.fitment).toMatchObject({ stage: 'snapshot', threshold: 0.5 });
    expect(filter.fields.map((field) => field.name)).toEqual([
      'fitmentOutcome',
      'fitmentScore',
      'fitmentReason',
      'isCeo',
      'inIndia',
    ]);
  });

  it('should ask the model for verdicts only and compute the outcome in code', async () => {
    const { service, run } = buildService();
    const preview = await service.preview({
      workspaceId: 'w',
      projectId: 'proj',
      subject: 'person',
      fitment: { stage: 'snapshot', criteria },
    });
    const spec = run.mock.calls[0][1];

    expect(spec.fields.map((field) => field.name)).toEqual([
      'isCeo',
      'inIndia',
      'evidence',
    ]);
    expect(spec.keepField).toBeUndefined();
    expect(spec.probabilityThreshold).toBe(0.5);

    const outcomeById = Object.fromEntries(
      preview.rows.map((row) => [row.id, row.values.fitmentOutcome]),
    );

    // p2 tried to answer "pass" itself; the failed must-have decides
    expect(outcomeById).toEqual({ p1: 'pass', p2: 'fail', p3: 'unknown' });
    expect(preview.fitment).toMatchObject({
      stage: 'snapshot',
      threshold: 0.5,
      pass: 1,
      fail: 1,
      unknown: 1,
    });
  });

  it('should keep earlier scores out of the next judgement', async () => {
    const { service, run } = buildService();

    await service.preview({
      workspaceId: 'w',
      projectId: 'proj',
      subject: 'person',
      fitment: { stage: 'profile', criteria },
    });

    expect(run.mock.calls[0][1].metadataFields).not.toEqual(
      expect.arrayContaining(['fitmentScore', 'fitmentOutcome', 'isCeo']),
    );
  });
});
