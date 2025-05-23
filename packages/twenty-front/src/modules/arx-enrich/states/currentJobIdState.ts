import { createState } from 'twenty-ui';

export const currentJobIdState = createState<string | null>({
  key: 'currentJobIdState',
  defaultValue: null,
}); 