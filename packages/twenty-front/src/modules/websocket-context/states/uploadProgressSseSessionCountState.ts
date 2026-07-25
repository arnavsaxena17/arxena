import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

/** Increment while a candidate upload/resume batch may emit SSE progress; SSE connects when > 0. */
export const uploadProgressSseSessionCountState = createAtomState<number>({
  key: 'uploadProgressSseSessionCountState',
  defaultValue: 0,
});
