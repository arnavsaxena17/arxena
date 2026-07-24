import { TABLE_LIST_KEYS } from '../mcp-assistant.constants';

export const flattenRowForTable = (
  row: Record<string, unknown>,
): Record<string, unknown> => {
  const flat: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      const nested = v as Record<string, unknown>;
      for (const [nk, nv] of Object.entries(nested)) {
        flat[`${k}_${nk}`] = nv;
      }
    } else {
      flat[k] = v;
    }
  }
  return flat;
};

export const extractTableRowsFromToolResult = (
  parsed: unknown,
): Record<string, unknown>[] => {
  let rows: Record<string, unknown>[] = [];
  if (
    Array.isArray(parsed) &&
    parsed.length > 0 &&
    typeof parsed[0] === 'object' &&
    parsed[0] !== null
  ) {
    rows = parsed as Record<string, unknown>[];
  } else if (typeof parsed === 'object' && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    for (const key of TABLE_LIST_KEYS) {
      const list = obj[key];
      if (
        Array.isArray(list) &&
        list.length > 0 &&
        typeof list[0] === 'object' &&
        list[0] !== null
      ) {
        rows = list as Record<string, unknown>[];
        break;
      }
    }
  }
  return rows.map((row) => flattenRowForTable(row));
};
