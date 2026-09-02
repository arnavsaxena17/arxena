import { FieldMetadataType, ObjectRecordGroupByDateGranularity } from 'twenty-shared/types';

import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { buildGroupByFieldObject } from '@/page-layout/widgets/graph/utils/buildGroupByFieldObject';

const createRawJsonField = (): FieldMetadataItem =>
  ({
    id: 'raw-json-field-id',
    name: 'outreachSpeedTimestamps',
    label: 'Outreach Speed Timestamps',
    type: FieldMetadataType.RAW_JSON,
    isSystem: false,
  }) as FieldMetadataItem;

describe('buildGroupByFieldObject RAW_JSON', () => {
  it('should build scalar JSON path group by', () => {
    expect(
      buildGroupByFieldObject({
        field: createRawJsonField(),
        subFieldName: 'timeToFirstContactBucket',
      }),
    ).toEqual({
      outreachSpeedTimestamps: {
        timeToFirstContactBucket: true,
      },
    });
  });

  it('should build date JSON path group by with granularity', () => {
    expect(
      buildGroupByFieldObject({
        field: createRawJsonField(),
        subFieldName: 'firstContactAt',
        dateGranularity: ObjectRecordGroupByDateGranularity.WEEK,
        timeZone: 'UTC',
        firstDayOfTheWeek: 1,
      }),
    ).toEqual({
      outreachSpeedTimestamps: {
        firstContactAt: {
          granularity: ObjectRecordGroupByDateGranularity.WEEK,
          timeZone: 'UTC',
          weekStartDay: 'MONDAY',
        },
      },
    });
  });

  it('should throw when RAW_JSON subfield is missing', () => {
    expect(() =>
      buildGroupByFieldObject({
        field: createRawJsonField(),
      }),
    ).toThrow('RAW_JSON field outreachSpeedTimestamps requires a subfield');
  });
});
