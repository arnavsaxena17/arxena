import { createState } from '@ui/utilities/state/utils/createState';
import type { WorkspaceMemberProfileUnipileFields } from 'twenty-shared';

export type { WorkspaceMemberProfileUnipileFields };

export const workspaceMemberProfileUnipileFieldsState =
  createState<WorkspaceMemberProfileUnipileFields | null>({
    key: 'workspaceMemberProfileUnipileFieldsState',
    defaultValue: null,
  });
