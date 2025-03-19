import { atom } from 'recoil';

type RecordTableRefetchFunction = () => Promise<any>;

export const recordTableRefetchFunctionState = atom<RecordTableRefetchFunction>(
  {
    key: 'recordTableRefetchFunctionState',
    default: async () => undefined,
  },
);
