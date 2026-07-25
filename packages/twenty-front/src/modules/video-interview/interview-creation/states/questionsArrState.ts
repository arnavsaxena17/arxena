import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

import { leftAndRightCombined } from '@/video-interview/interview-creation/types/leftAndRightCombined';

export const questionsArrState = createAtomState<leftAndRightCombined[]>({
  key: 'leftAndRightCombinedState',
  defaultValue: [],
});
