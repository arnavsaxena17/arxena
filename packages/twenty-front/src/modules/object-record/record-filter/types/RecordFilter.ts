import { FilterableFieldType } from '@/object-record/record-filter/types/FilterableFieldType';
import { ViewFilterOperand } from '@/views/types/ViewFilterOperand';

export type RecordFilter = {
  id: string;
  fieldMetadataId: string;
  value: string;
  displayValue: string;
  type: FilterableFieldType;
  recordFilterGroupId?: string;
  viewFilterGroupId?: string;
  displayAvatarUrl?: string;
  operand: ViewFilterOperand;
  positionInRecordFilterGroup?: number | null;
  positionInViewFilterGroup?: number | null;
  label: string;
  subFieldName?: string | null | undefined;
  relationTargetFieldMetadataId?: string | null;
};
