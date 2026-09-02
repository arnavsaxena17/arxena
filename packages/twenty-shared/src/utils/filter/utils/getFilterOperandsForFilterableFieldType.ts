import {
  type FilterableAndTSVectorFieldType,
  ViewFilterOperand,
} from '@/types';
import { isNonEmptyString } from '@sniptt/guards';

import { isRawJsonNumericPathKey } from '@/utils/fieldMetadata/isRawJsonNumericPathKey';
import { COMPOSITE_FIELD_FILTER_OPERANDS_MAP } from './compositeFieldFilterOperandsMap';
import { FILTER_OPERANDS_MAP } from './filterOperandsMap';

const actorSubFieldOperands = [
  ViewFilterOperand.IS,
  ViewFilterOperand.IS_NOT,
  ViewFilterOperand.IS_EMPTY,
  ViewFilterOperand.IS_NOT_EMPTY,
] as const;

const rawJsonPathEqualityOperands = [
  ViewFilterOperand.IS,
  ViewFilterOperand.IS_NOT,
  ViewFilterOperand.IS_EMPTY,
  ViewFilterOperand.IS_NOT_EMPTY,
] as const;

const rawJsonPathNumericOperands = [
  ViewFilterOperand.IS,
  ViewFilterOperand.IS_NOT,
  ViewFilterOperand.GREATER_THAN_OR_EQUAL,
  ViewFilterOperand.LESS_THAN_OR_EQUAL,
  ViewFilterOperand.IS_EMPTY,
  ViewFilterOperand.IS_NOT_EMPTY,
] as const;

const rawJsonWholeFieldOperands = [
  ViewFilterOperand.CONTAINS,
  ViewFilterOperand.DOES_NOT_CONTAIN,
  ViewFilterOperand.IS_EMPTY,
  ViewFilterOperand.IS_NOT_EMPTY,
] as const;

export const getFilterOperandsForFilterableFieldType = ({
  filterType,
  subFieldName,
}: {
  filterType: FilterableAndTSVectorFieldType;
  subFieldName?: string | null | undefined;
}): readonly ViewFilterOperand[] => {
  if (filterType === 'CURRENCY') {
    if (subFieldName === 'currencyCode') {
      return COMPOSITE_FIELD_FILTER_OPERANDS_MAP.CURRENCY.currencyCode;
    }

    return COMPOSITE_FIELD_FILTER_OPERANDS_MAP.CURRENCY.amountMicros;
  }

  if (
    filterType === 'ACTOR' &&
    (subFieldName === 'source' || subFieldName === 'workspaceMemberId')
  ) {
    return actorSubFieldOperands;
  }

  if (filterType === 'RAW_JSON') {
    if (isNonEmptyString(subFieldName)) {
      if (isRawJsonNumericPathKey(subFieldName)) {
        return rawJsonPathNumericOperands;
      }

      return rawJsonPathEqualityOperands;
    }

    return rawJsonWholeFieldOperands;
  }

  return FILTER_OPERANDS_MAP[filterType];
};
