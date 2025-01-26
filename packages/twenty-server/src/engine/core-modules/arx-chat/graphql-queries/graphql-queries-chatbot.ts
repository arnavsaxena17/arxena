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

export const graphQlToUpdateCandidate = `mutation UpdateOneCandidate($idToUpdate: ID!, $input: CandidateUpdateInput!) {
  updateCandidate(id: $idToUpdate, data: $input) {
      __typename
  }
  }`

  export const mutationToUpdateOnePerson = `mutation UpdateOnePerson($idToUpdate: ID!, $input: PersonUpdateInput!) {
    updatePerson(id: $idToUpdate, data: $input) {
      __typename
      city
      salary
    }
  }
  `


  export const graphqlToCreateOneMetatDataObjectItems = `
        mutation CreateOneObjectMetadataItem($input: CreateOneObjectInput!) {
          createOneObject(input: $input) {
            id
            dataSourceId
            nameSingular
            namePlural
            labelSingular
            labelPlural
            description
            icon
            isCustom
            isActive
            createdAt
            updatedAt
            labelIdentifierFieldMetadataId
            imageIdentifierFieldMetadataId
          }
        }
      `
export const graphqlQueryToCreateVideoInterview = `mutation CreateOneVideoInterview($input: VideoInterviewCreateInput!) {
  createVideoInterview(data: $input) {
    interviewStarted
    position
    candidateId
    interviewCompleted
    updatedAt
    interviewLink {
      label
      url
    }
    createdAt
    id
    name
    videoInterviewTemplateId
  }
}`



export const graphQueryToFindManyvideoInterviews = `
query FindManyVideoInterviews($filter: VideoInterviewFilterInput, $orderBy: [VideoInterviewOrderByInput], $lastCursor: String, $limit: Int) {
  videoInterviews(
    filter: $filter
    orderBy: $orderBy
    first: $limit
    after: $lastCursor
  ) {
    edges {
      node {
        __typename
        videoInterview {
          __typename
          introduction
          createdAt
          id
          jobId
          instructions
          videoInterviewModelId
          name
          position
          updatedAt
        }
        position
        interviewLink {
          label
          url
          __typename
        }
        id
        interviewStarted
        interviewCompleted
        name
        createdAt
        candidate {
          __typename
          stopChat
          hiringNaukriUrl {
            label
            url
            __typename
          }
          startMeetingSchedulingChat
          uniqueStringKey
          whatsappProvider
          chatCount
          personId
          startChat
          status
          jobSpecificFields
          jobsId
          createdAt
          updatedAt
          lastEngagementChatControl
          startVideoInterviewChat
          resdexNaukriUrl {
            label
            url
            __typename
          }
          engagementStatus
          id
          position
          name
          candConversationStatus
        }
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


export const graphqlQueryToFindInterviewsByJobId = `query FindManyVideoInterviewTemplates($filter: VideoInterviewTemplateFilterInput, $orderBy: [VideoInterviewTemplateOrderByInput], $lastCursor: String, $limit: Int) {
  videoInterviewTemplates(
    filter: $filter
    orderBy: $orderBy
    first: $limit
    after: $lastCursor
  ) {
    edges {
      node {
        instructions
        introduction
        name
        createdAt
        position
        id
        videoInterviewModel {
          language
          createdAt
          name
          country
          id
          position
          updatedAt
        }
        job {
          recruiterId
          updatedAt
          arxenaSiteId
          companyId
          name
          position
          id
          clientContactId
          jobLocation
          googleSheetId
          createdAt
          jobCode
          isActive
        }
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

export const graphqlToFetchActiveJob = `query FindManyJobs($filter: JobFilterInput, $orderBy: [JobOrderByInput], $lastCursor: String, $limit: Int) {
        jobs(filter: $filter, orderBy: $orderBy, first: $limit, after: $lastCursor) {
          edges {
            node {
              candidates {
                edges {
                  node {
                    id
                    whatsappProvider
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
        lastEngagementChatControl
      }
  }
}}
  `;

  export const graphqlQueryToFindCandidateByUniqueKey = `
query FindManyCandidate($filter: CandidateFilterInput) {
  candidates(filter: $filter) {
    edges {
      node {
        id
        uniqueStringKey
        peopleId
        jobsId
      }
    }
  }
}`;


export const graphqlQueryToFindManyPeople = `query FindManyPeople($filter: PersonFilterInput, $orderBy: [PersonOrderByInput], $lastCursor: String, $limit: Int) {
  people(filter: $filter, orderBy: $orderBy, first: $limit, after: $lastCursor) {
    edges {
      node {
        name {
          firstName
          lastName
        }
        city
        salary
        uniqueStringKey
        candidates{
            edges{
                node {
                    id
                    name
                    whatsappProvider
                    lastEngagementChatControl
                    candConversationStatus
                    engagementStatus
                    jobs{
                        id
                        name
                        isActive
                        recruiterId
                        jobLocation
                        jobCode
                        createdAt
                        company {
                            name
                            id
                            domainName
                            descriptionOneliner
                        }

                    }
                    videoInterview{
                        edges{
                            node{
                                id
                                interviewLink{
                                  url
                                }
                            }
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
                                lastEngagementChatControl
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
      lastEngagementChatControl
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
export const graphqlQueryToUpdateCandidateChatCount = `mutation UpdateOneCandidate($idToUpdate: ID!, $input: CandidateUpdateInput!) {
    updateCandidate(id: $idToUpdate, data: $input) {
      updatedAt
      id
    }
  }`;

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
        lastEngagementChatControl
        whatsappDeliveryStatus
        createdAt
        messageObj
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


export const graphqlToFetchAllCandidateData = `
query FindManyCandidates($lastCursor: String, $limit: Int, $filter: CandidateFilterInput) {
  candidates(after: $lastCursor, first: $limit, filter: $filter) {
    edges {
      cursor
      node {
        id
        name
        whatsappProvider
        people {
          id
          name {
            firstName
            lastName
          }
          phone
          email
          jobTitle
          uniqueStringKey  
        }
        startChat

        jobs {
          id
          name
          jobLocation
          jobCode
          recruiterId
          company{
            name
            id
            domainName
            descriptionOneliner
          }
        }

        candConversationStatus
        startVideoInterviewChat
        videoInterview{
            edges{
                node{
                    id
                    interviewLink{
                      url
                    }
                    interviewStarted
                    interviewCompleted
                }
            }
        }
        lastEngagementChatControl
        startVideoInterviewChat
        startMeetingSchedulingChat
        stopChat
        uniqueStringKey
        hiringNaukriUrl{
          url
          label
        }
        resdexNaukriUrl{
          url
          label
        }
      }
    }
  }
}
`


export const graphqlQueryToFindManyPeopleEngagedCandidatesOlderSchema = `query FindManyPeople($filter: PersonFilterInput, $orderBy: [PersonOrderByInput], $lastCursor: String, ) {
    people(filter: $filter, orderBy: $orderBy,  after: $lastCursor) {
      edges {
        cursor
        node {
          candidates {
              edges{
                  node{
                      id
                      name
                      whatsappProvider
                      lastEngagementChatControl
                      candConversationStatus
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
                      aIInterviewStatus{
                        edges{
                            node{
                                id
                                interviewLink{
                                  url
                                }
                            }
                        }
                      }
                      engagementStatus
                      startVideoInterviewChat
                      startMeetingSchedulingChat
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
                            updatedAt
                            createdAt
                            lastEngagementChatControl
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
          uniqueStringKey
          position 
        }
      }
    }
  }`

export const graphqlQueryToFindManyPeopleEngagedCandidates = `query FindManyPeople($filter: PersonFilterInput, $orderBy: [PersonOrderByInput], $lastCursor: String, ) {
    people(filter: $filter, orderBy: $orderBy,  after: $lastCursor) {
      edges {
        cursor
        node {
          candidates {
              edges{
                  node{
                      id
                      name
                      whatsappProvider
                      lastEngagementChatControl
                      candConversationStatus
                      jobs {
                         name
                         id
                         jobLocation
                         jobCode
                         recruiterId
                         company{
                          name
                          id
                          domainName
                          descriptionOneliner
                        }
                      }
                      videoInterview{
                        edges{
                            node{
                                id
                                interviewLink{
                                  url
                                }
                            }
                        }
                      }
                      engagementStatus
                      startVideoInterviewChat
                      startMeetingSchedulingChat
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
                            updatedAt
                            createdAt
                            lastEngagementChatControl
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
          uniqueStringKey
          position 
        }
      }
    }
  }`;


export const graphqlToFetchManyCandidatesOlderSchema = `
  query FindManyCandidates($lastCursor: String, $limit: Int, $filter: CandidateFilterInput) {
    candidates(after: $lastCursor, first: $limit, filter: $filter) {
      edges {
        cursor
        node {
          id
          name
          whatsappProvider
          people {
            id
            name {
              firstName
              lastName
            }
            phone
            email
            jobTitle
            uniqueStringKey  
          }
          jobs {
            id
            name
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
          startChat
          candConversationStatus
          startVideoInterviewChat
          aIInterviewStatus{
              edges{
                  node{
                      id
                      interviewLink{
                        url
                      }
                  }
              }
          }
          lastEngagementChatControl
          startVideoInterviewChat
          startMeetingSchedulingChat
          stopChat
          uniqueStringKey
          hiringNaukriUrl{
            url
            label
          }
          resdexNaukriUrl{
            url
            label
          }
        }
      }
    }
  }
`


export const graphqlQueryToFetchWorksPaceMembers = `query FindManyWorkspaceMembers($filter: WorkspaceMemberFilterInput, $orderBy: [WorkspaceMemberOrderByInput], $lastCursor: String, $limit: Int) {
        workspaceMembers(
            filter: $filter
            orderBy: $orderBy
            first: $limit
            after: $lastCursor
        ) {
            edges {
                node {
                    prompts {
                        edges {
                            node {
                                prompt
                            }
                        }
                    }
                }
            }
        }
    }`

  export const graphqlQueryToManyCandidateById = `
  query FindManyCandidates($lastCursor: String, $limit: Int, $filter: CandidateFilterInput) {
    candidates(after: $lastCursor, first: $limit, filter: $filter) {
      edges {
        cursor
        node {
          id
          name
          whatsappProvider
          people {
            id
            name {
              firstName
              lastName
            }
          }
          startChat
          candConversationStatus
          jobs {
            id
            name
            jobLocation
            jobCode
            recruiterId
            company{
              name
              id
              domainName
              descriptionOneliner
            }
          }
          videoInterview{
              edges{
                  node{
                      id
                      interviewLink{
                        url
                      }
                  }
              }
          }
          lastEngagementChatControl
          startVideoInterviewChat
          startMeetingSchedulingChat
          stopChat
          hiringNaukriUrl{
            url
            label
          }
          resdexNaukriUrl{
            url
            label
          }
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
          cvSentId
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
            companyId
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
            personId
            jobsId
            name
            status
            createdAt
            updatedAt
            whatsappProvider
            startChat
            candConversationStatus
            startVideoInterviewChat
            startMeetingSchedulingChat
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


  export const graphqlMutationToDeleteManyCandidates = `
  mutation DeleteManyCandidates($filter: CandidateFilterInput!) {
    deleteCandidates(filter: $filter) {
      id
      __typename
    }
  }
`;

export const graphqlMutationToDeleteManyPeople = `
  mutation DeleteManyPeople($filter: PersonFilterInput!) {
    deletePeople(filter: $filter) {
      id
      __typename
    }
  }
`;


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
