import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';
import type { WorkspaceMemberProfileUnipileFields } from 'twenty-shared/utils';

export type { WorkspaceMemberProfileUnipileFields };

export const workspaceMemberUnipileFieldsState =
  createAtomState<WorkspaceMemberProfileUnipileFields | null>({
    key: 'workspaceMemberUnipileFieldsState',
    defaultValue: null,
  });
