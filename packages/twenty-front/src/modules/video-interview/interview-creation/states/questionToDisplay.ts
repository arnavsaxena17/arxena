import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

export const questionToDisplayState = createAtomState<string>({
  key: 'questionToDisplay',
  defaultValue: 'introduction',
});
