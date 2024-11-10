import { createState } from 'twenty-ui';

import { leftAndRightCombined } from '@/arx-enrich/types/leftAndRightCombined';

export const questionsArrState = createState<leftAndRightCombined[]>({
  key: 'leftAndRightCombinedState',
  defaultValue: [],
});
