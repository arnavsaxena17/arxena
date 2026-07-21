import { IconSort } from 'twenty-ui';
import { ObjectMetadataItem } from '@/object-metadata/types/ObjectMetadataItem';
import { RecordGqlOperationFilter } from '@/object-record/graphql/types/RecordGqlOperationFilter';
import { computeViewRecordGqlOperationFilter } from '@/object-record/record-filter/utils/computeViewRecordGqlOperationFilter';
import { RecordFilterValueDependencies } from '@/object-record/record-filter/types/RecordFilterValueDependencies';
import { RecordFilter } from '@/object-record/record-filter/types/RecordFilter';
import { RecordFilterGroup } from '@/object-record/record-filter-group/types/RecordFilterGroup';
import { RecordSort } from '@/object-record/record-sort/types/RecordSort';
import { RecordSortDirection } from '@/object-record/record-sort/types/RecordSortDirection';
import { turnSortsIntoOrderBy } from '@/object-record/object-sort-dropdown/utils/turnSortsIntoOrderBy';
import { ViewFilterGroup } from '@/views/types/ViewFilterGroup';
import { ViewFilterGroupLogicalOperator } from '@/views/types/ViewFilterGroupLogicalOperator';
import { getFilterTypeFromFieldType } from '@/object-metadata/utils/formatFieldMetadataItemsAsFilterDefinitions';
import { ViewFilterOperand } from '@/views/types/ViewFilterOperand';
import { v4 } from 'uuid';
import { isDefined } from 'twenty-shared';
import { JsonValue } from 'type-fest';

export type WorkflowFindRecordsFilter = {
  recordFilters?: RecordFilter[];
  recordFilterGroups?: RecordFilterGroup[];
  gqlOperationFilter?: Record<string, unknown>;
};

export type WorkflowFindRecordsRecordSort = {
  id: string;
  fieldMetadataId: string;
  direction: RecordSortDirection;
};

export type WorkflowFindRecordsOrderBy = {
  recordSorts?: WorkflowFindRecordsRecordSort[];
  gqlOperationOrderBy?: JsonValue;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isLegacySimpleFilter = (
  filter?: Record<string, unknown>,
): filter is Record<string, unknown> =>
  isRecord(filter) &&
  !('recordFilters' in filter) &&
  !('recordFilterGroups' in filter) &&
  Object.keys(filter).length > 0;

const mapRecordFilterGroupToViewFilterGroup = (
  recordFilterGroup: RecordFilterGroup,
): ViewFilterGroup => ({
  __typename: 'ViewFilterGroup',
  id: recordFilterGroup.id,
  viewId: '',
  parentViewFilterGroupId: recordFilterGroup.parentRecordFilterGroupId,
  logicalOperator: recordFilterGroup.logicalOperator,
  positionInViewFilterGroup: recordFilterGroup.positionInRecordFilterGroup,
});

const mapRecordFilterToViewFilter = (recordFilter: RecordFilter): RecordFilter => ({
  ...recordFilter,
  viewFilterGroupId: recordFilter.recordFilterGroupId,
  positionInViewFilterGroup: recordFilter.positionInRecordFilterGroup,
});

const LEGACY_OPERAND_TO_VIEW_OPERAND: Record<string, ViewFilterOperand> = {
  eq: ViewFilterOperand.Is,
  neq: ViewFilterOperand.IsNot,
  gt: ViewFilterOperand.GreaterThan,
  gte: ViewFilterOperand.GreaterThan,
  lt: ViewFilterOperand.LessThan,
  lte: ViewFilterOperand.LessThan,
  like: ViewFilterOperand.Contains,
  ilike: ViewFilterOperand.Contains,
  startsWith: ViewFilterOperand.Contains,
  is: ViewFilterOperand.IsEmpty,
  in: ViewFilterOperand.Is,
};

const mapLegacyOperandToViewOperand = (
  operand: string,
  filterType: ReturnType<typeof getFilterTypeFromFieldType>,
): ViewFilterOperand => {
  if (operand in LEGACY_OPERAND_TO_VIEW_OPERAND) {
    return LEGACY_OPERAND_TO_VIEW_OPERAND[operand];
  }

  return operand as ViewFilterOperand;
};

export const convertLegacySimpleFilterToWorkflowFindRecordsFilter = (
  filter: Record<string, unknown>,
  objectMetadataItem: ObjectMetadataItem,
): WorkflowFindRecordsFilter => {
  const rootGroupId = v4();
  const recordFilterGroups: RecordFilterGroup[] = [
    {
      id: rootGroupId,
      logicalOperator: ViewFilterGroupLogicalOperator.AND,
    },
  ];

  const recordFilters: RecordFilter[] = Object.entries(filter).flatMap(
    ([fieldName, fieldFilter]) => {
      if (!isRecord(fieldFilter)) {
        return [];
      }

      const fieldMetadataItem = objectMetadataItem.fields.find(
        (field) => field.name === fieldName,
      );

      if (!isDefined(fieldMetadataItem)) {
        return [];
      }

      return Object.entries(fieldFilter).map(([operand, value]) => {
        const filterType = getFilterTypeFromFieldType(fieldMetadataItem.type);

        return {
          id: v4(),
          fieldMetadataId: fieldMetadataItem.id,
          type: filterType,
          operand: mapLegacyOperandToViewOperand(operand, filterType),
          value:
            operand === 'is'
              ? value === 'NULL'
                ? 'NULL'
                : 'NOT NULL'
              : typeof value === 'string'
                ? value
                : JSON.stringify(value),
          displayValue: '',
          label: fieldMetadataItem.label,
          recordFilterGroupId: rootGroupId,
          positionInRecordFilterGroup: 0,
        };
      });
    },
  );

  return {
    recordFilters,
    recordFilterGroups,
  };
};

export const ensureRecordFilterGroupsForFilters = ({
  recordFilters,
  recordFilterGroups,
}: {
  recordFilters: RecordFilter[];
  recordFilterGroups: RecordFilterGroup[];
}): {
  recordFilters: RecordFilter[];
  recordFilterGroups: RecordFilterGroup[];
} => {
  if (recordFilterGroups.length > 0) {
    return { recordFilters, recordFilterGroups };
  }

  if (recordFilters.length === 0) {
    return { recordFilters, recordFilterGroups };
  }

  const rootGroupIdFromFilters = recordFilters.find((recordFilter) =>
    isDefined(recordFilter.recordFilterGroupId),
  )?.recordFilterGroupId;

  const rootGroupId = rootGroupIdFromFilters ?? v4();

  return {
    recordFilters: recordFilters.map((recordFilter) => ({
      ...recordFilter,
      recordFilterGroupId: recordFilter.recordFilterGroupId ?? rootGroupId,
    })),
    recordFilterGroups: [
      {
        id: rootGroupId,
        logicalOperator: ViewFilterGroupLogicalOperator.AND,
      },
    ],
  };
};

export const parseWorkflowFindRecordsFilter = (
  filter?: Record<string, unknown>,
  objectMetadataItem?: ObjectMetadataItem,
): WorkflowFindRecordsFilter | undefined => {
  if (!isDefined(filter) || Object.keys(filter).length === 0) {
    return undefined;
  }

  if ('recordFilters' in filter || 'recordFilterGroups' in filter) {
    const { recordFilters, recordFilterGroups } =
      ensureRecordFilterGroupsForFilters({
        recordFilters: (filter.recordFilters as RecordFilter[]) ?? [],
        recordFilterGroups:
          (filter.recordFilterGroups as RecordFilterGroup[]) ?? [],
      });

    return {
      recordFilters,
      recordFilterGroups,
      gqlOperationFilter: filter.gqlOperationFilter as
        | Record<string, unknown>
        | undefined,
    };
  }

  if (isLegacySimpleFilter(filter) && isDefined(objectMetadataItem)) {
    return convertLegacySimpleFilterToWorkflowFindRecordsFilter(
      filter,
      objectMetadataItem,
    );
  }

  return undefined;
};

const VIEW_OPERAND_TO_GQL_OPERAND: Partial<Record<ViewFilterOperand, string>> = {
  [ViewFilterOperand.Is]: 'eq',
  [ViewFilterOperand.IsNot]: 'neq',
  [ViewFilterOperand.GreaterThan]: 'gt',
  [ViewFilterOperand.LessThan]: 'lt',
  [ViewFilterOperand.Contains]: 'ilike',
  [ViewFilterOperand.DoesNotContain]: 'neq',
  [ViewFilterOperand.IsEmpty]: 'is',
  [ViewFilterOperand.IsNotEmpty]: 'is',
};

export const buildSimpleGqlFilterFromRecordFilters = (
  recordFilters: RecordFilter[],
  objectMetadataItem: ObjectMetadataItem,
): RecordGqlOperationFilter => {
  return recordFilters.reduce<RecordGqlOperationFilter>((filter, recordFilter) => {
    const field = objectMetadataItem.fields.find(
      (fieldMetadataItem) =>
        fieldMetadataItem.id === recordFilter.fieldMetadataId,
    );

    if (!isDefined(field)) {
      return filter;
    }

    const gqlOperand =
      VIEW_OPERAND_TO_GQL_OPERAND[recordFilter.operand] ?? recordFilter.operand;

    let gqlValue: unknown = recordFilter.value;

    if (recordFilter.operand === ViewFilterOperand.IsEmpty) {
      gqlValue = 'NULL';
    }

    if (recordFilter.operand === ViewFilterOperand.IsNotEmpty) {
      gqlValue = 'NOT NULL';
    }

    if (recordFilter.operand === ViewFilterOperand.Contains) {
      gqlValue = `%${recordFilter.value}%`;
    }

    const existingFieldFilter = isRecord(filter[field.name])
      ? { ...filter[field.name] }
      : {};

    return {
      ...filter,
      [field.name]: {
        ...existingFieldFilter,
        [gqlOperand]: gqlValue,
      },
    };
  }, {});
};

export const computeWorkflowFindRecordsGqlOperationFilter = ({
  filterValueDependencies,
  filter,
  objectMetadataItem,
}: {
  filterValueDependencies: RecordFilterValueDependencies;
  filter?: WorkflowFindRecordsFilter;
  objectMetadataItem: ObjectMetadataItem;
}): RecordGqlOperationFilter => {
  if (!isDefined(filter?.recordFilters) || filter.recordFilters.length === 0) {
    return {};
  }

  try {
    const viewFilters = filter.recordFilters.map(mapRecordFilterToViewFilter);
    const viewFilterGroups = (filter.recordFilterGroups ?? []).map(
      mapRecordFilterGroupToViewFilterGroup,
    );

    return computeViewRecordGqlOperationFilter(
      filterValueDependencies,
      viewFilters,
      objectMetadataItem.fields,
      viewFilterGroups,
    );
  } catch {
    return buildSimpleGqlFilterFromRecordFilters(
      filter.recordFilters,
      objectMetadataItem,
    );
  }
};

export const serializeWorkflowFindRecordsFilter = ({
  filter,
  filterValueDependencies,
  objectMetadataItem,
}: {
  filter?: WorkflowFindRecordsFilter;
  filterValueDependencies: RecordFilterValueDependencies;
  objectMetadataItem: ObjectMetadataItem;
}): Record<string, unknown> | undefined => {
  if (
    !isDefined(filter?.recordFilters) ||
    filter.recordFilters.length === 0
  ) {
    return undefined;
  }

  const gqlOperationFilter = computeWorkflowFindRecordsGqlOperationFilter({
    filterValueDependencies,
    filter,
    objectMetadataItem,
  });

  return {
    recordFilters: filter.recordFilters,
    recordFilterGroups: filter.recordFilterGroups ?? [],
    gqlOperationFilter,
  };
};

export const toWorkflowRecordSorts = (
  recordSorts: WorkflowFindRecordsRecordSort[],
  objectMetadataItem: ObjectMetadataItem,
): RecordSort[] =>
  recordSorts.map((sort) => {
    const field = objectMetadataItem.fields.find(
      (fieldMetadataItem) => fieldMetadataItem.id === sort.fieldMetadataId,
    );

    return {
      id: sort.id,
      fieldMetadataId: sort.fieldMetadataId,
      direction: sort.direction,
      definition: {
        fieldMetadataId: sort.fieldMetadataId,
        label: field?.label ?? '',
        iconName: field?.icon ?? 'IconSort',
      },
    };
  });

export const serializeWorkflowFindRecordsOrderBy = ({
  recordSorts,
  objectMetadataItem,
}: {
  recordSorts: WorkflowFindRecordsRecordSort[];
  objectMetadataItem: ObjectMetadataItem;
}): WorkflowFindRecordsOrderBy | undefined => {
  if (recordSorts.length === 0) {
    return undefined;
  }

  const gqlOperationOrderBy = turnSortsIntoOrderBy(
    objectMetadataItem,
    toWorkflowRecordSorts(recordSorts, objectMetadataItem),
  );

  return {
    recordSorts,
    gqlOperationOrderBy,
  };
};

export const parseWorkflowFindRecordsOrderBy = (
  orderBy?: Record<string, unknown>,
): WorkflowFindRecordsRecordSort[] => {
  if (!isRecord(orderBy)) {
    return [];
  }

  if (Array.isArray(orderBy.recordSorts)) {
    return orderBy.recordSorts as WorkflowFindRecordsRecordSort[];
  }

  return [];
};
