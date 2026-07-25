import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

export const isBulkMessageModalOpenState = createAtomState<boolean>({
  key: 'candidate-table/isBulkMessageModalOpenState',
  defaultValue: false,
});
