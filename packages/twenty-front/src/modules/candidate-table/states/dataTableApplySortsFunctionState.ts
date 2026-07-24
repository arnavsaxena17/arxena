import { atom } from 'recoil';

type DataTableApplySortsFunction = (sorts: any) => void;

export const dataTableApplySortsFunctionState = atom<DataTableApplySortsFunction | null>({
  key: 'dataTableApplySortsFunctionState',
  default: null,
});
