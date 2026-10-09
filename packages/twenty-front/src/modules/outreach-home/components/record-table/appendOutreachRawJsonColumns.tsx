import {
  OutreachTagCell,
  OutreachTextCell,
} from '@/outreach-home/components/record-table/OutreachRecordTableCells';
import { type OutreachRecordTableColumn } from '@/outreach-home/components/record-table/OutreachRecordTable';
import {
  collectRawJsonColumnIds,
  humanizeJsonKey,
  type OutreachTableColumnLayout,
  readRawJsonCell,
  readRawJsonValue,
} from '@/outreach-home/utils/outreach-table-layout.util';

const readAiColumnType = (rows: object[], key: string): string | null => {
  for (const row of rows) {
    const otherFields = (row as Record<string, unknown>).otherFields;
    const meta =
      typeof otherFields === 'object' && otherFields !== null
        ? (otherFields as Record<string, unknown>).aiColumns
        : null;
    const entry =
      typeof meta === 'object' && meta !== null
        ? (meta as Record<string, unknown>)[key]
        : null;
    const type =
      typeof entry === 'object' && entry !== null
        ? (entry as Record<string, unknown>).type
        : null;

    if (typeof type === 'string') {
      return type;
    }
  }

  return null;
};

const formatNumber = (value: number): string =>
  Number.isInteger(value)
    ? value.toLocaleString('en-US')
    : value.toLocaleString('en-US', { maximumFractionDigits: 2 });

// AI columns also record per-row status, so a row whose lookup failed shows
// "Failed" instead of an empty cell that looks like "not run".
const readAiColumnRowStatus = (
  row: object,
  columnId: string,
  key: string,
): string | null => {
  if (!columnId.startsWith('otherFields.')) {
    return null;
  }

  const otherFields = (row as Record<string, unknown>).otherFields;
  const meta =
    typeof otherFields === 'object' && otherFields !== null
      ? (otherFields as Record<string, unknown>).aiColumns
      : null;
  const entry =
    typeof meta === 'object' && meta !== null
      ? (meta as Record<string, unknown>)[key]
      : null;
  const status =
    typeof entry === 'object' && entry !== null
      ? (entry as Record<string, unknown>).status
      : null;

  return typeof status === 'string' ? status : null;
};

// AI columns record their header label next to the value in otherFields.aiColumns.
const readAiColumnLabel = (rows: object[], key: string): string | null => {
  for (const row of rows) {
    const otherFields = (row as Record<string, unknown>).otherFields;
    const meta =
      typeof otherFields === 'object' && otherFields !== null
        ? (otherFields as Record<string, unknown>).aiColumns
        : null;
    const entry =
      typeof meta === 'object' && meta !== null
        ? (meta as Record<string, unknown>)[key]
        : null;
    const label =
      typeof entry === 'object' && entry !== null
        ? (entry as Record<string, unknown>).label
        : null;

    if (typeof label === 'string' && label.length > 0) {
      return label;
    }
  }

  return null;
};

const resolveColumnLabel = (
  rows: object[],
  columnId: string,
  key: string,
): string =>
  (columnId.startsWith('otherFields.')
    ? readAiColumnLabel(rows, key)
    : null) ?? humanizeJsonKey(key);

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
    labels.set(columnId, resolveColumnLabel(rows, columnId, key));
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
      const label = resolveColumnLabel(rows, columnId, key);
      const needsBag =
        (labelCounts.get(label) ?? 0) > 1;

      const isNumeric =
        columnId.startsWith('otherFields.') &&
        ['number', 'integer'].includes(readAiColumnType(rows, key) ?? '');
      const readNumber = (row: TRow): number | null => {
        const raw = readRawJsonValue(row, columnId);

        return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
      };

      return {
        id: columnId,
        label: needsBag ? `${humanizeJsonKey(bag)} · ${label}` : label,
        width: 160,
        valueType: isNumeric ? ('number' as const) : ('text' as const),
        sortValue: isNumeric
          ? (row: TRow) => readNumber(row)
          : (row: TRow) => readRawJsonCell(row, columnId),
        render: (row: TRow) => {
          const value = isNumeric
            ? (() => {
                const numeric = readNumber(row);

                return numeric === null ? '' : formatNumber(numeric);
              })()
            : readRawJsonCell(row, columnId);

          return value === '' &&
            readAiColumnRowStatus(row, columnId, key) === 'failed' ? (
            <OutreachTagCell label="Failed" color="red" />
          ) : (
            <OutreachTextCell value={value} />
          );
        },
      };
    });

  return [...columns, ...jsonColumns];
};
