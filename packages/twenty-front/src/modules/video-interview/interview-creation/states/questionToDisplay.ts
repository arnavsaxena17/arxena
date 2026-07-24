import { createState } from 'twenty-ui';

export const questionToDisplayState = createState<string>({
  key: 'questionToDisplay',
  defaultValue: 'introduction',
});
