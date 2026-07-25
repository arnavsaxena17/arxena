import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

type DataTableApplySortsFunction = (sorts: any) => void;

export const dataTableApplySortsFunctionState =
  createAtomState<DataTableApplySortsFunction | null>({
    key: 'dataTableApplySortsFunctionState',
    defaultValue: null,
  });
