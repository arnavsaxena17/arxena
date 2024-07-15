import { gql } from '@apollo/client';

export const FIND_MANY_AI_MODELS = gql`
  query FindManyAIModels(
    $filter: AIModelFilterInput
    $orderBy: [AIModelOrderByInput]
    $lastCursor: String
    $limit: Int
  ) {
    aIModels(
      filter: $filter
      orderBy: $orderBy
      first: $limit
      after: $lastCursor
    ) {
      edges {
        node {
          __typename
          language
          createdAt
          id
          country
          updatedAt
          name
          position
        }
      }
    }
  }
`;
