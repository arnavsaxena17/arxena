import { getRecordFilterOperands } from '@/object-record/record-filter/utils/getRecordFilterOperands';
import { ViewFilterOperand as RecordFilterOperand } from '@/views/types/ViewFilterOperand';
import { type FilterableAndTSVectorFieldType } from 'twenty-shared/types';

export const getDefaultAdvancedFilterOperand = ({
  filterType,
  subFieldName,
}: {
  filterType: FilterableAndTSVectorFieldType;
  subFieldName?: string | null;
}): RecordFilterOperand => {
  const availableOperands = getRecordFilterOperands({
    filterType,
    subFieldName,
  });

  const isDateFilterType = filterType === 'DATE' || filterType === 'DATE_TIME';

  if (
    isDateFilterType &&
    availableOperands.includes(RecordFilterOperand.IsRelative)
  ) {
    return RecordFilterOperand.IsRelative;
  }

  return availableOperands[0];
};
