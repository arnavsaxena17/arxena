import {
  collectRawJsonColumnIds,
  filterOutreachRows,
  hideColumnInLayout,
  readRawJsonCell,
  reorderColumnInLayout,
  resolveVisibleColumns,
} from '@/outreach-home/utils/outreach-table-layout.util';

const columns = [
  { id: 'name', width: 200, sortValue: (row: { name: string }) => row.name },
  { id: 'title', width: 180, sortValue: (row: { title: string }) => row.title },
  {
    id: 'location',
    width: 170,
    sortValue: (row: { location: string }) => row.location,
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
    const hidden = hideColumnInLayout(columns, null, 'title');
    const visible = resolveVisibleColumns(columns, hidden);

    expect(visible.map((column) => column.id)).toEqual(['name', 'location']);

    const reordered = reorderColumnInLayout(columns, null, 'location', 'title');

    expect(
      resolveVisibleColumns(columns, reordered).map((column) => column.id),
    ).toEqual(['name', 'location', 'title']);

    const rows = [
      { name: 'Ada', title: 'VP', location: 'Riyadh' },
      { name: 'Grace', title: 'Director', location: 'Dubai' },
    ];

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
});
