import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';
import type { MetadataGqlOperationSignature, RecordGqlOperationSignature } from 'twenty-shared/types';

export const activeQueryListenersState = createAtomState<
  {
    queryId: string;
    operationSignature:
      | RecordGqlOperationSignature
      | MetadataGqlOperationSignature;
  }[]
>({
  key: 'activeQueryListenersState',
  defaultValue: [],
});
