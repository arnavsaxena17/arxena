import {
  formatRawJsonPathColumnExpression,
  formatRawJsonPathNumericColumnExpression,
} from 'src/engine/twenty-orm/utils/format-raw-json-path-column.util';

describe('formatRawJsonPathColumnExpression', () => {
  it('should emit postgres json path text extraction', () => {
    expect(
      formatRawJsonPathColumnExpression({
        objectNameSingular: 'candidate',
        fieldName: 'outreachSpeedTimestamps',
        jsonPath: 'timeToFirstContactBucket',
      }),
    ).toBe(
      `"candidate"."outreachSpeedTimestamps"->>'timeToFirstContactBucket'`,
    );
  });

  it('should emit numeric cast expression', () => {
    expect(
      formatRawJsonPathNumericColumnExpression({
        objectNameSingular: 'candidate',
        fieldName: 'outreachSpeedTimestamps',
        jsonPath: 'daysToFirstContact',
      }),
    ).toBe(
      `NULLIF("candidate"."outreachSpeedTimestamps"->>'daysToFirstContact', '')::double precision`,
    );
  });
});
