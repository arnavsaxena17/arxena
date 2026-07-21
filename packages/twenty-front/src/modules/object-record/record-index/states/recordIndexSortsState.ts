import { RecordSort } from '@/object-record/record-sort/types/RecordSort';
import { createState } from 'twenty-ui';

export const recordIndexSortsState = createState<RecordSort[]>({
  key: 'recordIndexSortsState',
  defaultValue: [],
});
