import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

export const isVideoInterviewModalOpenState = createAtomState<boolean>({
  key: 'isVideoInterviewModalOpenState',
  defaultValue: false,
});
