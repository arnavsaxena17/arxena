import { type FilterCondition } from '@/candidate-table/states/states';
import { isDefined } from 'twenty-shared/utils';

export type PersistedFilterCondition = {
  columnData: string;
  conditions: FilterCondition['conditions'];
  operation: string;
};

const getTableFiltersStorageKey = (projectId: string) =>
  `candidate-table-filters:${projectId}`;

export const isBackendBackedDataTableProjectId = (
  projectId: string | undefined,
): projectId is string => {
  if (!projectId || projectId === 'project-id' || projectId === '__search__') {
    return false;
  }

  // Outreach People embeds DataTable with a synthetic projectId for context-store
  // scoping; it is not a CRM Project and must not hit candidate-sourcing APIs.
  if (
    projectId.startsWith('gtm-people-') ||
    projectId.startsWith('outreach-people-')
  ) {
    return false;
  }

  return true;
};

export const clearPersistedTableFilters = (projectId: string) => {
  if (!isBackendBackedDataTableProjectId(projectId)) {
    return;
  }

  try {
    localStorage.removeItem(getTableFiltersStorageKey(projectId));
  } catch {
    // Ignore localStorage errors (private mode / quota)
  }
};

export const savePersistedTableFilters = (
  projectId: string,
  filters: FilterCondition[],
  columns: Array<{ data?: string | number } | undefined> | undefined,
) => {
  if (!isBackendBackedDataTableProjectId(projectId)) {
    return;
  }

  if (!filters.length) {
    clearPersistedTableFilters(projectId);
    return;
  }

  const persistedFilters = filters
    .map((filter) => {
      const columnData = columns?.[filter.column]?.data;

      if (!isDefined(columnData) || columnData === '') {
        return null;
      }

      return {
        columnData: String(columnData),
        conditions: filter.conditions,
        operation: filter.operation || 'conjunction',
      } satisfies PersistedFilterCondition;
    })
    .filter(isDefined);

  try {
    if (persistedFilters.length === 0) {
      clearPersistedTableFilters(projectId);
      return;
    }

    localStorage.setItem(
      getTableFiltersStorageKey(projectId),
      JSON.stringify(persistedFilters),
    );
  } catch {
    // Ignore localStorage errors (private mode / quota)
  }
};

export const loadPersistedTableFilters = (
  projectId: string,
): PersistedFilterCondition[] => {
  if (!isBackendBackedDataTableProjectId(projectId)) {
    return [];
  }

  try {
    const rawValue = localStorage.getItem(getTableFiltersStorageKey(projectId));

    if (!rawValue) {
      return [];
    }

    const parsedValue = JSON.parse(rawValue);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.filter(
      (filter): filter is PersistedFilterCondition =>
        isDefined(filter) &&
        typeof filter.columnData === 'string' &&
        Array.isArray(filter.conditions),
    );
  } catch {
    return [];
  }
};

export const mapPersistedFiltersToColumnIndexes = (
  persistedFilters: PersistedFilterCondition[],
  columns: Array<{ data?: string | number } | undefined> | undefined,
): FilterCondition[] => {
  if (!columns?.length) {
    return [];
  }

  return persistedFilters
    .map((filter) => {
      const columnIndex = columns.findIndex(
        (column) => String(column?.data) === filter.columnData,
      );

      if (columnIndex < 0) {
        return null;
      }

      return {
        column: columnIndex,
        conditions: filter.conditions,
        operation: filter.operation || 'conjunction',
      } satisfies FilterCondition;
    })
    .filter(isDefined);
};
