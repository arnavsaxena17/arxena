import { atom } from 'recoil';

/** Increment while a candidate upload/resume batch may emit SSE progress; SSE connects when > 0. */
export const uploadProgressSseSessionCountState = atom({
  key: 'uploadProgressSseSessionCountState',
  default: 0,
});
