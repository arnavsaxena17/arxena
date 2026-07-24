import { createState } from 'twenty-ui';

export const isArxUploadJDModalOpenState = createState<boolean>({
  key: 'isArxUploadJDModalOpenState',
  defaultValue: false,
});

export const arxUploadJDModalModeState = createState<'create' | 'edit'>({
  key: 'arxUploadJDModalModeState',
  defaultValue: 'create',
});

// export const enrichmentsState = createState<any[]>({
//   key: 'enrichmentsState',
//   defaultValue: [],
// });

// export const activeEnrichmentState = createState<number | null>({
//   key: 'activeEnrichmentState',
//   defaultValue: null,
// });
