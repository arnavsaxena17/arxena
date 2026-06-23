import { gql } from '@apollo/client';

export const GET_ADMIN_PANEL_ALL_WORKSPACE_MEMBERS = gql`
  query GetAdminPanelAllWorkspaceMembers {
    adminPanelAllWorkspaceMembers {
      workspaceId
      workspaceName
      workspaceSubdomain
      workspaceCreatedAt
      userId
      userEmail
      userFirstName
      userLastName
      userCreatedAt
      membershipCreatedAt
      recruiterProfile {
        workspaceMemberId
        profileId
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
        companyName
        companyDescription
        typeWorkspaceMember
        chromeExtensionId
        extensionInstalled
        linkedinCookiesStored
        linkedinLiAStored
        linkedinCookiesLastSyncedAt
        linkedinCookiesValidatedAt
        linkedinIp
        linkedinCountry
      }
    }
  }
`;
