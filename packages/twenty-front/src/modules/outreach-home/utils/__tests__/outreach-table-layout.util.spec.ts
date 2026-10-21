import {
  collectRawJsonColumnIds,
  filterOutreachRows,
  hideColumnInLayout,
  readRawJsonCell,
  reorderColumnInLayout,
  resolveVisibleColumns,
  showColumnInLayout,
} from '@/outreach-home/utils/outreach-table-layout.util';

type Row = { name: string; title: string; location: string };

const columns = [
  { id: 'name', width: 200, sortValue: (row: Row) => row.name },
  { id: 'title', width: 180, sortValue: (row: Row) => row.title },
  {
    id: 'location',
    width: 170,
    sortValue: (row: Row) => row.location,
  },
];

describe('outreach table layout', () => {
  it('shows scalar raw json keys and skips objects', () => {
    const rows = [
      {
        otherFields: {
          network_distance: 'DISTANCE_2',
          experience: [{ company: 'Acme' }],
        },
        outreachAnalytics: { lastOutboundMessageKind: 'CONNECTION_NOTE' },
      },
    ];

    expect(collectRawJsonColumnIds(rows)).toEqual([
      'otherFields.network_distance',
      'outreachAnalytics.lastOutboundMessageKind',
    ]);
    expect(readRawJsonCell(rows[0], 'otherFields.network_distance')).toBe(
      'DISTANCE_2',
    );
  });

  it('hides, reorders, and filters columns', () => {
    const rows = [
      { name: 'Ada', title: 'VP', location: 'Riyadh' },
      { name: 'Grace', title: 'Director', location: 'Dubai' },
    ];
    const hidden = hideColumnInLayout(columns, null, 'title');
    const visible = resolveVisibleColumns(columns, hidden, rows);

    expect(visible.map((column) => column.id)).toEqual(['name', 'location']);

    const reordered = reorderColumnInLayout(columns, null, 'location', 'title');

    expect(
      resolveVisibleColumns(columns, reordered, rows).map(
        (column) => column.id,
      ),
    ).toEqual(['name', 'location', 'title']);

    expect(
      filterOutreachRows(rows, columns, [
        { columnId: 'location', kind: 'values', values: ['Riyadh'] },
        {
          columnId: 'title',
          kind: 'condition',
          operator: 'contains',
          value: 'vp',
        },
      ]),
    ).toEqual([rows[0]]);
  });

  it('hides entirely blank columns until force-shown', () => {
    const rows = [
      { name: 'Ada', title: 'VP', location: '' },
      { name: 'Grace', title: 'Director', location: '' },
    ];

    expect(
      resolveVisibleColumns(columns, null, rows).map((column) => column.id),
    ).toEqual(['name', 'title']);

    const forced = showColumnInLayout(columns, null, 'location');

    expect(
      resolveVisibleColumns(columns, forced, rows).map((column) => column.id),
    ).toEqual(['name', 'title', 'location']);
    expect(forced.find((item) => item.id === 'location')?.forceVisible).toBe(
      true,
    );
  });
});
