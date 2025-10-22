import { SearchFilter, SortStrategy } from '@/arx-jd-upload/types/ParsedJD';

/**
 * Utility functions to migrate between nested and flattened SearchFilter structures
 */

/**
 * Migrates a SearchFilter from nested structure to flattened structure
 * @param searchFilter - The search filter to migrate
 * @returns The migrated search filter with flattened sort data
 */
export const migrateSearchFilterToFlattened = (searchFilter: SearchFilter): SearchFilter => {
  // If already flattened, return as is
  if (searchFilter.sortColumns && searchFilter.sortColumns.length > 0) {
    return searchFilter;
  }

  // Migrate from nested structure
  if (searchFilter.searchStrategy) {
    return {
      ...searchFilter,
      sortColumns: searchFilter.searchStrategy.sortColumns,
      sortStrategyName: searchFilter.searchStrategy.name,
      sortStrategyDescription: searchFilter.searchStrategy.description,
      sortStrategyReasoning: searchFilter.searchStrategy.reasoning,
    };
  }

  // Migrate from legacy columnSortConfigs
  if (searchFilter.columnSortConfigs) {
    return {
      ...searchFilter,
      sortColumns: searchFilter.columnSortConfigs.sortColumns,
      sortStrategyName: searchFilter.columnSortConfigs.name,
      sortStrategyDescription: searchFilter.columnSortConfigs.description,
      sortStrategyReasoning: searchFilter.columnSortConfigs.reasoning,
    };
  }

  return searchFilter;
};

/**
 * Migrates a SearchFilter from flattened structure back to nested structure
 * @param searchFilter - The search filter to migrate
 * @returns The migrated search filter with nested sort data
 */
export const migrateSearchFilterToNested = (searchFilter: SearchFilter): SearchFilter => {
  // If already nested, return as is
  if (searchFilter.searchStrategy) {
    return searchFilter;
  }

  // Migrate from flattened structure
  if (searchFilter.sortColumns && searchFilter.sortColumns.length > 0) {
    const sortStrategy: SortStrategy = {
      name: searchFilter.sortStrategyName || 'Generated Strategy',
      description: searchFilter.sortStrategyDescription || 'Generated sorting strategy',
      reasoning: searchFilter.sortStrategyReasoning || 'Generated reasoning',
      sortColumns: searchFilter.sortColumns,
    };

    return {
      ...searchFilter,
      searchStrategy: sortStrategy,
      columnSortConfigs: sortStrategy, // Also populate legacy field
    };
  }

  return searchFilter;
};

/**
 * Gets sort columns from a SearchFilter, regardless of structure
 * @param searchFilter - The search filter to extract sort columns from
 * @returns Array of sort columns or empty array
 */
export const getSortColumnsFromSearchFilter = (searchFilter: SearchFilter) => {
  // Check flattened structure first
  if (searchFilter.sortColumns && searchFilter.sortColumns.length > 0) {
    return searchFilter.sortColumns;
  }

  // Check nested structure
  if (searchFilter.searchStrategy?.sortColumns) {
    return searchFilter.searchStrategy.sortColumns;
  }

  // Check legacy structure
  if (searchFilter.columnSortConfigs?.sortColumns) {
    return searchFilter.columnSortConfigs.sortColumns;
  }

  return [];
};

/**
 * Gets sort strategy from a SearchFilter, regardless of structure
 * @param searchFilter - The search filter to extract sort strategy from
 * @returns SortStrategy object or null
 */
export const getSortStrategyFromSearchFilter = (searchFilter: SearchFilter): SortStrategy | null => {
  // Check flattened structure first
  if (searchFilter.sortColumns && searchFilter.sortColumns.length > 0) {
    return {
      name: searchFilter.sortStrategyName || 'Generated Strategy',
      description: searchFilter.sortStrategyDescription || 'Generated sorting strategy',
      reasoning: searchFilter.sortStrategyReasoning || 'Generated reasoning',
      sortColumns: searchFilter.sortColumns,
    };
  }

  // Check nested structure
  if (searchFilter.searchStrategy) {
    return searchFilter.searchStrategy;
  }

  // Check legacy structure
  if (searchFilter.columnSortConfigs) {
    return searchFilter.columnSortConfigs;
  }

  return null;
};

/**
 * Checks if a SearchFilter has sort data in any structure
 * @param searchFilter - The search filter to check
 * @returns True if sort data exists, false otherwise
 */
export const hasSortData = (searchFilter: SearchFilter): boolean => {
  return (
    (searchFilter.sortColumns && searchFilter.sortColumns.length > 0) ||
    (searchFilter.searchStrategy && searchFilter.searchStrategy.sortColumns && searchFilter.searchStrategy.sortColumns.length > 0) ||
    (searchFilter.columnSortConfigs && searchFilter.columnSortConfigs.sortColumns && searchFilter.columnSortConfigs.sortColumns.length > 0)
  );
};
