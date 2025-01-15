import { gql } from '@apollo/client';

export const FIND_MANY_VIDEO_INTERVIEW_MODELS = gql`
  query FindManyVideoInterviewModels(
    $filter: VideoInterviewModelFilterInput
    $orderBy: [VideoInterviewModelOrderByInput]
    $lastCursor: String
    $limit: Int
  ) {
    videoInterviewModels(
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
