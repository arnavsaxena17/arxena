export const videoInterviewsQuery = `query FindManyVideoInterviews($filter: VideoInterviewFilterInput, $orderBy: [VideoInterviewOrderByInput], $lastCursor: String, $limit: Int) {
          videoInterviews(
            filter: $filter
            orderBy: $orderBy
            first: $limit
            after: $lastCursor
          ) {
            edges {
              node {
                id
                createdAt
                interviewCompleted
                name
                attachments{
                    edges{
                        node{
                            id
                            fullPath
                            name
                        }
                    }
                }
                interviewStarted
                position
                candidate {
                  jobs{
                    name
                    id
                    recruiterId
                    company{
                        name
                    }
                  }
                  id
                  people{
                    id
                    name{
                        firstName
                        lastName
                    }
                    email
                    phone
                  }
                }
                videoInterviewTemplate {
                  position
                  introduction
                  id
                  createdAt
                  jobId
                  name
                  videoInterviewModelId
                  videoInterviewQuestions {
                    edges{
                        node{
                            name
                            id
                            createdAt
                            timeLimit
                            questionType
                            questionValue
                            attachments{
                            edges{
                                node{
                                    id
                                    fullPath
                                    name
                                }
                            }
                        }
                        }
                    }
                  }
                  instructions
                  updatedAt
                }
                interviewLink {
                  label
                  url
                }
              }
            }
            pageInfo {
              hasNextPage
              startCursor
              endCursor
            }
            totalCount
          }
        } `;

export const findManyAttachmentsForVideoIntroduction = `query FindManyAttachments($filter: AttachmentFilterInput, $orderBy: [AttachmentOrderByInput], $lastCursor: String, $limit: Int) {
          attachments( filter: $filter orderBy: $orderBy first: $limit after: $lastCursor ) {
        edges {
          node {
            fullPath
            id
            name
          }
          cursor
        }
        pageInfo {
          hasNextPage
          startCursor
          endCursor
        }
        totalCount
          }
        }`;

export const findManyAttachmentsForVideoQuestions = `query FindManyAttachments($filter: AttachmentFilterInput, $orderBy: [AttachmentOrderByInput], $lastCursor: String, $limit: Int) {
    attachments(
    filter: $filter
    orderBy: $orderBy
    first: $limit
    after: $lastCursor
    ) {
    edges {
        node {
        fullPath
        id
        name
        }
        cursor
    }
    pageInfo {
        hasNextPage
        startCursor
        endCursor
    }
    totalCount
    }
}`;

export const updateOneVideoInterviewMutation = `mutation UpdateOneVideoInterview($idToUpdate: ID!, $input: VideoInterviewUpdateInput!) {
    updateVideoInterview(id: $idToUpdate, data: $input) {
        id
        interviewStarted
        interviewCompleted
        updatedAt
        createdAt
    }
    }`;


export const questionsQuery = `
    query FindManyVideoInterviewQuestions($filter: VideoInterviewQuestionFilterInput, $orderBy: [VideoInterviewQuestionsOrderByInput], $limit: Int) {
    videoInterviewQuestions(
        filter: $filter
        orderBy: $orderBy
        first: $limit
    ) {
        edges {
        node {
            id
            name
            questionValue
            timeLimit
            position
            videoInterviewTemplateId
        }
        }
    }
    }
`;



export const updateStatusMutation = `
mutation UpdateOneVideoInterview($idToUpdate: ID!, $input: VideoInterviewUpdateInput!) {
  updateVideoInterview(id: $idToUpdate, data: $input) {
    id
    interviewStarted
    interviewCompleted
    updatedAt
  }
}
`;
export const graphQltoUpdateOneCandidate = `
mutation UpdateOneCandidate($idToUpdate: ID!, $input: CandidateUpdateInput!) {
  updateCandidate(id: $idToUpdate, data: $input) {
    id
    updatedAt
  }
}
`;


export const createResponseMutation = `mutation CreateOneVideoInterviewResponse($input: VideoInterviewResponseCreateInput!) {
    createVideoInterviewResponse(data: $input) {
      id
      videoInterviewId
      videoInterviewQuestionId
      transcript
      completedResponse
      createdAt
    }
  }`;

