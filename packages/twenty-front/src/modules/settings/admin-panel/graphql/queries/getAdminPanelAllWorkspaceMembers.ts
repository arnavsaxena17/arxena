import { gql } from '@apollo/client';

export const GET_ADMIN_PANEL_ALL_WORKSPACE_MEMBERS = gql`
  query GetAdminPanelAllWorkspaceMembers {
    adminPanelAllWorkspaceMembers {
      workspaceId
      workspaceName
      workspaceCompanyName
      workspaceSubdomain
      workspaceCreatedAt
      userId
      userEmail
      userFirstName
      userLastName
      userCreatedAt
      membershipCreatedAt
      workspaceMemberArx {
        workspaceMemberId
        phoneNumber
        linkedinUrl
        linkedinUnipileAccountId
        whatsappUnipileAccountId
        keepLinkedinConnected
        email
        firstName
        lastName
        name
        jobTitle
        typeWorkspaceMember
        chromeExtensionId
        extensionInstalled
        linkedinCookiesStored
        linkedinLiAStored
        linkedinCookiesLastSyncedAt
        linkedinCookiesValidatedAt
        linkedinIp
        linkedinCountry
        linkedinUserAgentStored
      }
    }
  }
`;
