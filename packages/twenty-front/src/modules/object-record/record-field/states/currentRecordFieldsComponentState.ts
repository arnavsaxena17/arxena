import { RecordFieldsComponentInstanceContext } from '@/object-record/record-field/states/context/RecordFieldsComponentInstanceContext';
import { type RecordField } from '@/object-record/record-field/types/RecordField';
import { createComponentStateV2 } from '@/ui/utilities/state/component-state/utils/createComponentStateV2';

export const currentRecordFieldsComponentState = createComponentStateV2<
  RecordField[]
>({
  key: 'currentRecordFieldsComponentState',
  defaultValue: [],
  componentInstanceContext: RecordFieldsComponentInstanceContext,
});
