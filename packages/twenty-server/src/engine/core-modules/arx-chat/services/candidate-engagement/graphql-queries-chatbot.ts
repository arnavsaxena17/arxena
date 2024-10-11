export const graphqlToFetchOneWhatsappMessageByWhatsappId = `
query FindOneWhatsappMessage($whatsappMessageId: String!) {
  whatsappMessage(filter: {whatsappMessageId: {eq: $whatsappMessageId}}) {
    id
    candidateId
    whatsappMessageId
    message
    messageObj
  }
}
`;

export const graphqlToFetchActiveJob = `query FindManyJobs($filter: JobFilterInput, $orderBy: [JobOrderByInput], $lastCursor: String, $limit: Int) {
        jobs(filter: $filter, orderBy: $orderBy, first: $limit, after: $lastCursor) {
          edges {
            node {
              candidates {
                edges {
                  node {
                    id
                  }
                }
              }
            }
          }
        }
      }`


export const graphqlQueryToFindMessageByWAMId = `query FindManyWhatsappMessages($filter: WhatsappMessageFilterInput, $orderBy: [WhatsappMessageOrderByInput], $lastCursor: String, $limit: Int) {
  whatsappMessages(
    filter: $filter
    orderBy: $orderBy
    first: $limit
    after: $lastCursor
  ) {
    edges {
      node {
        __typename
        id
        whatsappMessageId
      }
  }
}}
  `;


export const graphqlQueryToFindPeopleByPhoneNumber = `query FindManyPeople($filter: PersonFilterInput, $orderBy: [PersonOrderByInput], $lastCursor: String, $limit: Int) {
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
                    name
                    engagementStatus
                    jobs{
                        id
                        name
                        isActive
                        recruiterId
                        jobLocation
                        jobCode
                        createdAt
                        companies {
                            name
                            id
                            domainName
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
                                messageObj
                                position
                                phoneTo
                                updatedAt
                                createdAt
                                id
                                name
                                phoneFrom
                                
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
      whatsappDeliveryStatus
      whatsappMessageId
      typeOfMessage
      audioFilePath
    }
  }`;



export const graphqlQueryToUpdateCandidateEngagementStatus = `mutation UpdateOneCandidate($idToUpdate: ID!, $input: CandidateUpdateInput!) {
    updateCandidate(id: $idToUpdate, data: $input) {
      updatedAt
      id
    }
  }`;

export const graphQlToStopChat = `mutation UpdateOneCandidate($idToUpdate: ID!, $input: CandidateUpdateInput!) {
  updateCandidate(id: $idToUpdate, data: $input) {
    __typename
  }
}`

export const graphqlQueryToUpdateCandidateStatus = `mutation UpdateOneCandidate($idToUpdate: ID!, $input: CandidateUpdateInput!) {
  updateCandidate(id: $idToUpdate, data: $input) {
    __typename
    status
    }
  }`;

export const graphqlQueryToUpdateReminderStatus = `mutation UpdateOneReminder($idToUpdate: ID!, $input: ReminderUpdateInput!) {
    updateReminder(id: $idToUpdate, data: $input) {
      updatedAt
      id
    }
  }`;

export const graphqlQueryToUpdateMessageDeliveryStatus = `
    mutation UpdateOneWhatsappMessage($idToUpdate: ID!, $input: WhatsappMessageUpdateInput!) {
  updateWhatsappMessage(id: $idToUpdate, data: $input) {
    __typename
    whatsappDeliveryStatus
    whatsappMessageId
  }
}`;

export const graphQlToFetchWhatsappMessages = `query FindManyWhatsappMessages($filter: WhatsappMessageFilterInput, $orderBy: [WhatsappMessageOrderByInput], $lastCursor: String, $limit: Int) {
  whatsappMessages(
    filter: $filter
    orderBy: $orderBy
    first: $limit
    after: $lastCursor
  ) {
    edges {
      node {
        __typename
        message
        name
        typeOfMessage
        whatsappMessageId
        audioFilePath
        candidateId
        whatsappDeliveryStatus
        createdAt
        whatsappProvider
        phoneFrom
        id
        phoneTo
        position
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
}
`

export const graphqlQueryToFindEngagedCandidates = `query FindManyPeople($filter: PersonFilterInput, $orderBy: [PersonOrderByInput], $lastCursor: String, ) {
    people(filter: $filter, orderBy: $orderBy,  after: $lastCursor) {
      edges {
        cursor
        node {
          candidates {
              edges{
                  node{
                      id
                      name
                      jobs {
                         name
                         id
                         jobLocation
                         jobCode
                         recruiterId
                         companies{
                          name
                          id
                          domainName
                          descriptionOneliner
                        }
                      }
                      engagementStatus
                      startChat
                      status
                      stopChat
                      candidateReminders{
                        edges{
                            node{
                                remindCandidateAtTimestamp
                                remindCandidateDuration
                                isReminderActive
                                name
                            }
                        }
                      }
                      whatsappMessages {
                        edges {
                          node {
                            recruiterId
                            message
                            candidateId
                            jobsId
                            position
                            phoneTo
                            messageObj
                            updatedAt
                            createdAt
                            id
                            name
                            phoneFrom
                            whatsappDeliveryStatus
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
          salary
          city
          jobTitle
          id
          position 
        }
      }
    }
  }`;

  export const graphqlToFetchAllCandidatesByStartChat = `
  query FindManyCandidates($lastCursor: String, $limit: Int, $filter: CandidateFilterInput) {
    candidates(after: $lastCursor, first: $limit, filter: $filter) {
      edges {
        cursor
        node {
          id
          name
          people {
            id
            name {
              firstName
              lastName
            }
          }
          startChat
          stopChat
        }
      }
    }
  }
`

export const graphqlQueryTofindManyAttachmentsByJobId = `query FindManyAttachments($filter: AttachmentFilterInput, $orderBy: [AttachmentOrderByInput], $lastCursor: String, $limit: Int) {
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
  }`;

export const graphQLtoCreateOneAttachmentFromFilePath = `mutation CreateOneAttachment($input: AttachmentCreateInput!) {
  createAttachment(data: $input) {
    __typename
  } 
}

`;

export const graphqlQueryToFindManyQuestionsByJobId = `query FindManyQuestions($filter: QuestionFilterInput, $orderBy: [QuestionOrderByInput], $lastCursor: String, $limit: Int) {
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
            jobCode
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
  }`;

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
  }`;

export const graphqlToFindManyAnswers = `query FindManyAnswers($filter: AnswerFilterInput, $orderBy: [AnswerOrderByInput], $lastCursor: String, $limit: Int) {
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
            stopChat
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
  }`;

export const graphqlQueryToRemoveMessages = `mutation DeleteManyWhatsappMessages($filter: WhatsappMessageFilterInput!) {
    deleteWhatsappMessages(filter: $filter) {
      id
      __typename
    }
  }`;

export const graphqlQueryToGetTimelineThreadsFromPersonId = `query GetTimelineThreadsFromPersonId($personId: UUID!, $page: Int!, $pageSize: Int!) {
  getTimelineThreadsFromPersonId(
    personId: $personId
    page: $page
    pageSize: $pageSize
  ) {
    ...TimelineThreadsWithTotalFragment
    __typename
  }
}

fragment TimelineThreadsWithTotalFragment on TimelineThreadsWithTotal {
  totalNumberOfThreads
  timelineThreads {
    ...TimelineThreadFragment
    __typename
  }
  __typename
}

fragment TimelineThreadFragment on TimelineThread {
  id
  read
  visibility
  firstParticipant {
    ...ParticipantFragment
    __typename
  }
  lastTwoParticipants {
    ...ParticipantFragment
    __typename
  }
  lastMessageReceivedAt
  lastMessageBody
  subject
  numberOfMessagesInThread
  participantCount
  __typename
}

fragment ParticipantFragment on TimelineThreadParticipant {
  personId
  workspaceMemberId
  firstName
  lastName
  displayName
  avatarUrl
  handle
  __typename
}`;

export const graphqlQueryToCreateOneReminder = `
  mutation CreateOneCandidateReminder($input: CandidateReminderCreateInput!) {
  createCandidateReminder(data: $input) {
    __typename
  }
}
`;

export const graphqlQueryToFindManyReminders = `query FindManyCandidateReminders($filter: CandidateReminderFilterInput, $orderBy: [CandidateReminderOrderByInput], $lastCursor: String) {
  candidateReminders(
    filter: $filter
    orderBy: $orderBy
    after: $lastCursor
  ) {
    edges {
      node {
        __typename
        remindCandidateDuration
        createdAt
        candidateId
        remindCandidateAtTimestamp
        id
        position
        name
        updatedAt
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

export const graphqlQueryToUpdateOneReminder = `
  mutation UpdateOneCandidateReminder($idToUpdate: ID!, $input: CandidateReminderUpdateInput!) {
  updateCandidateReminder(id: $idToUpdate, data: $input) {
    __typename
  }
}
`;
