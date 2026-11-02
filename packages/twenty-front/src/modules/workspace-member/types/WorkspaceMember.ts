import {
  type WorkspaceMemberDateFormatEnum,
  type WorkspaceMemberNumberFormatEnum,
  type WorkspaceMemberTimeFormatEnum,
} from '~/generated-metadata/graphql';

export type ColorScheme = 'Dark' | 'Light' | 'System';

export type WorkspaceMember = {
  __typename: 'WorkspaceMember';
  id: string;
  name: {
    __typename?: 'FullName';
    firstName: string;
    lastName: string;
  };
  avatarUrl?: string | null;
  locale: string | null;
  colorScheme: ColorScheme;
  createdAt: string;
  updatedAt: string;
  userEmail: string;
  jobTitle?: string | null;
  // Arx-specific field added to the workspace member by the Arxena standard
  // metadata, so it is not part of the generated standard-object types.
  phoneNumber?: string | null;
  userId: string;
  userWorkspaceId?: string | null;
  timeZone?: string | null;
  dateFormat?: WorkspaceMemberDateFormatEnum | null;
  timeFormat?: WorkspaceMemberTimeFormatEnum | null;
  numberFormat?: WorkspaceMemberNumberFormatEnum | null;
  calendarStartDay?: number | null;
};

export type WorkspaceInvitation = {
  __typename: 'WorkspaceInvitation';
  id: string;
  email: string;
  roleId?: string | null;
  expiresAt: string;
};
