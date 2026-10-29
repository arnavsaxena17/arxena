import { type OutreachTabRow } from 'src/engine/core-modules/outreach-command/services/outreach-tab.service';
import { type OutreachTableView } from 'src/engine/core-modules/outreach-command/utils/outreach-cache-realtime.constants';
import { GetOutreachTabTool } from 'src/engine/core-modules/tool/tools/outreach-ai-column-tool/outreach-ai-column-tools';
import {
  filterOutreachTabRows,
  groupOutreachTabRows,
  MAX_OUTREACH_TAB_GROUPS,
  normalizeOutreachTabFilters,
  pickOutreachTabFields,
} from 'src/engine/core-modules/tool/tools/outreach-ai-column-tool/query-outreach-tab-rows.util';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';

const row = (
  id: string,
  otherFields: Record<string, unknown>,
  extra: Partial<OutreachTabRow> = {},
): OutreachTabRow => ({
  id,
  source: 'ephemeral',
  name: `Company ${id}`,
  otherFields,
  ...extra,
});

const rows = [
  row(
    'a',
    { finalState: 'confirmed', rung: 1, turnover: '', inIndia: true },
    { locationName: 'Ahmedabad, Gujarat' },
  ),
  row(
    'b',
    { finalState: 'confirmed', rung: 2, turnover: 500, inIndia: true },
    { locationName: 'Surat, Gujarat' },
  ),
  row(
    'c',
    { finalState: 'rejected', rung: 1, inIndia: false },
    { locationName: 'Pune, Maharashtra' },
  ),
  row(
    'd',
    { finalState: 'confirmed', rung: 1, inIndia: true },
    { locationName: 'Vadodara, Gujarat' },
  ),
];

describe('query-outreach-tab-rows util', () => {
  it('should filter on otherFields keys and built-in columns with the apply_table_view shape', () => {
    const filters = normalizeOutreachTabFilters([
      {
        columnId: 'turnover',
        kind: 'condition',
        operator: 'empty',
        value: '',
      },
      {
        columnId: 'location',
        kind: 'condition',
        operator: 'contains',
        value: 'gujarat',
      },
    ]);

    expect(filters.map((filter) => filter.columnId)).toEqual([
      'otherFields.turnover',
      'location',
    ]);
    expect(
      filterOutreachTabRows(rows, filters).map((match) => match.id),
    ).toEqual(['a', 'd']);
  });

  it('should match yes/no columns as Yes and No like the table filter does', () => {
    const filters = normalizeOutreachTabFilters([
      { columnId: 'otherFields.inIndia', kind: 'values', values: ['No'] },
    ]);

    expect(
      filterOutreachTabRows(rows, filters).map((match) => match.id),
    ).toEqual(['c']);
  });

  it('should return only the named fields plus the row id', () => {
    expect(
      pickOutreachTabFields(rows.slice(0, 1), ['finalState', 'location']),
    ).toEqual([
      { id: 'a', finalState: 'confirmed', location: 'Ahmedabad, Gujarat' },
    ]);
  });

  it('should count rows per value pair, largest group first', () => {
    const result = groupOutreachTabRows(rows, ['finalState', 'rung']);

    expect(result.distinctGroups).toBe(3);
    expect(result.groups).toEqual([
      { finalState: 'confirmed', rung: '1', count: 2 },
      { finalState: 'confirmed', rung: '2', count: 1 },
      { finalState: 'rejected', rung: '1', count: 1 },
    ]);
    expect(result.otherGroupsRowCount).toBe(0);
  });

  it('should group missing values as (empty)', () => {
    expect(groupOutreachTabRows(rows, ['turnover']).groups).toEqual([
      { turnover: '(empty)', count: 3 },
      { turnover: '500', count: 1 },
    ]);
  });

  it('should cap the groups and report the rows of the groups left out', () => {
    const manyRows = Array.from(
      { length: MAX_OUTREACH_TAB_GROUPS + 5 },
      (_, index) => row(String(index), { city: `City ${index}` }),
    );
    const result = groupOutreachTabRows(manyRows, ['city']);

    expect(result.groups).toHaveLength(MAX_OUTREACH_TAB_GROUPS);
    expect(result.distinctGroups).toBe(MAX_OUTREACH_TAB_GROUPS + 5);
    expect(result.otherGroupsRowCount).toBe(5);
  });
});

describe('GetOutreachTabTool query options', () => {
  const context = { workspaceId: 'workspace-id' } as ToolExecutionContext;

  const buildTool = (
    tabRows: OutreachTabRow[],
    view: OutreachTableView | null = null,
  ) =>
    new GetOutreachTabTool(
      {
        getAll: jest.fn().mockResolvedValue(tabRows),
        collectAiColumns: jest.fn().mockReturnValue([]),
      } as never,
      { get: jest.fn().mockResolvedValue(view) } as never,
    );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should keep the row cap and flag a filtered result over it as a sample', async () => {
    const manyRows = Array.from({ length: 30 }, (_, index) =>
      row(String(index), { finalState: index < 25 ? 'confirmed' : 'open' }),
    );
    const output = await buildTool(manyRows).execute(
      {
        projectId: 'project-id',
        limit: 10,
        filter: [
          { columnId: 'finalState', kind: 'values', values: ['confirmed'] },
        ],
        fields: ['finalState'],
      },
      context,
    );
    const result = output.result as Record<string, unknown>;

    expect(output.success).toBe(true);
    expect(result.total).toBe(30);
    expect(result.matchCount).toBe(25);
    expect(result.rows).toHaveLength(10);
    expect((result.rows as Record<string, unknown>[])[0]).toEqual({
      id: '0',
      finalState: 'confirmed',
    });
    expect(result.truncated).toBe(true);
    expect(result.nextCursor).toBe('10');
    expect(output.message).toContain('sample');
  });

  it('should return group counts without rows, respecting filter and the applied view', async () => {
    const view: OutreachTableView = {
      tab: 'people',
      filters: [
        {
          columnId: 'otherFields.inIndia',
          kind: 'values',
          values: ['Yes'],
        },
      ],
      sort: null,
      summary: 'In India',
      updatedAt: '2026-10-29T00:00:00.000Z',
    };
    const output = await buildTool(rows, view).execute(
      {
        projectId: 'project-id',
        onlyViewMatches: true,
        filter: [
          {
            columnId: 'location',
            kind: 'condition',
            operator: 'contains',
            value: 'Gujarat',
          },
        ],
        groupBy: ['finalState', 'rung'],
      },
      context,
    );
    const result = output.result as Record<string, unknown>;

    expect(result.rows).toBeUndefined();
    expect(result.matchCount).toBe(3);
    expect(result.groups).toEqual([
      { finalState: 'confirmed', rung: '1', count: 2 },
      { finalState: 'confirmed', rung: '2', count: 1 },
    ]);
  });

  it('should warn when a filter or groupBy key is on no row', async () => {
    const output = await buildTool(rows).execute(
      { projectId: 'project-id', groupBy: ['finalStat'] },
      context,
    );

    expect((output.result as Record<string, unknown>).warnings).toEqual([
      'No row has "finalStat"; check the key against aiColumns.',
    ]);
  });

  it('should reject more than two groupBy keys', async () => {
    const output = await buildTool(rows).execute(
      { projectId: 'project-id', groupBy: ['finalState', 'rung', 'inIndia'] },
      context,
    );

    expect(output.success).toBe(false);
  });
});
