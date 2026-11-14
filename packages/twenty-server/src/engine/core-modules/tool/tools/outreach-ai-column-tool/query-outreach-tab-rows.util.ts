import { isDefined } from 'twenty-shared/utils';

import { type OutreachTabRow } from 'src/domains/engagement/outreach-command/services/outreach-tab.service';
import {
  matchesTableFilter,
  readCellText,
} from 'src/domains/engagement/outreach-command/services/outreach-table-view.service';
import { type OutreachTableFilter } from 'src/domains/engagement/outreach-command/utils/outreach-cache-realtime.constants';

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

// "Top 10 companies by headcount" is a sort, not a filter: without this the
// only way to rank a tab is to page it, which the skill forbids. Numbers
// compare as numbers ("15578" over "307"), everything else as text; a row with
// no value sorts last in both directions so it never poses as the smallest.
export const sortOutreachTabRows = (
  rows: OutreachTabRow[],
  sort: Array<{ columnId: string; direction: 'asc' | 'desc' }>,
): OutreachTabRow[] => {
  if (sort.length === 0) {
    return rows;
  }

  const toNumber = (value: unknown): number | undefined => {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : undefined;
    }

    if (typeof value !== 'string') {
      return undefined;
    }

    const digits = value.replace(/[,\s]/g, '').match(/-?\d+(\.\d+)?/g);

    return digits === null ? undefined : Number(digits[0]);
  };

  const compare = (left: OutreachTabRow, right: OutreachTabRow): number => {
    for (const { columnId, direction } of sort) {
      const leftValue = readFieldValue(left, columnId);
      const rightValue = readFieldValue(right, columnId);

      const leftEmpty = leftValue === undefined || leftValue === null || leftValue === '';
      const rightEmpty = rightValue === undefined || rightValue === null || rightValue === '';

      if (leftEmpty || rightEmpty) {
        if (leftEmpty !== rightEmpty) {
          return leftEmpty ? 1 : -1;
        }

        continue;
      }

      const leftNumber = toNumber(leftValue);
      const rightNumber = toNumber(rightValue);

      const result =
        leftNumber !== undefined && rightNumber !== undefined
          ? leftNumber - rightNumber
          : String(leftValue).localeCompare(String(rightValue));

      if (result !== 0) {
        return direction === 'asc' ? result : -result;
      }
    }

    return 0;
  };

  return [...rows].sort(compare);
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
