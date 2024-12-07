import { createState } from 'twenty-ui';

export const isArxEnrichModalOpenState = createState<boolean>({
  key: 'isArxEnrichModalOpenState',
  defaultValue: false,
});

export const enrichmentsState = createState<any[]>({
  key: 'enrichmentsState',
  defaultValue: [],
});

export const activeEnrichmentState = createState<number | null>({
  key: 'activeEnrichmentState',
  defaultValue: null,
});
