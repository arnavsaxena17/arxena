import { buildRecordText } from 'src/engine/core-modules/candidate-sourcing/services/ai-filter-engine/ai-filter-prompt';
import {
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
