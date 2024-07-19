export const FindManyWorkspaceMembers = `
query FindManyWorkspaceMembers($filter: WorkspaceMemberFilterInput, $orderBy: [WorkspaceMemberOrderByInput], $lastCursor: String, $limit: Int) {
  workspaceMembers(
    filter: $filter
    orderBy: $orderBy
    first: $limit
    after: $lastCursor
  ) {
    edges {
      node {
        __typename
        name {
          firstName
          lastName
          __typename
        }
        avatarUrl
        id
        userEmail
        colorScheme
        createdAt
        locale
        userId
        updatedAt
      }
    }
  }
}
`;
