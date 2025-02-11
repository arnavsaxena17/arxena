import { gql } from "@apollo/client";


export const FIND_MANY_JOBS_QUERY = gql`query FindManyJobs($filter: JobFilterInput, $orderBy: [JobOrderByInput], $lastCursor: String, $limit: Int) {
  jobs(filter: $filter, orderBy: $orderBy, first: $limit, after: $lastCursor) {
    edges {
      node {
        __typename
        updatedAt
        isActive
        chatFlowOrder
        recruiterId
        createdAt
        prompt{
            edges{
                node{
                    id
                    name
                    prompt
                }
            }
        }
        videoInterviewTemplate{
            edges{
                node{
                    id
                    videoInterviewModelId
                    name
                    instructions
                    introduction

                    attachments{
                        edges{
                            node{
                                id
                                name
                            }
                        }
                    }
                    videoInterviewQuestions{
                        edges{
                            node{
                                name
                                id
                                questionType
                                questionValue
                                attachments{
                                    edges{
                                        node{
                                            id
                                            name
                                        }
                                    }
                                }

                            }
                        }
                    }
                }
            }
        }
        name
        questions{
            edges{
                node{
                    id
                    name
                }
            }
        }
        company{
            id
            name
            descriptionOneliner
        }
        interviewSchedule{
            edges{
                node{
                    id
                    name
                    slotsAvailable
                    meetingType
                    jobId
                }
            }
        }
        jobCode
        jobLocation
        attachments{
            edges{
                node{
                    id
                    name
                }
            }
        }
        jobLocation
        companyId
        position
        id
      }
      cursor
      __typename
    }
    pageInfo {
      hasNextPage
      startCursor
      endCursor
      __typename
    }
    totalCount
    __typename
  }
}`;


