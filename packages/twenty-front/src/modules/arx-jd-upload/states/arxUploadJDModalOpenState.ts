import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

export const isArxUploadJDModalOpenState = createAtomState<boolean>({
  key: 'isArxUploadJDModalOpenState',
  defaultValue: false,
});

export const arxUploadJDModalModeState = createAtomState<'create' | 'edit'>({
  key: 'arxUploadJDModalModeState',
  defaultValue: 'create',
});

// export const enrichmentsState = createAtomState<any[]>({
//   key: 'enrichmentsState',
//   defaultValue: [],
// });

// export const activeEnrichmentState = createAtomState<number | null>({
//   key: 'activeEnrichmentState',
//   defaultValue: null,
// });
