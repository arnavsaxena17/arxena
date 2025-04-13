import { atomFamily, selectorFamily } from 'recoil';
import { TableData } from '../types';

// Extend TableData to allow string indexing
interface IndexableTableData extends TableData {
  [key: string]: any;
}

// Atom family to store table data for each instance
export const tableDataState = atomFamily<IndexableTableData[], string>({
  key: 'tableDataState',
  default: [],
});

// Selector to get a specific row
export const tableRowSelector = selectorFamily<IndexableTableData | undefined, { tableId: string; rowIndex: number }>({
  key: 'tableRowSelector',
  get: ({ tableId, rowIndex }) => ({ get }) => {
    const tableData = get(tableDataState(tableId));
    return tableData[rowIndex];
  },
});

// Selector to update a specific cell
export const tableCellSelector = selectorFamily<
  any,
  { tableId: string; rowIndex: number; columnKey: string }
>({
  key: 'tableCellSelector',
  get: ({ tableId, rowIndex, columnKey }) => ({ get }) => {
    const row = get(tableRowSelector({ tableId, rowIndex }));
    return row ? row[columnKey] : undefined;
  },
  set: ({ tableId, rowIndex, columnKey }) => ({ set }, newValue) => {
    set(tableDataState(tableId), (prevData) => {
      const newData = [...prevData];
      if (newData[rowIndex]) {
        newData[rowIndex] = {
          ...newData[rowIndex],
          [columnKey]: newValue,
        };
      }
      return newData;
    });
  },
}); 