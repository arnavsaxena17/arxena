import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { useGetInitialFilterValue } from '@/object-record/object-filter-dropdown/hooks/useGetInitialFilterValue';
import { type RecordFilter } from '@/object-record/record-filter/types/RecordFilter';
import { getDefaultSubFieldNameForCompositeFilterableFieldType } from '@/object-record/record-filter/utils/getDefaultSubFieldNameForCompositeFilterableFieldType';
import { getRecordFilterOperands } from '@/object-record/record-filter/utils/getRecordFilterOperands';
import {
  getFilterTypeFromFieldType,
  getKnownRawJsonPathKeysForField,
} from 'twenty-shared/utils';
import { FieldMetadataType } from '~/generated-metadata/graphql';
import { v4 } from 'uuid';

export const useCreateEmptyRecordFilterFromFieldMetadataItem = () => {
  const { getInitialFilterValue } = useGetInitialFilterValue();

  const createEmptyRecordFilterFromFieldMetadataItem = (
    fieldMetadataItem: FieldMetadataItem,
  ) => {
    const filterType = getFilterTypeFromFieldType(fieldMetadataItem.type);

    // Default RAW_JSON filters to the first known path so the chip opens
    // as a field-value filter instead of whole-blob Contains.
    const defaultSubFieldName =
      fieldMetadataItem.type === FieldMetadataType.RAW_JSON
        ? (getKnownRawJsonPathKeysForField(fieldMetadataItem.name)?.[0] ?? null)
        : getDefaultSubFieldNameForCompositeFilterableFieldType(filterType);

    const availableOperandsForFilter = getRecordFilterOperands({
      filterType,
      subFieldName: defaultSubFieldName,
    });

    const defaultOperand = availableOperandsForFilter[0];

    const { displayValue, value } = getInitialFilterValue(
      filterType,
      defaultOperand,
    );

    const newRecordFilter: RecordFilter = {
      id: v4(),
      fieldMetadataId: fieldMetadataItem.id,
      operand: defaultOperand,
      displayValue,
      label: fieldMetadataItem.label,
      type: filterType,
      value,
      subFieldName: defaultSubFieldName,
    };

    return { newRecordFilter };
  };

  return {
    createEmptyRecordFilterFromFieldMetadataItem,
  };
};
