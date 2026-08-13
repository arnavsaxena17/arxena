import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

import { type leftAndRightCombined } from '@/video-interview/interview-creation/types/leftAndRightCombined';

export const questionsArrState = createAtomState<leftAndRightCombined[]>({
  key: 'leftAndRightCombinedState',
  defaultValue: [],
});
