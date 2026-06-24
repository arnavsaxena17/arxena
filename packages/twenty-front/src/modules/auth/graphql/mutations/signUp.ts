import { gql } from '@apollo/client';

import { AUTH_TOKEN } from '@/auth/graphql/fragments/authFragments';

export const SIGN_UP = gql`
  ${AUTH_TOKEN}
  mutation SignUp(
    $email: String!
    $password: String!
    $workspaceInviteHash: String
    $workspacePersonalInviteToken: String = null
    $captchaToken: String
    $workspaceId: String
    $locale: String
    $consentVisitorId: String
    $termsAccepted: Boolean
    $privacyPolicyVersion: String
  ) {
    signUp(
      email: $email
      password: $password
      workspaceInviteHash: $workspaceInviteHash
      workspacePersonalInviteToken: $workspacePersonalInviteToken
      captchaToken: $captchaToken
      workspaceId: $workspaceId
      locale: $locale
      consentVisitorId: $consentVisitorId
      termsAccepted: $termsAccepted
      privacyPolicyVersion: $privacyPolicyVersion
    ) {
      loginToken {
        ...AuthTokenFragment
      }
      workspace {
        id
        displayName
        workspaceUrls {
          subdomainUrl
          customUrl
        }
      }
    }
  }
`;
