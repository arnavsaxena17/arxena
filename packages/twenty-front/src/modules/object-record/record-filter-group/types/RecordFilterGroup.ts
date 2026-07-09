import { type ViewFilterGroupLogicalOperator } from '@/views/types/ViewFilterGroupLogicalOperator';

export type RecordFilterGroup = {
  id: string;
  parentRecordFilterGroupId?: string | null;
  logicalOperator: ViewFilterGroupLogicalOperator;
  positionInRecordFilterGroup?: number | null;
};
