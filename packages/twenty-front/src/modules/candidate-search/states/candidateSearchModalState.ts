import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

export const isCandidateSearchModalOpenState = createAtomState<boolean>({
  key: 'isCandidateSearchModalOpenState',
  defaultValue: false,
});
