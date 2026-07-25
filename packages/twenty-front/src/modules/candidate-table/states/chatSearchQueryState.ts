import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

export const chatSearchQueryState = createAtomState<string>({
  key: 'chatSearchQueryState',
  defaultValue: '',
});
