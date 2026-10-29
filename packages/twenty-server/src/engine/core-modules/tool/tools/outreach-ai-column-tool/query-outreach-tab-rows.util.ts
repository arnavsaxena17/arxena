import { isDefined } from 'twenty-shared/utils';

import { type OutreachTabRow } from 'src/engine/core-modules/outreach-command/services/outreach-tab.service';
import {
  matchesTableFilter,
  readCellText,
} from 'src/engine/core-modules/outreach-command/services/outreach-table-view.service';
import { type OutreachTableFilter } from 'src/engine/core-modules/outreach-command/utils/outreach-cache-realtime.constants';

const OTHER_FIELDS_PREFIX = 'otherFields.';
const EMPTY_GROUP_LABEL = '(empty)';
export const MAX_OUTREACH_TAB_GROUPS = 50;

// Built-in table columns (as readCellText knows them), plus the row property
// names the agent sees in rows, so either spelling reaches the same column.
const CORE_COLUMN_IDS: Record<string, string> = {
  name: 'name',
  title: 'title',
  company: 'company',
  companyName: 'company',
  location: 'location',
  locationName: 'location',
  domain: 'domain',
  industry: 'industry',
  employees: 'employees',
};

// The agent may pass a bare otherFields key (finalState) or the table column
// id apply_table_view uses (otherFields.finalState); both resolve the same.
export const toOutreachTabColumnId = (key: string): string =>
  key.startsWith(OTHER_FIELDS_PREFIX)
    ? key
    : (CORE_COLUMN_IDS[key] ?? `${OTHER_FIELDS_PREFIX}${key}`);

export const filterOutreachTabRows = (
  rows: OutreachTabRow[],
  filters: OutreachTableFilter[],
): OutreachTabRow[] =>
  filters.length === 0
    ? rows
    : rows.filter((row) =>
        filters.every((filter) =>
          matchesTableFilter(readCellText(row, filter.columnId), filter),
        ),
      );

export const normalizeOutreachTabFilters = (
  filters: OutreachTableFilter[],
): OutreachTableFilter[] =>
  filters.map((filter) => ({
    ...filter,
    columnId: toOutreachTabColumnId(filter.columnId),
  }));

// Keys no row holds are almost always a typo; an empty result would read as
// "nothing matches" instead.
// fields can also read row properties (headline, linkedinUrl); filter and
// groupBy only see what readCellText reads.
export const findUnknownOutreachTabKeys = (
  rows: OutreachTabRow[],
  keys: string[],
  { includeRowProperties = false }: { includeRowProperties?: boolean } = {},
): string[] =>
  keys.filter((key) => {
    const columnId = toOutreachTabColumnId(key);

    if (!columnId.startsWith(OTHER_FIELDS_PREFIX)) {
      return false;
    }

    const fieldKey = columnId.slice(OTHER_FIELDS_PREFIX.length);

    return !rows.some(
      (row) =>
        fieldKey in row.otherFields ||
        (includeRowProperties &&
          isDefined((row as unknown as Record<string, unknown>)[key])),
    );
  });

const readFieldValue = (row: OutreachTabRow, key: string): unknown => {
  const columnId = toOutreachTabColumnId(key);

  if (!columnId.startsWith(OTHER_FIELDS_PREFIX)) {
    return readCellText(row, columnId);
  }

  const fieldKey = columnId.slice(OTHER_FIELDS_PREFIX.length);

  if (fieldKey in row.otherFields) {
    return row.otherFields[fieldKey];
  }

  // headline, linkedinUrl, segment, source… live on the row, not otherFields
  return (row as unknown as Record<string, unknown>)[key];
};

// Only the asked-for fields, so a sample row costs a few tokens instead of
// the whole otherFields blob with its aiColumns meta.
export const pickOutreachTabFields = (
  rows: OutreachTabRow[],
  fields: string[],
): Record<string, unknown>[] =>
  rows.map((row) => ({
    id: row.id,
    ...Object.fromEntries(
      fields.map((field) => [field, readFieldValue(row, field) ?? null]),
    ),
  }));

export type OutreachTabGroup = Record<string, string | number> & {
  count: number;
};

export type OutreachTabGroupResult = {
  groupBy: string[];
  distinctGroups: number;
  // Largest groups first; the rest only add to otherGroupsRowCount
  groups: OutreachTabGroup[];
  otherGroupsRowCount: number;
};

// Counts per value (or value pair) using the cell text the table shows, so
// yes/no columns group as Yes / No exactly like a filter matches them.
export const groupOutreachTabRows = (
  rows: OutreachTabRow[],
  groupBy: string[],
): OutreachTabGroupResult => {
  const columnIds = groupBy.map(toOutreachTabColumnId);
  const groups = new Map<string, { values: string[]; count: number }>();

  for (const row of rows) {
    const values = columnIds.map((columnId) => {
      const text = readCellText(row, columnId).trim();

      return text === '' ? EMPTY_GROUP_LABEL : text;
    });
    const groupKey = JSON.stringify(values);
    const existing = groups.get(groupKey);

    if (isDefined(existing)) {
      existing.count += 1;
    } else {
      groups.set(groupKey, { values, count: 1 });
    }
  }

  const ordered = [...groups.values()].sort((a, b) => b.count - a.count);
  const kept = ordered.slice(0, MAX_OUTREACH_TAB_GROUPS);

  return {
    groupBy,
    distinctGroups: ordered.length,
    groups: kept.map((group) => ({
      ...Object.fromEntries(
        groupBy.map((key, index) => [key, group.values[index]]),
      ),
      count: group.count,
    })),
    otherGroupsRowCount: ordered
      .slice(MAX_OUTREACH_TAB_GROUPS)
      .reduce((sum, group) => sum + group.count, 0),
  };
};
