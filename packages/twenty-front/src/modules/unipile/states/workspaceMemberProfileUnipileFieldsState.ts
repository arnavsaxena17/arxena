import { createState } from 'twenty-ui';
import type { WorkspaceMemberProfileUnipileFields } from 'twenty-shared';

export type { WorkspaceMemberProfileUnipileFields };

export const workspaceMemberProfileUnipileFieldsState =
  createState<WorkspaceMemberProfileUnipileFields | null>({
    key: 'workspaceMemberProfileUnipileFieldsState',
    defaultValue: null,
  });
