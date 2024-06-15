export const graphqlQueryToFindPeopleByPhoneNumber = `query FindManyPeople($filter: PersonFilterInput, $orderBy: PersonOrderByInput, $lastCursor: String, $limit: Int) {
  people(filter: $filter, orderBy: $orderBy, first: $limit, after: $lastCursor) {
    edges {
      node {
        name {
          firstName
          lastName
        }
        candidates{
            edges{
                node {
                    id
                    engagementStatus
                    jobs{
                        id
                        name
                        isActive
                        recruiterId
                        jobLocation
                        createdAt
                        companies {
                            name
                            id
                            descriptionOneliner
                        }

                    }
                    whatsappMessages{
                        edges{
                            node{
                                recruiterId
                                message
                                candidateId
                                jobsId
                                position
                                phoneTo
                                updatedAt
                                createdAt
                                id
                                name
                                phoneFrom
                                messageObj
                            }
                        }
                    }
                }
            }
        }
        id
        phone
        email
      }
    }
  }
}`;


  export const graphqlQueryToCreateOneNewWhatsappMessage = `mutation CreateOneWhatsappMessage($input: WhatsappMessageCreateInput!) {
    createWhatsappMessage(data: $input) {
      recruiterId
      message
      phoneFrom
      phoneTo
      jobsId
      candidateId
      name
      messageObj
    }
  }`;


  export const graphqlQueryToUpdateCandidateEngagementStatus = `mutation UpdateOneCandidate($idToUpdate: ID!, $input: CandidateUpdateInput!) {
    updateCandidate(id: $idToUpdate, data: $input) {
      updatedAt
      id
    }
  }`




  export const graphqlQueryToFindEngagedCandidates =   `query FindManyPeople($filter: PersonFilterInput, $orderBy: PersonOrderByInput, $lastCursor: String, $limit: Int) {
    people(filter: $filter, orderBy: $orderBy, first: $limit, after: $lastCursor) {
      edges {
        node {
          candidates {
              edges{
                  node{
                      id
                      jobs {
                         name
                         id
                         recruiterId
                         jobLocation
                         companies {
                          name
                          descriptionOneliner
                      }
                      }
                      engagementStatus
                      startChat
                      whatsappMessages {
                        edges {
                          node {
                            recruiterId
                            message
                            candidateId
                            jobsId
                            position
                            phoneTo
                            updatedAt
                            createdAt
                            id
                            name
                            phoneFrom
                            messageObj
                          }
                        }
                      }
                  }
              }
          }
          phone
          name {
            firstName
            lastName
          }
          email
          jobTitle
          id
          position
          
        }
      }
    }
  }`



  export const graphqlQueryTofindManyAttachmentsByJobId =  `query FindManyAttachments($filter: AttachmentFilterInput, $orderBy: AttachmentOrderByInput, $lastCursor: String, $limit: Int) {
    attachments(
      filter: $filter
      orderBy: $orderBy
      first: $limit
      after: $lastCursor
    ) {
      edges {
        node {
          whatsappMessageId
          authorId
          candidateId
          fullPath
          personId
          name
          opportunityId
          cvsentId
          updatedAt
          createdAt
          jobId
          type
          companyId
          screeningId
          clientInterviewId
          id
          recruiterInterviewId
          activityId
          offerId
          questionId
          answerId
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
  }`

  export const graphQLtoCreateOneAttachmentFromFilePath = `mutation CreateOneAttachment($input: AttachmentCreateInput!) {
  createAttachment(data: $input) {
    __typename
  }
}

`
  

  export const graphqlQueryToFindManyQuestionsByJobId = `query FindManyQuestions($filter: QuestionFilterInput, $orderBy: QuestionOrderByInput, $lastCursor: String, $limit: Int) {
    questions(filter: $filter, orderBy: $orderBy, first: $limit, after: $lastCursor) {
      edges {
        node {
          createdAt
          position
          id
          jobs {
            recruiterId
            id
            companiesId
            name
            position
            createdAt
            isActive
            jobLocation
            updatedAt
          }
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
  }`


  export const graphqlQueryToCreateOneAnswer = `mutation CreateOneAnswer($input: AnswerCreateInput!) {
    createAnswer(data: $input) {
      position
      candidateId
      createdAt
      name
      updatedAt
      questionsId
      id
    }
  }`


  export const graphqlToFindManyAnswers = `query FindManyAnswers($filter: AnswerFilterInput, $orderBy: AnswerOrderByInput, $lastCursor: String, $limit: Int) {
    answers(filter: $filter, orderBy: $orderBy, first: $limit, after: $lastCursor) {
      edges {
        node {
          __typename
          position
          createdAt
          name
          questions {
            __typename
            createdAt
            position
            id
            jobsId
            name
            updatedAt
          }
          candidate {
            __typename
            id
            position
            engagementStatus
            peopleId
            jobsId
            name
            status
            createdAt
            updatedAt
            startChat
          }
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
  }`

  export const graphqlQueryToRemoveMessages = `mutation DeleteManyWhatsappMessages($filter: WhatsappMessageFilterInput!) {
    deleteWhatsappMessages(filter: $filter) {
      id
      __typename
    }
  }`

  