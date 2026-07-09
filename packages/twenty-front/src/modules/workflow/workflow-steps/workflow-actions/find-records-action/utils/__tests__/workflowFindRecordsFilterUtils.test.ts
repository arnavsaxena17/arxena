import {
  convertLegacySimpleFilterToWorkflowFindRecordsFilter,
  parseWorkflowFindRecordsFilter,
  serializeWorkflowFindRecordsFilter,
  computeWorkflowFindRecordsGqlOperationFilter,
} from '@/workflow/workflow-steps/workflow-actions/find-records-action/utils/workflowFindRecordsFilterUtils';
import { RecordFilterValueDependencies } from '@/object-record/record-filter/types/RecordFilterValueDependencies';
import { ViewFilterOperand } from '@/views/types/ViewFilterOperand';
import { generatedMockObjectMetadataItems } from '~/testing/mock-data/generatedMockObjectMetadataItems';

const companyMockObjectMetadataItem = generatedMockObjectMetadataItems.find(
  (item) => item.nameSingular === 'company',
)!;

const mockFilterValueDependencies: RecordFilterValueDependencies = {
  currentWorkspaceMemberId: '32219445-f587-4c40-b2b1-6d3205ed96da',
};

describe('workflowFindRecordsFilterUtils', () => {
  it('parses a legacy simple eq filter into record filters', () => {
    const filter = parseWorkflowFindRecordsFilter(
      {
        id: {
          eq: '{{trigger.recordId}}',
        },
      },
      companyMockObjectMetadataItem,
    );

    expect(filter?.recordFilters).toHaveLength(1);
    expect(filter?.recordFilters?.[0]).toMatchObject({
      operand: ViewFilterOperand.Is,
      value: '{{trigger.recordId}}',
    });
    expect(filter?.recordFilterGroups).toHaveLength(1);
  });

  it('serializes record filters with gqlOperationFilter for backward compat', () => {
    const legacyFilter = {
      id: {
        eq: '{{trigger.recordId}}',
      },
    };

    const parsed = convertLegacySimpleFilterToWorkflowFindRecordsFilter(
      legacyFilter,
      companyMockObjectMetadataItem,
    );

    const serialized = serializeWorkflowFindRecordsFilter({
      filter: parsed,
      filterValueDependencies: mockFilterValueDependencies,
      objectMetadataItem: companyMockObjectMetadataItem,
    });

    expect(serialized?.recordFilters).toHaveLength(1);
    expect(serialized?.recordFilterGroups).toHaveLength(1);
    expect(serialized?.gqlOperationFilter).toBeDefined();
  });

  it('computes gql filter from record filters', () => {
    const parsed = convertLegacySimpleFilterToWorkflowFindRecordsFilter(
      {
        id: {
          eq: '{{trigger.recordId}}',
        },
      },
      companyMockObjectMetadataItem,
    );

    const gqlFilter = computeWorkflowFindRecordsGqlOperationFilter({
      filterValueDependencies: mockFilterValueDependencies,
      filter: parsed,
      objectMetadataItem: companyMockObjectMetadataItem,
    });

    expect(gqlFilter).toBeDefined();
  });

  it('round-trips legacy filter through parse and gql serialization', () => {
    const originalFilter = {
      id: {
        eq: '{{trigger.recordId}}',
      },
    };

    const parsed = parseWorkflowFindRecordsFilter(
      originalFilter,
      companyMockObjectMetadataItem,
    );

    const serialized = serializeWorkflowFindRecordsFilter({
      filter: parsed,
      filterValueDependencies: mockFilterValueDependencies,
      objectMetadataItem: companyMockObjectMetadataItem,
    });

    expect(serialized?.gqlOperationFilter).toEqual({
      id: { eq: '{{trigger.recordId}}' },
    });
  });
});
