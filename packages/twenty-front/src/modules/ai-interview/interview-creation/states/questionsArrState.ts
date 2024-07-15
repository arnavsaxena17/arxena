import { createState } from 'twenty-ui';

import { leftAndRightCombined } from '@/ai-interview/interview-creation/types/leftAndRightCombined';

export const questionsArrState = createState<leftAndRightCombined[]>({
  key: 'leftAndRightCombinedState',
  defaultValue: [],
});
