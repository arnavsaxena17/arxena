import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';
import type { WorkspaceMemberProfileUnipileFields } from 'twenty-shared/utils';

export type { WorkspaceMemberProfileUnipileFields };

export const workspaceMemberProfileUnipileFieldsState =
  createAtomState<WorkspaceMemberProfileUnipileFields | null>({
    key: 'workspaceMemberProfileUnipileFieldsState',
    defaultValue: null,
  });
