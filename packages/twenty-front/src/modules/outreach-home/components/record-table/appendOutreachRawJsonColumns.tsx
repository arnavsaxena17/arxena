import { OutreachTextCell } from '@/outreach-home/components/record-table/OutreachRecordTableCells';
import { type OutreachRecordTableColumn } from '@/outreach-home/components/record-table/OutreachRecordTable';
import {
  collectRawJsonColumnIds,
  humanizeJsonKey,
  type OutreachTableColumnLayout,
  readRawJsonCell,
} from '@/outreach-home/utils/outreach-table-layout.util';

export const appendOutreachRawJsonColumns = <TRow extends object>(
  columns: OutreachRecordTableColumn<TRow>[],
  rows: TRow[],
  layout: OutreachTableColumnLayout[] | null,
): OutreachRecordTableColumn<TRow>[] => {
  const existingIds = new Set(columns.map((column) => column.id));
  const columnIds = collectRawJsonColumnIds(
    rows,
    (layout ?? []).map((item) => item.id),
  );
  const labels = new Map<string, string>();

  for (const columnId of columnIds) {
    const key = columnId.slice(columnId.indexOf('.') + 1);
    labels.set(columnId, humanizeJsonKey(key));
  }

  const labelCounts = new Map<string, number>();

  for (const label of labels.values()) {
    labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
  }

  const jsonColumns = columnIds
    .filter((columnId) => !existingIds.has(columnId))
    .map((columnId) => {
      const key = columnId.slice(columnId.indexOf('.') + 1);
      const bag = columnId.slice(0, columnId.indexOf('.'));
      const label = humanizeJsonKey(key);
      const needsBag =
        (labelCounts.get(label) ?? 0) > 1;

      return {
        id: columnId,
        label: needsBag ? `${humanizeJsonKey(bag)} · ${label}` : label,
        width: 160,
        sortValue: (row: TRow) => readRawJsonCell(row, columnId),
        render: (row: TRow) => (
          <OutreachTextCell value={readRawJsonCell(row, columnId)} />
        ),
      };
    });

  return [...columns, ...jsonColumns];
};
