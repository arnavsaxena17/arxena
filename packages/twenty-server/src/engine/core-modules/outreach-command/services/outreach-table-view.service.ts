import { Injectable } from '@nestjs/common';

import { isDefined } from 'twenty-shared/utils';

import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import {
  type OutreachTableViewColumnInfo,
  FilterDescriptionProcessorService,
} from 'src/engine/core-modules/candidate-sourcing/services/filter-description-processor.service';
import { OutreachCacheRealtimeService } from 'src/engine/core-modules/outreach-command/services/outreach-cache-realtime.service';
import {
  type OutreachWorkingSetRow,
  OutreachWorkingSetService,
} from 'src/engine/core-modules/outreach-command/services/outreach-working-set.service';
import {
  type OutreachTableFilter,
  type OutreachTableSort,
  type OutreachTableTab,
  type OutreachTableView,
} from 'src/engine/core-modules/outreach-command/utils/outreach-cache-realtime.constants';

export type OutreachTableColumn = OutreachTableViewColumnInfo;

export type OutreachGeneratedTableView = {
  needsFilter: boolean;
  needsSort: boolean;
  filters: OutreachTableFilter[];
  sort: OutreachTableSort | null;
  summary: string;
  matchCount: number;
  total: number;
  warnings: string[];
};

// 30 days; CacheStorageService takes milliseconds.
const VIEW_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_LISTED_VALUES = 12;

const AI_COLUMN_PREFIX = 'otherFields.';

const CORE_COLUMNS: Record<OutreachTableTab, OutreachTableColumn[]> = {
  people: [
    { columnId: 'name', label: 'Name', type: 'text' },
    { columnId: 'title', label: 'Job title', type: 'text' },
    { columnId: 'company', label: 'Company', type: 'text' },
    { columnId: 'location', label: 'Location', type: 'text' },
  ],
  companies: [
    { columnId: 'name', label: 'Name', type: 'text' },
    { columnId: 'domain', label: 'Domain', type: 'text' },
    { columnId: 'industry', label: 'Industry', type: 'text' },
    { columnId: 'employees', label: 'Employees', type: 'text' },
  ],
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// Text shown in the table cell for this column. Filters compare against it,
// exactly like the table does on the front end.
export const readCellText = (
  row: OutreachWorkingSetRow,
  columnId: string,
): string => {
  if (columnId.startsWith(AI_COLUMN_PREFIX)) {
    const value = row.otherFields[columnId.slice(AI_COLUMN_PREFIX.length)];

    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }

    return value === undefined || value === null ? '' : String(value);
  }

  switch (columnId) {
    case 'name':
      return row.name;
    case 'title':
      return row.title ?? '';
    case 'company':
      return row.companyName ?? '';
    case 'location':
      return row.locationName ?? '';
    case 'domain':
      return row.domain ?? '';
    case 'industry':
      return row.industry ?? '';
    case 'employees':
      return row.employees ?? '';
    default:
      return '';
  }
};

export const matchesTableFilter = (
  cellText: string,
  filter: OutreachTableFilter,
): boolean => {
  if (filter.kind === 'values') {
    return filter.values.includes(cellText);
  }

  const haystack = cellText.toLowerCase();
  const needle = filter.value.trim().toLowerCase();
  const cellNumber = Number(cellText);
  const needleNumber = Number(needle.replace(/,/g, ''));
  const isComparable =
    cellText !== '' &&
    needle !== '' &&
    Number.isFinite(cellNumber) &&
    Number.isFinite(needleNumber);

  switch (filter.operator) {
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

export const countMatchingRows = (
  rows: OutreachWorkingSetRow[],
  filters: OutreachTableFilter[],
): number =>
  rows.filter((row) =>
    filters.every((filter) =>
      matchesTableFilter(readCellText(row, filter.columnId), filter),
    ),
  ).length;

@Injectable()
export class OutreachTableViewService {
  constructor(
    @InjectCacheStorage(CacheStorageNamespace.EngineOutreachCommand)
    private readonly cache: CacheStorageService,
    private readonly outreachWorkingSetService: OutreachWorkingSetService,
    private readonly filterDescriptionProcessorService: FilterDescriptionProcessorService,
    private readonly outreachCacheRealtimeService: OutreachCacheRealtimeService,
  ) {}

  async get({
    workspaceId,
    projectId,
    tab,
  }: {
    workspaceId: string;
    projectId: string;
    tab: OutreachTableTab;
  }): Promise<OutreachTableView | null> {
    return (
      (await this.cache.get<OutreachTableView>(
        this.viewKey(workspaceId, projectId, tab),
      )) ?? null
    );
  }

  // Columns the table really has right now: the core ones plus every AI
  // column found on the rows, with the values a filter can pick from.
  async listColumns({
    workspaceId,
    projectId,
    tab,
  }: {
    workspaceId: string;
    projectId: string;
    tab: OutreachTableTab;
  }): Promise<{ columns: OutreachTableColumn[]; rows: OutreachWorkingSetRow[] }> {
    const rows = await this.outreachWorkingSetService.getAll({
      workspaceId,
      projectId,
      subject: tab === 'people' ? 'person' : 'company',
    });
    const aiColumns = new Map<
      string,
      { label: string; type: string; enumValues?: string[] }
    >();

    for (const row of rows) {
      const meta = row.otherFields.aiColumns;

      if (!isRecord(meta)) {
        continue;
      }

      for (const [key, entry] of Object.entries(meta)) {
        if (aiColumns.has(key) || !isRecord(entry)) {
          continue;
        }

        aiColumns.set(key, {
          label: typeof entry.label === 'string' ? entry.label : key,
          type: typeof entry.type === 'string' ? entry.type : 'text',
          enumValues: Array.isArray(entry.enumValues)
            ? entry.enumValues.filter(
                (value): value is string => typeof value === 'string',
              )
            : undefined,
        });
      }
    }

    const aiColumnList: OutreachTableColumn[] = [...aiColumns.entries()].map(
      ([key, meta]) => {
        const columnId = `${AI_COLUMN_PREFIX}${key}`;
        const distinct = [
          ...new Set(
            rows.map((row) => readCellText(row, columnId)).filter(Boolean),
          ),
        ];
        const isNumeric = ['number', 'integer'].includes(meta.type);

        return {
          columnId,
          label: meta.label,
          type: meta.type === 'integer' ? 'integer' : meta.type,
          ...(isNumeric
            ? {}
            : {
                values:
                  meta.type === 'boolean'
                    ? ['Yes', 'No']
                    : distinct.slice(0, MAX_LISTED_VALUES),
              }),
        };
      },
    );

    return { columns: [...CORE_COLUMNS[tab], ...aiColumnList], rows };
  }

  // Proposes filters and a sort from the user's words. Nothing is applied.
  async generate({
    workspaceId,
    projectId,
    tab,
    description,
  }: {
    workspaceId: string;
    projectId: string;
    tab: OutreachTableTab;
    description: string;
  }): Promise<OutreachGeneratedTableView> {
    const { columns, rows } = await this.listColumns({
      workspaceId,
      projectId,
      tab,
    });
    const design = await this.filterDescriptionProcessorService.designTableView({
      description,
      columns,
      workspaceId,
    });
    const warnings: string[] =
      design.unmatched.trim() === ''
        ? []
        : [`Not possible: ${design.unmatched.trim()}.`];
    const filters = design.needsFilter
      ? design.filters.flatMap((filter) => {
          const column = columns.find(
            (candidate) => candidate.columnId === filter.columnId,
          );

          if (!isDefined(column)) {
            warnings.push(`Unknown column "${filter.columnId}" was skipped.`);

            return [];
          }

          return [this.toTableFilter(column, filter)];
        })
      : [];
    const sortColumn = columns.find(
      (column) => column.columnId === design.sortColumnId,
    );

    if (design.needsSort && design.sortColumnId !== '' && !isDefined(sortColumn)) {
      warnings.push(`Unknown sort column "${design.sortColumnId}" was skipped.`);
    }

    const sort =
      design.needsSort && isDefined(sortColumn)
        ? { columnId: sortColumn.columnId, direction: design.sortDirection }
        : null;

    return {
      needsFilter: filters.length > 0,
      needsSort: sort !== null,
      filters,
      sort,
      summary: design.summary,
      matchCount: countMatchingRows(rows, filters),
      total: rows.length,
      warnings,
    };
  }

  // Stores the view for the project and tells every open page to show it.
  async apply({
    workspaceId,
    projectId,
    tab,
    filters,
    sort,
    summary,
  }: {
    workspaceId: string;
    projectId: string;
    tab: OutreachTableTab;
    filters: OutreachTableFilter[];
    sort: OutreachTableSort | null;
    summary?: string;
  }): Promise<{
    view: OutreachTableView;
    matchCount: number;
    total: number;
    warnings: string[];
  }> {
    const { columns, rows } = await this.listColumns({
      workspaceId,
      projectId,
      tab,
    });
    const known = new Set(columns.map((column) => column.columnId));
    const warnings: string[] = [];
    const validFilters = filters.filter((filter) => {
      const isKnown = known.has(filter.columnId);

      if (!isKnown) {
        warnings.push(`Unknown column "${filter.columnId}" was skipped.`);
      }

      return isKnown;
    });
    const validSort =
      sort !== null && known.has(sort.columnId) ? sort : null;

    if (sort !== null && validSort === null) {
      warnings.push(`Unknown sort column "${sort.columnId}" was skipped.`);
    }

    const view: OutreachTableView = {
      tab,
      filters: validFilters,
      sort: validSort,
      summary:
        summary ??
        (validFilters.length === 0 && validSort === null
          ? 'Filters and sort cleared'
          : 'AI view applied'),
      updatedAt: new Date().toISOString(),
    };

    await this.cache.set(
      this.viewKey(workspaceId, projectId, tab),
      view,
      VIEW_TTL_MS,
    );
    this.outreachCacheRealtimeService.notifyTableViewUpdated(projectId, view);

    return {
      view,
      matchCount: countMatchingRows(rows, validFilters),
      total: rows.length,
      warnings,
    };
  }

  private toTableFilter(
    column: OutreachTableColumn,
    filter: {
      columnId: string;
      operator: string;
      values: string[];
    },
  ): OutreachTableFilter {
    const first = (filter.values[0] ?? '').trim();
    const isNumeric = ['number', 'integer'].includes(column.type);

    if (filter.operator === 'in') {
      return {
        columnId: column.columnId,
        kind: 'values',
        values: filter.values.map((value) =>
          column.type === 'boolean'
            ? /^(true|yes|y|1)$/i.test(value.trim())
              ? 'Yes'
              : 'No'
            : value,
        ),
      };
    }

    switch (filter.operator) {
      case 'isEmpty':
        return {
          columnId: column.columnId,
          kind: 'condition',
          operator: 'empty',
          value: '',
        };
      case 'isNotEmpty':
        return {
          columnId: column.columnId,
          kind: 'condition',
          operator: 'notEmpty',
          value: '',
        };
      default:
        return {
          columnId: column.columnId,
          kind: 'condition',
          operator: filter.operator as Extract<
            OutreachTableFilter,
            { kind: 'condition' }
          >['operator'],
          value: isNumeric ? first.replace(/,/g, '') : first,
        };
    }
  }

  private viewKey(
    workspaceId: string,
    projectId: string,
    tab: OutreachTableTab,
  ): string {
    return `outreach-table-view:${workspaceId}:${projectId}:${tab}`;
  }
}
