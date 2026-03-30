import { gql } from '@apollo/client';

export const USER_LOOKUP_ADMIN_PANEL = gql`
  mutation UserLookupAdminPanel($userIdentifier: String!) {
    userLookupAdminPanel(userIdentifier: $userIdentifier) {
      user {
        id
        email
        firstName
        lastName
      }
      workspaces {
        id
        name
        logo
        totalUsers
        allowImpersonation
        users {
          id
          email
          firstName
          lastName
        }
        featureFlags {
          key
          value
        }
        recruiterProfileForLookedUpUser {
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
        }
      }
    }
  }
`;
