import { type RecordFilter } from '@/object-record/record-filter/types/RecordFilter';
import { type ChartFilters } from '@/side-panel/pages/page-layout/types/ChartFilters';
import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { RecordFilterGroupLogicalOperator, ViewFilterOperand } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

type OutreachDashboardScopeFieldRule = {
  fieldNames: string[];
  operand: ViewFilterOperand;
  relationSubFieldName?: string;
};

const OUTREACH_DASHBOARD_SCOPE_RULES: Record<string, OutreachDashboardScopeFieldRule> = {
  company: {
    fieldNames: ['projectIds', 'projectId'],
    operand: ViewFilterOperand.CONTAINS,
  },
  candidate: {
    fieldNames: ['projectsId', 'projects', 'projectId', 'project'],
    operand: ViewFilterOperand.IS,
  },
  opportunity: {
    fieldNames: ['projectId', 'projectIds'],
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
  workflowRun: {
    fieldNames: ['candidate'],
    operand: ViewFilterOperand.IS,
    relationSubFieldName: 'projectsId',
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
  relationSubFieldName,
}: {
  field: FieldMetadataItem;
  projectId: string;
  objectNameSingular: string;
  operand: ViewFilterOperand;
  relationSubFieldName?: string;
}): RecordFilter => ({
  id: `outreach-dashboard-scope:${objectNameSingular}:${projectId}`,
  fieldMetadataId: field.id,
  value: projectId,
  displayValue: projectId,
  type: field.type as RecordFilter['type'],
  operand,
  label: field.label,
  recordFilterGroupId: `outreach-dashboard-scope-group:${projectId}`,
  ...(isDefined(relationSubFieldName)
    ? { subFieldName: relationSubFieldName }
    : {}),
});

const buildVariantRecordFilter = ({
  field,
  variant,
}: {
  field: FieldMetadataItem;
  variant: 'A' | 'B';
}): RecordFilter => ({
  id: `outreach-dashboard-variant:${variant}`,
  fieldMetadataId: field.id,
  value: JSON.stringify([variant]),
  displayValue: variant,
  type: field.type as RecordFilter['type'],
  operand: ViewFilterOperand.IS,
  label: field.label,
  recordFilterGroupId: `outreach-dashboard-variant-group:${variant}`,
});

export const mergeOutreachDashboardScopeIntoChartFilters = ({
  chartFilters,
  objectMetadataItem,
  projectId,
  experimentVariant = 'ALL',
}: {
  chartFilters: ChartFilters;
  objectMetadataItem: EnrichedObjectMetadataItem;
  projectId: string | null;
  experimentVariant?: 'ALL' | 'A' | 'B';
}): ChartFilters => {
  let nextFilters = chartFilters.recordFilters ?? [];
  let nextGroups = chartFilters.recordFilterGroups ?? [];

  if (isDefined(projectId) && projectId.length > 0) {
    const scopeRule = OUTREACH_DASHBOARD_SCOPE_RULES[objectMetadataItem.nameSingular];

    if (isDefined(scopeRule)) {
      const scopeField = findScopeField(
        objectMetadataItem,
        scopeRule.fieldNames,
      );

      if (isDefined(scopeField)) {
        const scopeFilter = buildScopeRecordFilter({
          field: scopeField,
          projectId,
          objectNameSingular: objectMetadataItem.nameSingular,
          operand: scopeRule.operand,
          relationSubFieldName: scopeRule.relationSubFieldName,
        });

        if (!nextFilters.some((filter) => filter.id === scopeFilter.id)) {
          const scopeGroup = {
            id: scopeFilter.recordFilterGroupId!,
            logicalOperator: RecordFilterGroupLogicalOperator.AND,
          };

          nextFilters = [...nextFilters, scopeFilter];
          nextGroups = nextGroups.some((group) => group.id === scopeGroup.id)
            ? nextGroups
            : [...nextGroups, scopeGroup];
        }
      }
    }
  }

  if (
    (experimentVariant === 'A' || experimentVariant === 'B') &&
    objectMetadataItem.nameSingular === 'candidate'
  ) {
    const variantField = findScopeField(objectMetadataItem, [
      'experimentVariant',
    ]);

    if (isDefined(variantField)) {
      const variantFilter = buildVariantRecordFilter({
        field: variantField,
        variant: experimentVariant,
      });

      if (!nextFilters.some((filter) => filter.id === variantFilter.id)) {
        const variantGroup = {
          id: variantFilter.recordFilterGroupId!,
          logicalOperator: RecordFilterGroupLogicalOperator.AND,
        };

        nextFilters = [...nextFilters, variantFilter];
        nextGroups = nextGroups.some((group) => group.id === variantGroup.id)
          ? nextGroups
          : [...nextGroups, variantGroup];
      }
    }
  }

  return {
    recordFilters: nextFilters,
    recordFilterGroups: nextGroups,
  };
};
