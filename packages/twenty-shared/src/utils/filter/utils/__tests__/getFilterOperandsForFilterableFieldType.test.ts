import { ViewFilterOperand } from '@/types';
import { getFilterOperandsForFilterableFieldType } from '@/utils/filter/utils/getFilterOperandsForFilterableFieldType';

describe('getFilterOperandsForFilterableFieldType', () => {
  const emptyOperands = [
    ViewFilterOperand.IS_EMPTY,
    ViewFilterOperand.IS_NOT_EMPTY,
  ];

  it('should return select operands', () => {
    expect(
      getFilterOperandsForFilterableFieldType({ filterType: 'SELECT' }),
    ).toEqual([
      ViewFilterOperand.IS,
      ViewFilterOperand.IS_NOT,
      ...emptyOperands,
    ]);
  });

  it('should preserve actor source subfield operands', () => {
    expect(
      getFilterOperandsForFilterableFieldType({
        filterType: 'ACTOR',
        subFieldName: 'source',
      }),
    ).toEqual([
      ViewFilterOperand.IS,
      ViewFilterOperand.IS_NOT,
      ...emptyOperands,
    ]);
  });

  it('should preserve actor workspace member subfield operands', () => {
    expect(
      getFilterOperandsForFilterableFieldType({
        filterType: 'ACTOR',
        subFieldName: 'workspaceMemberId',
      }),
    ).toEqual([
      ViewFilterOperand.IS,
      ViewFilterOperand.IS_NOT,
      ...emptyOperands,
    ]);
  });

  it('should default currency to amount operands', () => {
    expect(
      getFilterOperandsForFilterableFieldType({ filterType: 'CURRENCY' }),
    ).toEqual([
      ViewFilterOperand.GREATER_THAN_OR_EQUAL,
      ViewFilterOperand.LESS_THAN_OR_EQUAL,
      ViewFilterOperand.IS,
      ViewFilterOperand.IS_NOT,
      ...emptyOperands,
    ]);
  });

  it('should return equality operands for RAW_JSON date path', () => {
    expect(
      getFilterOperandsForFilterableFieldType({
        filterType: 'RAW_JSON',
        subFieldName: 'updatedAt',
      }),
    ).toEqual([
      ViewFilterOperand.IS,
      ViewFilterOperand.IS_NOT,
      ...emptyOperands,
    ]);
  });

  it('should return numeric operands for RAW_JSON numeric path', () => {
    expect(
      getFilterOperandsForFilterableFieldType({
        filterType: 'RAW_JSON',
        subFieldName: 'daysToFirstContact',
      }),
    ).toEqual([
      ViewFilterOperand.IS,
      ViewFilterOperand.IS_NOT,
      ViewFilterOperand.GREATER_THAN_OR_EQUAL,
      ViewFilterOperand.LESS_THAN_OR_EQUAL,
      ...emptyOperands,
    ]);
  });

  it('should return whole-field operands for RAW_JSON without subFieldName', () => {
    expect(
      getFilterOperandsForFilterableFieldType({ filterType: 'RAW_JSON' }),
    ).toEqual([
      ViewFilterOperand.CONTAINS,
      ViewFilterOperand.DOES_NOT_CONTAIN,
      ...emptyOperands,
    ]);
  });
});
