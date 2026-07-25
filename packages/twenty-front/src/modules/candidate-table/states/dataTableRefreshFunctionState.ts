import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

type DataTableRefreshFunction = () => Promise<void>;

export const dataTableRefreshFunctionState =
  createAtomState<DataTableRefreshFunction | null>({
    key: 'dataTableRefreshFunctionState',
    defaultValue: null,
  });
