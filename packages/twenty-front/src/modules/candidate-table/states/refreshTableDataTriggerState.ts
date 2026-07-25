import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

export const refreshTableDataTriggerState = createAtomState<boolean>({
  key: 'refreshTableDataTriggerState',
  defaultValue: false,
});
