import { mergeOutreachDashboardScopeIntoChartFilters } from '@/outreach-dashboard/utils/mergeOutreachDashboardScopeIntoChartFilters';
import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import { ViewFilterOperand } from 'twenty-shared/types';
import { FieldMetadataType } from 'twenty-shared/types';

const buildObjectMetadataItem = (
  nameSingular: string,
  fields: EnrichedObjectMetadataItem['fields'],
): EnrichedObjectMetadataItem =>
  ({
    nameSingular,
    fields,
  }) as EnrichedObjectMetadataItem;

describe('mergeOutreachDashboardScopeIntoChartFilters', () => {
  it('adds projectId contains filter for companies', () => {
    const objectMetadataItem = buildObjectMetadataItem('company', [
      {
        id: 'project-ids-field',
        name: 'projectId',
        label: 'GTM Project Key',
        type: FieldMetadataType.ARRAY,
        isActive: true,
      },
    ] as EnrichedObjectMetadataItem['fields']);

    const merged = mergeOutreachDashboardScopeIntoChartFilters({
      chartFilters: {},
      objectMetadataItem,
      projectId: 'project-1',
    });

    expect(merged.recordFilters).toHaveLength(1);
    expect(merged.recordFilters?.[0]).toMatchObject({
      fieldMetadataId: 'project-ids-field',
      operand: ViewFilterOperand.CONTAINS,
      value: 'project-1',
    });
  });

  it('adds projectsId filter for candidates', () => {
    const objectMetadataItem = buildObjectMetadataItem('candidate', [
      {
        id: 'projects-id-field',
        name: 'projectsId',
        label: 'Project',
        type: FieldMetadataType.RELATION,
        isActive: true,
      },
    ] as EnrichedObjectMetadataItem['fields']);

    const merged = mergeOutreachDashboardScopeIntoChartFilters({
      chartFilters: {},
      objectMetadataItem,
      projectId: 'project-1',
    });

    expect(merged.recordFilters?.[0]).toMatchObject({
      fieldMetadataId: 'projects-id-field',
      operand: ViewFilterOperand.IS,
      value: 'project-1',
    });
  });

  it('returns chart filters unchanged for unsupported objects', () => {
    const chartFilters = {
      recordFilters: [
        {
          id: 'existing-filter',
          fieldMetadataId: 'field-1',
          value: 'foo',
          displayValue: 'foo',
          type: FieldMetadataType.TEXT,
          operand: ViewFilterOperand.IS,
          label: 'Foo',
        },
      ],
    };

    const objectMetadataItem = buildObjectMetadataItem('task', []);

    expect(
      mergeOutreachDashboardScopeIntoChartFilters({
        chartFilters,
        objectMetadataItem,
        projectId: 'project-1',
      }),
    ).toEqual(chartFilters);
  });
});
