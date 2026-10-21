import { isDefined } from 'twenty-shared/utils';

type LayoutColumn<TRow> = {
  id: string;
  width: number;
  valueType?: 'text' | 'number';
  sortValue?: (row: TRow) => string | number | null | undefined;
};

export const OUTREACH_RAW_JSON_BAGS = [
  'otherFields',
  'jobSpecificFields',
  'outreachAnalytics',
  'outreachProspectEnrichment',
  'linkedinProfile',
  'linkedinPosts',
] as const;

export type OutreachRawJsonBag = (typeof OUTREACH_RAW_JSON_BAGS)[number];

export type OutreachTableColumnLayout = {
  id: string;
  isVisible: boolean;
  // User picked this from Hidden fields; keep showing even when every cell is blank
  forceVisible?: boolean;
  size: number;
  position: number;
};

export type OutreachTableKey = 'people' | 'companies';

export type OutreachTableLayoutDocument = {
  people: OutreachTableColumnLayout[];
  companies: OutreachTableColumnLayout[];
};

export type OutreachColumnFilter =
  | {
      columnId: string;
      kind: 'values';
      values: string[];
    }
  | {
      columnId: string;
      kind: 'condition';
      operator:
        | 'contains'
        | 'notContains'
        | 'equals'
        | 'empty'
        | 'notEmpty'
        | 'greaterThan'
        | 'greaterThanOrEqual'
        | 'lessThan'
        | 'lessThanOrEqual'
        | 'between';
      value: string;
      // Upper bound for 'between' (inclusive); value is the lower bound
      valueTo?: string;
    };

const EMPTY_LAYOUT: OutreachTableLayoutDocument = {
  people: [],
  companies: [],
};

const layoutStorageKey = (projectId: string) =>
  `outreach-table-layout:${projectId}`;

const filterStorageKey = (projectId: string, tableKey: OutreachTableKey) =>
  `outreach-table-filters:${projectId}:${tableKey}`;

const isLayoutItem = (value: unknown): value is OutreachTableColumnLayout => {
  if (!isDefined(value) || typeof value !== 'object') {
    return false;
  }

  const item = value as Record<string, unknown>;

  return (
    typeof item.id === 'string' &&
    typeof item.isVisible === 'boolean' &&
    typeof item.size === 'number' &&
    typeof item.position === 'number' &&
    (item.forceVisible === undefined || typeof item.forceVisible === 'boolean')
  );
};

const parseLayoutList = (value: unknown): OutreachTableColumnLayout[] =>
  Array.isArray(value) ? value.filter(isLayoutItem) : [];

export const parseOutreachTableLayout = (
  value: unknown,
): OutreachTableLayoutDocument => {
  if (!isDefined(value) || typeof value !== 'object' || Array.isArray(value)) {
    return EMPTY_LAYOUT;
  }

  const document = value as Record<string, unknown>;

  return {
    people: parseLayoutList(document.people),
    companies: parseLayoutList(document.companies),
  };
};

export const readStoredOutreachTableLayout = (
  projectId: string | null | undefined,
): OutreachTableLayoutDocument => {
  if (!projectId || typeof localStorage === 'undefined') {
    return EMPTY_LAYOUT;
  }

  try {
    const raw = localStorage.getItem(layoutStorageKey(projectId));

    return raw ? parseOutreachTableLayout(JSON.parse(raw)) : EMPTY_LAYOUT;
  } catch {
    return EMPTY_LAYOUT;
  }
};

export const writeStoredOutreachTableLayout = (
  projectId: string,
  document: OutreachTableLayoutDocument,
) => {
  localStorage.setItem(layoutStorageKey(projectId), JSON.stringify(document));
};

export const readStoredOutreachColumnFilters = (
  projectId: string | null | undefined,
  tableKey: OutreachTableKey,
): OutreachColumnFilter[] => {
  if (!projectId || typeof localStorage === 'undefined') {
    return [];
  }

  try {
    const raw = localStorage.getItem(filterStorageKey(projectId, tableKey));
    const parsed: unknown = raw ? JSON.parse(raw) : [];

    return Array.isArray(parsed) ? (parsed as OutreachColumnFilter[]) : [];
  } catch {
    return [];
  }
};

export const writeStoredOutreachColumnFilters = (
  projectId: string,
  tableKey: OutreachTableKey,
  filters: OutreachColumnFilter[],
) => {
  const key = filterStorageKey(projectId, tableKey);

  if (filters.length === 0) {
    localStorage.removeItem(key);
    return;
  }

  localStorage.setItem(key, JSON.stringify(filters));
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  let parsed = value;

  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed) as unknown;
    } catch {
      return null;
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }

  return parsed as Record<string, unknown>;
};

// Handsontable hides a key when any row stores an object or array there
export const isScalarJsonValue = (value: unknown): boolean => {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value === 'boolean' || typeof value === 'number') {
    return true;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;

        if (typeof parsed === 'object' && parsed !== null) {
          return false;
        }
      } catch {
        return true;
      }
    }

    return true;
  }

  return false;
};

const isNonEmptyScalar = (value: unknown): boolean =>
  isScalarJsonValue(value) &&
  value !== null &&
  value !== undefined &&
  value !== '';

export const humanizeJsonKey = (key: string): string => {
  const spaced = key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();

  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

export const rawJsonColumnId = (bag: string, key: string) => `${bag}.${key}`;

const splitRawJsonColumnId = (
  columnId: string,
): { bag: string; key: string } | null => {
  const separatorIndex = columnId.indexOf('.');

  if (separatorIndex <= 0) {
    return null;
  }

  const bag = columnId.slice(0, separatorIndex);

  if (!OUTREACH_RAW_JSON_BAGS.includes(bag as OutreachRawJsonBag)) {
    return null;
  }

  return { bag, key: columnId.slice(separatorIndex + 1) };
};

export const readRawJsonValue = (row: object, columnId: string): unknown => {
  const parsedId = splitRawJsonColumnId(columnId);

  if (!parsedId) {
    return undefined;
  }

  return asRecord((row as Record<string, unknown>)[parsedId.bag])?.[
    parsedId.key
  ];
};

export const readRawJsonCell = (row: object, columnId: string): string => {
  const parsedId = splitRawJsonColumnId(columnId);

  if (!parsedId) {
    return '';
  }

  const record = asRecord((row as Record<string, unknown>)[parsedId.bag]);
  const value = record?.[parsedId.key];

  if (!isNonEmptyScalar(value)) {
    return '';
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  return String(value);
};

export const collectRawJsonColumnIds = (
  rows: object[],
  extraColumnIds: string[] = [],
): string[] => {
  const columnIds = new Set<string>();

  for (const bag of OUTREACH_RAW_JSON_BAGS) {
    const keys = new Set<string>();

    for (const row of rows) {
      const record = asRecord((row as Record<string, unknown>)[bag]);

      if (!record) {
        continue;
      }

      for (const key of Object.keys(record)) {
        keys.add(key);
      }
    }

    for (const key of keys) {
      const values = rows.map((row) => {
        const record = asRecord((row as Record<string, unknown>)[bag]);

        return record && key in record ? record[key] : undefined;
      });
      const presentValues = values.filter((value) => value !== undefined);
      const scalarsOnly = presentValues.every(isScalarJsonValue);
      const hasValue = presentValues.some(isNonEmptyScalar);

      if (scalarsOnly && hasValue) {
        columnIds.add(rawJsonColumnId(bag, key));
      }
    }
  }

  for (const columnId of extraColumnIds) {
    if (splitRawJsonColumnId(columnId)) {
      columnIds.add(columnId);
    }
  }

  return [...columnIds];
};

export const getOutreachCellText = <TRow>(
  column: Pick<LayoutColumn<TRow>, 'sortValue'>,
  row: TRow,
): string => {
  const value = column.sortValue?.(row);

  if (!isDefined(value) || value === '') {
    return '';
  }

  return String(value);
};

export const isOutreachColumnBlank = <TRow>(
  column: Pick<LayoutColumn<TRow>, 'sortValue'>,
  rows: TRow[],
): boolean =>
  rows.length === 0 ||
  rows.every((row) => getOutreachCellText(column, row) === '');

const PINNED_AFTER_STATUS_COLUMN_IDS = [
  'otherFields.peopleFound',
  'otherFields.peopleFoundCount',
];

export const materializeColumnLayout = <TRow>(
  columns: Array<Pick<LayoutColumn<TRow>, 'id' | 'width'>>,
  layout: OutreachTableColumnLayout[] | null,
): OutreachTableColumnLayout[] => {
  const saved = layout ?? [];
  const savedById = new Map(saved.map((item) => [item.id, item]));
  const columnIds = new Set(columns.map((column) => column.id));
  const fromColumns = columns.map((column, index) => {
    const existing = savedById.get(column.id);

    if (existing) {
      return existing;
    }

    return {
      id: column.id,
      isVisible: true,
      size: column.width,
      position: saved.length + index,
    };
  });
  const extraSaved = saved.filter((item) => !columnIds.has(item.id));
  const materialized = [...fromColumns, ...extraSaved];

  return materialized
    .map((item, index) => ({ ...item, position: item.position ?? index }))
    .sort((left, right) => left.position - right.position)
    .map((item, index) => ({ ...item, position: index }));
};

export const resolveVisibleColumns = <
  TRow,
  TColumn extends Pick<LayoutColumn<TRow>, 'id' | 'width' | 'sortValue'>,
>(
  columns: TColumn[],
  layout: OutreachTableColumnLayout[] | null,
  rows: TRow[] = [],
): TColumn[] => {
  const layoutById = new Map((layout ?? []).map((item) => [item.id, item]));
  const shouldShowColumn = (column: TColumn): boolean => {
    if (column.id === 'name') {
      return true;
    }

    const layoutItem = layoutById.get(column.id);

    if (layoutItem && !layoutItem.isVisible && !layoutItem.forceVisible) {
      return false;
    }

    if (layoutItem?.forceVisible === true) {
      return true;
    }

    // Entirely blank columns stay in Hidden fields until the user re-adds them
    if (rows.length > 0 && isOutreachColumnBlank(column, rows)) {
      return false;
    }

    return true;
  };

  if (!layout || layout.length === 0) {
    return columns.filter(shouldShowColumn);
  }

  const columnsById = new Map(columns.map((column) => [column.id, column]));
  const savedIds = new Set(layout.map((item) => item.id));
  const savedVisible = [...layout]
    .sort((left, right) => left.position - right.position)
    .flatMap((item) => {
      const column = columnsById.get(item.id);

      if (!column || !shouldShowColumn(column)) {
        return [];
      }

      return [
        {
          ...column,
          width: item.size > 0 ? item.size : column.width,
        },
      ];
    });
  const unsaved = columns.filter(
    (column) => !savedIds.has(column.id) && shouldShowColumn(column),
  );
  const pinned = unsaved.filter((column) =>
    PINNED_AFTER_STATUS_COLUMN_IDS.includes(column.id),
  );
  const rest = unsaved.filter((column) => !pinned.includes(column));
  const merged = [...savedVisible, ...rest];

  // columns a saved layout has not seen yet go to the end, except the ones
  // people look for first, which sit right after Status
  const statusIndex = merged.findIndex((column) => column.id === 'status');

  merged.splice(
    statusIndex >= 0 ? statusIndex + 1 : merged.length,
    0,
    ...pinned,
  );

  const nameColumn = merged.find((column) => column.id === 'name');

  if (!nameColumn) {
    return merged;
  }

  return [nameColumn, ...merged.filter((column) => column.id !== 'name')];
};

export const hideColumnInLayout = <TRow>(
  columns: Array<Pick<LayoutColumn<TRow>, 'id' | 'width'>>,
  layout: OutreachTableColumnLayout[] | null,
  columnId: string,
): OutreachTableColumnLayout[] =>
  materializeColumnLayout(columns, layout).map((item) =>
    item.id === columnId && item.id !== 'name'
      ? { ...item, isVisible: false, forceVisible: false }
      : item,
  );

export const showColumnInLayout = <TRow>(
  columns: Array<Pick<LayoutColumn<TRow>, 'id' | 'width'>>,
  layout: OutreachTableColumnLayout[] | null,
  columnId: string,
): OutreachTableColumnLayout[] => {
  const full = materializeColumnLayout(columns, layout);
  const withColumn = full.some((item) => item.id === columnId)
    ? full
    : [
        ...full,
        {
          id: columnId,
          isVisible: true,
          forceVisible: true,
          size: 160,
          position: full.length,
        },
      ];

  return withColumn.map((item) =>
    item.id === columnId
      ? { ...item, isVisible: true, forceVisible: true }
      : item,
  );
};

export const resizeColumnInLayout = <TRow>(
  columns: Array<Pick<LayoutColumn<TRow>, 'id' | 'width'>>,
  layout: OutreachTableColumnLayout[] | null,
  columnId: string,
  size: number,
): OutreachTableColumnLayout[] =>
  materializeColumnLayout(columns, layout).map((item) =>
    item.id === columnId ? { ...item, size } : item,
  );

export const reorderColumnInLayout = <TRow>(
  columns: Array<Pick<LayoutColumn<TRow>, 'id' | 'width'>>,
  layout: OutreachTableColumnLayout[] | null,
  fromColumnId: string,
  toColumnId: string,
): OutreachTableColumnLayout[] => {
  if (fromColumnId === 'name') {
    return materializeColumnLayout(columns, layout);
  }

  const full = materializeColumnLayout(columns, layout);
  const visible = full.filter((item) => item.isVisible || item.id === 'name');
  const hidden = full.filter((item) => !item.isVisible && item.id !== 'name');
  const fromIndex = visible.findIndex((item) => item.id === fromColumnId);
  const nameIndex = visible.findIndex((item) => item.id === 'name');
  const toIndex =
    toColumnId === 'name'
      ? nameIndex + 1
      : visible.findIndex((item) => item.id === toColumnId);

  if (fromIndex < 0 || toIndex < 0) {
    return full;
  }

  const reordered = [...visible];
  const [moved] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, moved);

  return [...reordered, ...hidden].map((item, index) => ({
    ...item,
    position: index,
  }));
};

const matchesFilter = (
  cellText: string,
  filter: OutreachColumnFilter,
): boolean => {
  if (filter.kind === 'values') {
    return filter.values.includes(cellText);
  }

  const haystack = cellText.toLowerCase();
  const needle = filter.value.trim().toLowerCase();
  const cellNumber = Number(cellText.replace(/,/g, ''));
  const needleNumber = Number(needle.replace(/,/g, ''));
  const isComparable =
    cellText !== '' &&
    needle !== '' &&
    Number.isFinite(cellNumber) &&
    Number.isFinite(needleNumber);

  switch (filter.operator) {
    case 'between': {
      const upperText = (filter.valueTo ?? '').trim().replace(/,/g, '');
      const upperNumber = Number(upperText);

      if (!isComparable || upperText === '' || !Number.isFinite(upperNumber)) {
        return false;
      }

      const lowerBound = Math.min(needleNumber, upperNumber);
      const upperBound = Math.max(needleNumber, upperNumber);

      return cellNumber >= lowerBound && cellNumber <= upperBound;
    }
    case 'greaterThan':
      return isComparable && cellNumber > needleNumber;
    case 'greaterThanOrEqual':
      return isComparable && cellNumber >= needleNumber;
    case 'lessThan':
      return isComparable && cellNumber < needleNumber;
    case 'lessThanOrEqual':
      return isComparable && cellNumber <= needleNumber;
    case 'contains':
      return haystack.includes(needle);
    case 'notContains':
      return !haystack.includes(needle);
    case 'equals':
      return isComparable ? cellNumber === needleNumber : haystack === needle;
    case 'empty':
      return cellText === '';
    case 'notEmpty':
      return cellText !== '';
    default:
      return true;
  }
};

export const filterOutreachRows = <TRow>(
  rows: TRow[],
  columns: Array<LayoutColumn<TRow>>,
  filters: OutreachColumnFilter[],
): TRow[] => {
  if (filters.length === 0) {
    return rows;
  }

  const columnsById = new Map(columns.map((column) => [column.id, column]));

  return rows.filter((row) =>
    filters.every((filter) => {
      const column = columnsById.get(filter.columnId);

      if (!column) {
        return true;
      }

      return matchesFilter(getOutreachCellText(column, row), filter);
    }),
  );
};
