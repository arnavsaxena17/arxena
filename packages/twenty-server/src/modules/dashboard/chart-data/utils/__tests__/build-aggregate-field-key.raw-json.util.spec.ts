import { AggregateOperations, FieldMetadataType } from 'twenty-shared/types';

import { buildAggregateFieldKey } from 'src/modules/dashboard/chart-data/utils/build-aggregate-field-key.util';
import { type FlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';

describe('buildAggregateFieldKey RAW_JSON', () => {
  const rawJsonField = {
    name: 'outreachSpeedTimestamps',
    type: FieldMetadataType.RAW_JSON,
  } as FlatFieldMetadata;

  it('should build JSON path aggregate keys', () => {
    expect(
      buildAggregateFieldKey({
        aggregateOperation: AggregateOperations.AVG,
        aggregateFieldMetadata: rawJsonField,
        aggregateSubFieldName: 'daysToFirstContact',
      }),
    ).toBe('avgOutreachSpeedTimestampsDaysToFirstContact');

    expect(
      buildAggregateFieldKey({
        aggregateOperation: AggregateOperations.COUNT_NOT_EMPTY,
        aggregateFieldMetadata: rawJsonField,
        aggregateSubFieldName: 'meetingBookedAt',
      }),
    ).toBe('countNotEmptyOutreachSpeedTimestampsMeetingBookedAt');
  });
});
