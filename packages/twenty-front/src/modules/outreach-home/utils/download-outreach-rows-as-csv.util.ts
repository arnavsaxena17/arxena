import {
  type OutreachColumnFilter,
  type OutreachTableColumnLayout,
  filterOutreachRows,
  getOutreachCellText,
  resolveVisibleColumns,
} from '@/outreach-home/utils/outreach-table-layout.util';

type CsvColumn<TRow> = {
  id: string;
  label: string;
  width: number;
  sortValue?: (row: TRow) => string | number | null | undefined;
};

const escapeCsvValue = (value: string): string =>
  /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

// Exports what the table shows: visible columns in layout order, rows after
// column filters. A UTF-8 BOM makes Excel open the file with correct encoding.
export const downloadOutreachRowsAsCsv = <TRow>({
  rows,
  columns,
  columnLayout,
  columnFilters,
  fileName,
}: {
  rows: TRow[];
  columns: CsvColumn<TRow>[];
  columnLayout: OutreachTableColumnLayout[] | null;
  columnFilters: OutreachColumnFilter[];
  fileName: string;
}): number => {
  const visibleColumns = resolveVisibleColumns(
    columns,
    columnLayout,
    rows,
  ).filter((column) => column.sortValue !== undefined);
  const exportedRows = filterOutreachRows(rows, columns, columnFilters);

  const lines = [
    visibleColumns.map((column) => escapeCsvValue(column.label)).join(','),
    ...exportedRows.map((row) =>
      visibleColumns
        .map((column) => escapeCsvValue(getOutreachCellText(column, row)))
        .join(','),
    ),
  ];

  const blob = new Blob(['﻿' + lines.join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);

  return exportedRows.length;
};
