import {
  countMatchingRows,
  matchesTableFilter,
  OutreachTableViewService,
  readCellText,
} from 'src/engine/core-modules/outreach-command/services/outreach-table-view.service';
import { type OutreachWorkingSetRow } from 'src/engine/core-modules/outreach-command/services/outreach-working-set.service';

const aiColumns = {
  isCeo: { label: 'Is CEO', type: 'boolean', status: 'ok' },
  employees: { label: 'Employees', type: 'integer', status: 'ok' },
  region: {
    label: 'Region',
    type: 'enum',
    enumValues: ['Middle East', 'India'],
    status: 'ok',
  },
};

const row = (
  id: string,
  title: string,
  otherFields: Record<string, unknown>,
): OutreachWorkingSetRow => ({
  id,
  source: 'crm',
  name: `Person ${id}`,
  title,
  companyName: `Company ${id}`,
  otherFields: { aiColumns, ...otherFields },
});

const rows = [
  row('a', 'CEO', { isCeo: true, employees: 900, region: 'Middle East' }),
  row('b', 'CEO', { isCeo: true, employees: 120, region: 'India' }),
  row('c', 'Director', { isCeo: false, employees: 2000, region: 'India' }),
  row('d', 'CEO', { isCeo: true, region: 'Middle East' }),
];

const buildService = (design: Record<string, unknown>) => {
  const set = jest.fn(async () => undefined);
  const notify = jest.fn();
  const service = new OutreachTableViewService(
    { get: jest.fn(async () => undefined), set } as never,
    { getAll: jest.fn(async () => rows) } as never,
    { designTableView: jest.fn(async () => design) } as never,
    { notifyTableViewUpdated: notify } as never,
  );

  return { service, set, notify };
};

describe('table view cell text and matching', () => {
  it('should show booleans as Yes/No and numbers as plain digits like the table does', () => {
    expect(readCellText(rows[0], 'otherFields.isCeo')).toBe('Yes');
    expect(readCellText(rows[2], 'otherFields.isCeo')).toBe('No');
    expect(readCellText(rows[0], 'otherFields.employees')).toBe('900');
    expect(readCellText(rows[3], 'otherFields.employees')).toBe('');
  });

  it('should compare numbers numerically and skip empty cells', () => {
    const over500 = {
      columnId: 'otherFields.employees',
      kind: 'condition' as const,
      operator: 'greaterThan' as const,
      value: '500',
    };

    expect(matchesTableFilter('900', over500)).toBe(true);
    expect(matchesTableFilter('120', over500)).toBe(false);
    expect(matchesTableFilter('', over500)).toBe(false);
    // "1000" > "500" is false as text but true as numbers
    expect(matchesTableFilter('1000', over500)).toBe(true);
  });

  it('should count rows that satisfy every filter', () => {
    expect(
      countMatchingRows(rows, [
        { columnId: 'otherFields.isCeo', kind: 'values', values: ['Yes'] },
        {
          columnId: 'otherFields.employees',
          kind: 'condition',
          operator: 'greaterThan',
          value: '500',
        },
      ]),
    ).toBe(1);
  });
});

describe('OutreachTableViewService', () => {
  it('should list core columns plus the AI columns found on the rows, with their values', async () => {
    const { service } = buildService({});
    const { columns } = await service.listColumns({
      workspaceId: 'ws',
      projectId: 'project',
      tab: 'people',
    });
    const byId = new Map(columns.map((column) => [column.columnId, column]));

    expect(byId.get('title')?.label).toBe('Job title');
    expect(byId.get('otherFields.isCeo')).toMatchObject({
      type: 'boolean',
      values: ['Yes', 'No'],
    });
    expect(byId.get('otherFields.employees')).toMatchObject({
      type: 'integer',
    });
    expect(byId.get('otherFields.employees')?.values).toBeUndefined();
    expect(byId.get('otherFields.region')?.values).toEqual([
      'Middle East',
      'India',
    ]);
  });

  it('should turn a design into table filters and a sort and count the matches', async () => {
    const { service } = buildService({
      needsFilter: true,
      needsSort: true,
      filters: [
        { columnId: 'otherFields.isCeo', operator: 'in', values: ['true'] },
        {
          columnId: 'otherFields.employees',
          operator: 'greaterThan',
          values: ['1,000'],
        },
        { columnId: 'nope', operator: 'in', values: ['x'] },
      ],
      sortColumnId: 'otherFields.employees',
      sortDirection: 'desc',
      summary: 'CEOs of big companies, largest first',
      unmatched: '',
    });
    const generated = await service.generate({
      workspaceId: 'ws',
      projectId: 'project',
      tab: 'people',
      description: 'ceos of companies over 1000, largest first',
    });

    expect(generated.filters).toEqual([
      { columnId: 'otherFields.isCeo', kind: 'values', values: ['Yes'] },
      {
        columnId: 'otherFields.employees',
        kind: 'condition',
        operator: 'greaterThan',
        value: '1000',
      },
    ]);
    expect(generated.sort).toEqual({
      columnId: 'otherFields.employees',
      direction: 'desc',
    });
    expect(generated.matchCount).toBe(0);
    expect(generated.total).toBe(4);
    expect(generated.warnings).toEqual(['Unknown column "nope" was skipped.']);
  });

  it('should propose nothing when the request needs neither a filter nor a sort', async () => {
    const { service } = buildService({
      needsFilter: false,
      needsSort: false,
      filters: [
        { columnId: 'otherFields.isCeo', operator: 'in', values: ['Yes'] },
      ],
      sortColumnId: '',
      sortDirection: 'asc',
      summary: 'Just adding a column',
      unmatched: '',
    });
    const generated = await service.generate({
      workspaceId: 'ws',
      projectId: 'project',
      tab: 'people',
      description: 'what are the revenues of each company',
    });

    expect(generated).toMatchObject({
      needsFilter: false,
      needsSort: false,
      filters: [],
      sort: null,
      matchCount: 4,
    });
  });

  it('should say when part of the request has no matching column', async () => {
    const { service } = buildService({
      needsFilter: false,
      needsSort: false,
      filters: [],
      sortColumnId: '',
      sortDirection: 'asc',
      summary: 'No filters or sort applied',
      unmatched: 'no revenue column',
    });
    const generated = await service.generate({
      workspaceId: 'ws',
      projectId: 'project',
      tab: 'people',
      description: 'who has revenue above 1 million',
    });

    expect(generated.warnings).toEqual(['Not possible: no revenue column.']);
    expect(generated.needsFilter).toBe(false);
  });

  it('should store an applied view and tell open pages, dropping unknown columns', async () => {
    const { service, set, notify } = buildService({});
    const applied = await service.apply({
      workspaceId: 'ws',
      projectId: 'project',
      tab: 'people',
      filters: [
        { columnId: 'otherFields.isCeo', kind: 'values', values: ['Yes'] },
        { columnId: 'ghost', kind: 'values', values: ['x'] },
      ],
      sort: { columnId: 'otherFields.employees', direction: 'desc' },
      summary: 'CEOs, largest first',
    });

    expect(applied.view.filters).toHaveLength(1);
    expect(applied.matchCount).toBe(3);
    expect(set).toHaveBeenCalledWith(
      'outreach-table-view:ws:project:people',
      expect.objectContaining({ summary: 'CEOs, largest first' }),
      expect.any(Number),
    );
    expect(notify).toHaveBeenCalledWith(
      'project',
      expect.objectContaining({ tab: 'people' }),
    );
  });
});
