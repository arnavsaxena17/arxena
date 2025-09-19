import { atom } from 'recoil';

type DataTableRefreshFunction = () => Promise<void>;

export const dataTableRefreshFunctionState = atom<DataTableRefreshFunction | null>({
  key: 'dataTableRefreshFunctionState',
  default: null,
});
