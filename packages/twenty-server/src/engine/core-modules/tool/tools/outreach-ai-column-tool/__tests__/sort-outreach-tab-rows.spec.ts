import { sortOutreachTabRows } from 'src/engine/core-modules/tool/tools/outreach-ai-column-tool/query-outreach-tab-rows.util';

type Row = Parameters<typeof sortOutreachTabRows>[0][number];

// `employees` is a built-in column read from the row; anything else is an
// otherFields key. Both spellings must sort the same way.
const coreRow = (id: string, employees?: string): Row =>
  ({
    id,
    source: 'ephemeral',
    name: id,
    ...(employees !== undefined && { employees }),
  }) as unknown as Row;

const otherRow = (id: string, otherFields: Record<string, unknown>): Row =>
  ({
    id,
    source: 'ephemeral',
    name: id,
    otherFields,
  }) as unknown as Row;

describe('sortOutreachTabRows', () => {
  describe('a built-in column', () => {
    const rows = [
      coreRow('small', '307'),
      coreRow('big', '15578'),
      coreRow('mid', '1003'),
      coreRow('unknown'),
    ];

    it('should rank numerically, not as text, and put unknown last', () => {
      const sorted = sortOutreachTabRows(rows, [
        { columnId: 'employees', direction: 'desc' },
      ]);

      expect(sorted.map((one) => one.id)).toEqual([
        'big',
        'mid',
        'small',
        'unknown',
      ]);
    });

    it('should reverse for asc but keep unknown last', () => {
      const sorted = sortOutreachTabRows(rows, [
        { columnId: 'employees', direction: 'asc' },
      ]);

      expect(sorted.map((one) => one.id)).toEqual([
        'small',
        'mid',
        'big',
        'unknown',
      ]);
    });
  });

  describe('an otherFields column', () => {
    const rows = [
      otherRow('a', { fitmentScore: 2 }),
      otherRow('b', { fitmentScore: 9 }),
      otherRow('c', {}),
    ];

    it('should sort numbers that are already numeric', () => {
      const sorted = sortOutreachTabRows(rows, [
        { columnId: 'fitmentScore', direction: 'desc' },
      ]);

      expect(sorted.map((one) => one.id)).toEqual(['b', 'a', 'c']);
    });
  });

  it('should leave the input order alone when no sort is given', () => {
    const rows = [coreRow('x', '1'), coreRow('y', '2')];

    expect(sortOutreachTabRows(rows, []).map((one) => one.id)).toEqual([
      'x',
      'y',
    ]);
  });

  it('should not mutate the caller array', () => {
    const rows = [coreRow('x', '1'), coreRow('y', '2')];
    const original = [...rows];

    sortOutreachTabRows(rows, [{ columnId: 'employees', direction: 'desc' }]);

    expect(rows).toEqual(original);
  });
});
