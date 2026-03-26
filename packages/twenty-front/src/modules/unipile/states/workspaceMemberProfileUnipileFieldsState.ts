import { createState } from '@ui/utilities/state/utils/createState';

export type WorkspaceMemberProfileUnipileFields = {
  phoneNumber: string | null;
  linkedinUrl: string | null;
  whatsappUnipileAccountId: string | null;
  linkedinUnipileAccountId: string | null;
};

export const workspaceMemberProfileUnipileFieldsState =
  createState<WorkspaceMemberProfileUnipileFields | null>({
    key: 'workspaceMemberProfileUnipileFieldsState',
    defaultValue: null,
  });
