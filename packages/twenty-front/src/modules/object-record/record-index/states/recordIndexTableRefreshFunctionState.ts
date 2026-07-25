import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

type RecordIndexTableRefreshFunction = () => Promise<void>;

export const recordIndexTableRefreshFunctionState =
  createAtomState<RecordIndexTableRefreshFunction | null>({
    key: 'recordIndexTableRefreshFunctionState',
    defaultValue: null,
  });
