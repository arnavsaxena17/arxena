export const graphqlQueryToGetCurrentUser = `
query GetCurrentUser {
  currentUser {
    ...UserQueryFragment
    __typename
  }
}

fragment UserQueryFragment on User {
  id
  firstName
  lastName
  email
  canImpersonate
  supportUserHash
  onboardingStep
  workspaceMember {
    id
    name {
      firstName
      lastName
      __typename
    }
    colorScheme
    avatarUrl
    locale
    __typename
  }
  defaultWorkspace {
    id
    displayName
    logo
    domainName
    inviteHash
    allowImpersonation
    subscriptionStatus
    activationStatus
    featureFlags {
      id
      key
      value
      workspaceId
      __typename
    }
    currentCacheVersion
    currentBillingSubscription {
      id
      status
      interval
      __typename
    }
    __typename
  }
  workspaces {
    workspace {
      id
      logo
      displayName
      domainName
      __typename
    }
    __typename
  }
  __typename
}
`;

export const graphqlQueryToFindOneWorkspaceMember = `
query FindOneWorkspaceMember($objectRecordId: ID!) {
  workspaceMember(filter: {id: {eq: $objectRecordId}}) {
    __typename
    
    connectedAccounts {
      edges {
        node {
          __typename
          createdAt
          updatedAt
          accountOwnerId
          id
          accessToken
          lastSyncHistoryId
          handle
          refreshToken
          provider
          authFailedAt
        }
        __typename
      }
      __typename
    }
  }
}
`;
