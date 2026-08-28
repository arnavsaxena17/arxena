import { type RecordFilter } from '@/object-record/record-filter/types/RecordFilter';
import { type ChartFilters } from '@/side-panel/pages/page-layout/types/ChartFilters';
import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { RecordFilterGroupLogicalOperator, ViewFilterOperand } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

type GtmDashboardScopeFieldRule = {
  fieldNames: string[];
  operand: ViewFilterOperand;
};

const GTM_DASHBOARD_SCOPE_RULES: Record<string, GtmDashboardScopeFieldRule> = {
  company: {
    fieldNames: ['gtmRunKey'],
    operand: ViewFilterOperand.CONTAINS,
  },
  candidate: {
    fieldNames: ['projectsId', 'projects', 'projectId', 'project'],
    operand: ViewFilterOperand.IS,
  },
  opportunity: {
    fieldNames: ['gtmRunKey'],
    operand: ViewFilterOperand.IS,
  },
  chatMessage: {
    fieldNames: ['projectsId', 'projects', 'projectId', 'project'],
    operand: ViewFilterOperand.IS,
  },
  whatsappMessage: {
    fieldNames: ['projectsId', 'projects', 'projectId', 'project'],
    operand: ViewFilterOperand.IS,
  },
};

const findScopeField = (
  objectMetadataItem: EnrichedObjectMetadataItem,
  fieldNames: string[],
): FieldMetadataItem | undefined => {
  for (const fieldName of fieldNames) {
    const field = objectMetadataItem.fields.find(
      (candidate) => candidate.isActive && candidate.name === fieldName,
    );

    if (isDefined(field)) {
      return field;
    }
  }

  return undefined;
};

const buildScopeRecordFilter = ({
  field,
  projectId,
  objectNameSingular,
  operand,
}: {
  field: FieldMetadataItem;
  projectId: string;
  objectNameSingular: string;
  operand: ViewFilterOperand;
}): RecordFilter => ({
  id: `gtm-dashboard-scope:${objectNameSingular}:${projectId}`,
  fieldMetadataId: field.id,
  value: projectId,
  displayValue: projectId,
  type: field.type as RecordFilter['type'],
  operand,
  label: field.label,
  recordFilterGroupId: `gtm-dashboard-scope-group:${projectId}`,
});

export const mergeGtmDashboardScopeIntoChartFilters = ({
  chartFilters,
  objectMetadataItem,
  projectId,
}: {
  chartFilters: ChartFilters;
  objectMetadataItem: EnrichedObjectMetadataItem;
  projectId: string;
}): ChartFilters => {
  const scopeRule = GTM_DASHBOARD_SCOPE_RULES[objectMetadataItem.nameSingular];

  if (!isDefined(scopeRule)) {
    return chartFilters;
  }

  const scopeField = findScopeField(objectMetadataItem, scopeRule.fieldNames);

  if (!isDefined(scopeField)) {
    return chartFilters;
  }

  const scopeFilter = buildScopeRecordFilter({
    field: scopeField,
    projectId,
    objectNameSingular: objectMetadataItem.nameSingular,
    operand: scopeRule.operand,
  });

  const existingFilters = chartFilters.recordFilters ?? [];
  const existingGroups = chartFilters.recordFilterGroups ?? [];

  const hasScopeFilter = existingFilters.some(
    (filter) => filter.id === scopeFilter.id,
  );

  if (hasScopeFilter) {
    return chartFilters;
  }

  const scopeGroup = {
    id: scopeFilter.recordFilterGroupId!,
    logicalOperator: RecordFilterGroupLogicalOperator.AND,
  };

  const hasScopeGroup = existingGroups.some((group) => group.id === scopeGroup.id);

  return {
    recordFilters: [...existingFilters, scopeFilter],
    recordFilterGroups: hasScopeGroup
      ? existingGroups
      : [...existingGroups, scopeGroup],
  };
};
