import {
  ColumnType,
  type Column,
} from '@/spreadsheet-import/types/columnTypes';
import { setIgnoreColumn } from '@/spreadsheet-import/utils/setIgnoreColumn';

describe('setIgnoreColumn', () => {
  it('should return a column with type "ignored"', () => {
    const column: Column<'John'> = {
      index: 0,
      header: 'Name',
      type: ColumnType.matched,
      value: 'John',
    };
    const result = setIgnoreColumn(column);
    expect(result).toEqual({
      index: 0,
      header: 'Name',
      type: ColumnType.ignored,
    });
  });
});
