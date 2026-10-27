import { type OutreachTabRow } from 'src/engine/core-modules/outreach-command/services/outreach-tab.service';

const aiColumnStatus = (row: OutreachTabRow, key: string): unknown => {
  const meta = row.otherFields.aiColumns;
  const entry =
    typeof meta === 'object' && meta !== null
      ? (meta as Record<string, unknown>)[key]
      : undefined;

  return typeof entry === 'object' && entry !== null
    ? (entry as Record<string, unknown>).status
    : undefined;
};

// A row is filled when every column key is answered ("ok") or already has a
// value. "ok" with an empty value means "no credible answer": already done.
export const isAiColumnFilled = (
  row: OutreachTabRow,
  columnKeys: string[],
): boolean =>
  columnKeys.every(
    (key) =>
      aiColumnStatus(row, key) === 'ok' ||
      (row.otherFields[key] !== undefined && row.otherFields[key] !== null),
  );
