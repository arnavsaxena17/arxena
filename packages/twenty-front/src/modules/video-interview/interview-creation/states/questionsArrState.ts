import { createState } from 'twenty-ui';

import { leftAndRightCombined } from '@/video-interview/interview-creation/types/leftAndRightCombined';

export const questionsArrState = createState<leftAndRightCombined[]>({
  key: 'leftAndRightCombinedState',
  defaultValue: [],
});
