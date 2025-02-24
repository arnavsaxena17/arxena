
export const graphqlToFetchWhatsappMessageByWhatsappId = `query FindOneWhatsappMessage($whatsappMessageId: String!) {
  whatsappMessage(filter: {whatsappMessageId: {eq: $whatsappMessageId}}) {
    id
    candidateId
    whatsappMessageId
    message
    messageObj
  }
}`;



export const graphqlToFetchCandidatesWithRecentUpdates = `
  query getCandidatesWithRecentUpdates($filter: CandidateFilter) {
    candidates(filter: $filter) {
      edges {
        node {
          id
          jobs {
            id
          }
          startChat
          startChatCompleted
          startVideoInterviewChat
          startVideoInterviewChatCompleted
          startMeetingSchedulingChat
          chatCount
          startMeetingSchedulingChatCompleted
          updatedAt
        }
      }
    }
  }
`;


export const graphqlQueryToFindScheduledClientMeetings = `query FindManyClientInterviews($filter: ClientInterviewFilterInput, $orderBy: [ClientInterviewOrderByInput], $lastCursor: String, $limit: Int) {
  clientInterviews(
    filter: $filter
    orderBy: $orderBy
    first: $limit
    after: $lastCursor
  ) {
    edges {
      node {
        __typename
        createdAt
        interviewTime
        updatedAt
        clientContactId
        interviewScheduleId
        clientInterviewCompleted
        id
        name
        position
        candidateId
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



export const graphqlQueryToFetchPrompts = `
  query FindManyPrompts($filter: PromptFilterInput, $orderBy: [PromptOrderByInput], $limit: Int) {
  prompts(filter: $filter, orderBy: $orderBy, first: $limit) {
    edges {
    node {
      prompt
    }
    }
  }
  }
`




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






export const graphqlToFindManyJobs = `query FindManyJobs($filter: JobFilterInput, $orderBy: [JobOrderByInput], $lastCursor: String, $limit: Int) {
  jobs(filter: $filter, orderBy: $orderBy, first: $limit, after: $lastCursor) {
    edges {
      node {
        __typename
        updatedAt
        isActive
        arxenaSiteId
        chatFlowOrder
        jobCode
        searchName
        reportsTo
        reportees
        yearsOfExperience
        salaryBracket
        companyDetails
        pathPosition
        talentConsiderations
        specificCriteria

        companyId
        position
        description
        name
        jobLocation
        id
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
        candidates {
          edges {
            node {
              id
              whatsappProvider
            }
          }
        }
        interviewSchedule{
            edges{
                node{
                    id
                    name
                    slotsAvailable
                    meetingType
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







export const findManyAttachmentsQuery = `query FindManyAttachments($filter: AttachmentFilterInput, $orderBy: [AttachmentOrderByInput], $lastCursor: String, $limit: Int) {
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








export const findWorkspaceMemberProfiles =  `query FindManyWorkspaceMemberProfiles($filter: WorkspaceMemberProfileFilterInput, $orderBy: [WorkspaceMemberProfileOrderByInput], $lastCursor: String, $limit: Int) {
  workspaceMemberProfiles(
    filter: $filter
    orderBy: $orderBy
    first: $limit
    after: $lastCursor
  ) {
    edges {
      node {
        __typename
        id
        email
        phoneNumber
        companyName
        companyDescription
        lastName
        createdAt
        phoneNumber
        name
        firstName
        typeWorkspaceMember
        email
        companyName
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
        id
        createdAt
        interviewCompleted
        name
        position
        interviewStarted
        attachments {
          edges {
            node {
              id
              fullPath
              name
            }
          }
        }
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
        videoInterviewTemplate {
          position
          introduction
          id
          createdAt
          jobId
          name
          videoInterviewModelId
          videoInterviewQuestions {
            edges {
              node {
                name
                id
                createdAt
                timeLimit
                questionType
                questionValue
                attachments {
                  edges {
                    node {
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
          __typename
        }
        candidate {
          __typename
          id
          name
          position
          stopChat
          personId
          startChat
          chatCount
          status
          jobSpecificFields
          jobsId
          createdAt
          updatedAt
          engagementStatus
          candConversationStatus
          startChatCompleted
          startVideoInterviewChat
          startVideoInterviewChatCompleted
          startMeetingSchedulingChat
          startMeetingSchedulingChatCompleted
          lastEngagementChatControl
          uniqueStringKey
          whatsappProvider
          hiringNaukriUrl {
            label
            url
            __typename
          }
          resdexNaukriUrl {
            label
            url
            __typename
          }
          jobs {
            name
            id
            recruiterId
            company {
              name
            }
          }
          people {
            id
            name {
              firstName
              lastName
            }
            email
            phone
          }
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
        prompts {
            edges {
                node {
                    prompt
                }
            }
        }
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
        phoneNumber
        locale
        userId
        updatedAt
      }
    }
  }
}
`;





export const graphqlQueryToFindManyPeople = `query FindManyPeople($filter: PersonFilterInput, $orderBy: [PersonOrderByInput], $lastCursor: String, ) {
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
                       isActive
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
                              createdAt
                              updatedAt
                              interviewLink{
                                url
                              }
                          }
                      }
                    }
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
                    engagementStatus
                    startVideoInterviewChat
                    engagementStatus
                    startChatCompleted
                    startMeetingSchedulingChat
                    chatCount
                    startMeetingSchedulingChatCompleted
                    startVideoInterviewChat
                    startVideoInterviewChatCompleted
                    startChat
                    status
                    updatedAt
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


export const FindOneJob = `
  query FindOneJob($objectRecordId: ID!) {
    job(filter: {id: {eq: $objectRecordId}}) {
        updatedAt
        isActive
        recruiterId
        arxenaSiteId
        createdAt
        jobCode
        searchName
        reportsTo
        reportees
        yearsOfExperience
        salaryBracket
        companyDetails
        talentConsiderations
        specificCriteria
        description
        name
        jobLocation
        companyId
        position
        id

    }
  }
  `;




export const graphqlQueryToFindSMS = `
query FindManySMS($filter: SMSFilterInput, $orderBy: [SMSOrderByInput], $lastCursor: String, $limit: Int) {
    smsMessages(filter: $filter, orderBy: $orderBy, first: $limit, after: $lastCursor) {
        edges {
            node {
                id
                personId
                phoneNumber
                messageType
                message
                timestamp
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
        candidateId
        updatedAt
        position
        whatsappDeliveryStatus
        whatsappMessageId
        phoneFrom
        createdAt
        audioFilePath
        id
        recruiterId
        messageObj
        phoneTo
        jobsId
        whatsappProvider
        lastEngagementChatControl
        candidate {
          name
          id
          createdAt
          updatedAt
          startChat
          chatCount
          startChatCompleted
          startMeetingSchedulingChat
          startMeetingSchedulingChatCompleted
          startVideoInterviewChat
          startVideoInterviewChatCompleted
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
}
`


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
                      interviewSchedule{
          edges{
              node{
                  id
                  name
                  createdAt
                  slotsAvailable
                  meetingType
              }
            }
          }
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



  export const queryByvideoInterview = `query FindOneVideoInterview($objectRecordId: ID!) {
    videoInterview(filter: {id: {eq: $objectRecordId}}) {
      attachments {
        edges {
          node {
            clientInterviewId
            phoneCallId
            activityId
            whatsappMessageId
            candidateReminderId
            opportunityId
            videoInterviewModelId
            name
            videoInterviewId
            updatedAt
            authorId
            clientContactId
            jobId
            type
            id
            createdAt
            textMessageId
            fullPath
            videoInterviewQuestionId
            interviewScheduleId
            candidateEnrichmentId
            screeningId
            shortlistId
            workspaceMemberProfileId
            candidateId
            promptId
            questionId
            personId
            videoInterviewTemplateId
            offerId
            cvSentId
            companyId
            videoInterviewResponseId
            answerId
            recruiterInterviewId
          }
        }
      }
      id
      videoInterviewTemplateId
      interviewReviewLink {
        label
        url
      }
      videoInterviewResponse {
        edges {
          node {
            videoInterviewId
            createdAt
            timeLimitAdherence
            name
            feedback
            candidateId
            jobId
            position
            personId
            updatedAt
            timer
            id
            transcript
            completedResponse
            videoInterviewQuestionId
            startedResponding
          }
        }
      }
      candidateId
      position
      videoInterviewTemplate {
        jobId
        id
        name
        updatedAt
        instructions
        createdAt
        videoInterviewModelId
        position
        introduction
      }
      interviewStarted
      name
      updatedAt
      interviewLink {
        label
        url
      }
      interviewCompleted
      createdAt
    }
    }
  `;
  


  
  export const graphqlToFetchAllCandidateData = `
  query FindManyCandidates($lastCursor: String, $limit: Int, $filter: CandidateFilterInput) {
    candidates(after: $lastCursor, first: $limit, filter: $filter) {
      edges {
        cursor
        node {
          id
          name
          updatedAt
          whatsappProvider
          answers{
            edges{
              node{
                  id
                  name
                  questions{
                      name
                      id
                  }
              }
            }
          }

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
            phoneCall{
                edges{
                    node{
                        name
                        id
                        transcript
                        attachments{
                            edges{
                                node{
                                    name
                                    id
                                    fullPath
                                }
                            }
                        }
                    }
                }
            }
          }
          startChat
          chatCount
          startChatCompleted
          startMeetingSchedulingChat
          startMeetingSchedulingChatCompleted
          startVideoInterviewChat
          startVideoInterviewChatCompleted
          whatsappMessages {
            edges {
              node {
                updatedAt
                createdAt
                id
                name
              }
            }
          }
          jobs {
            id
            name
            jobLocation
            jobCode
            isActive
            googleSheetId
            recruiterId
            chatFlowOrder
            pathPosition
            createdAt
            interviewSchedule{
              edges{
                  node{
                      id
                      name
                      createdAt
                      slotsAvailable
                      meetingType
                  }
                }
              }
            company{
              name
              id
              domainName
              descriptionOneliner
            }
          }
          videoInterviewTemplate {
            edges {
              node {
                id
                name
                videoInterviewQuestions {
                  edges {
                    node {
                      id
                      questionValue
                      timeLimit
                    }
                  }
                }
              }
            }
          }
        }
        videoInterviewResponse {
          edges {
            node {
              id
              transcript
              videoInterviewQuestionId
              attachments {
                edges {
                  node {
                    id
                    type
                    fullPath
                    name
                  }
                }
              }
            }
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
                    createdAt
                    updatedAt
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
  





export const findManyPhoneCalls = `
  query FindManyPhoneCalls($filter: PhoneCallFilterInput, $orderBy: [PhoneCallOrderByInput], $lastCursor: String, $limit: Int) {
      phoneCalls(
          filter: $filter
          orderBy: $orderBy
          first: $limit
          after: $lastCursor
      ) {
          edges {
              node {
                  callType
                  id
                  personId
                  transcript
                  phoneNumber
                  name
                  position
                  timestamp
                  duration
                  attachments{
                      edges{
                          node{
                              name
                              id
                              fullPath
                          }
                      }
                  }

                  createdAt
                  updatedAt
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
  }
  `


export const findManyShortlistsquery = `query FindManyShortlists($filter: ShortlistFilterInput, $orderBy: [ShortlistOrderByInput], $lastCursor: String, $limit: Int) {
  shortlists(
    filter: $filter
    orderBy: $orderBy
    first: $limit
    after: $lastCursor
  ) {
    edges {
      node {
        __typename
        cvSents {
          __typename
          position
          jobId
          id
          createdAt
          candidateId
          name
          updatedAt
        }
        id
        yearsOfExperience
        reasonForLeaving
        position
        age
        universityCollege
        currentLocation
        educationalQualifications
        currentJobTitle
        name
        expectedSalary
        createdAt
        currentCompany
        noticePeriod
        fullName
        functionsReportingTo
        currentRoleDescription
        reportsTo
        currentSalary
      }
    }
  }
}
`


export const findOneCandidate = `query FindOneCandidate($objectRecordId: ID!) {
candidate(filter: {id: {eq: $objectRecordId}}) {
  whatsappProvider
  people {
    name {
      firstName
      lastName
    }
    companyId
    phone
    id
    phoneCall {
          edges{
              node{
                  name
                  id
                  transcript
                  attachments{
                      edges{
                          node{
                              name
                              id
                              fullPath
                          }
                      }
                  }
              }
          }
      }
      avatarUrl
    }
    startVideoInterviewChatCompleted
    engagementStatus
    stopChat
    updatedAt
    startChat
    startChatCompleted
    startMeetingSchedulingChat
    chatCount
    startMeetingSchedulingChatCompleted
    startVideoInterviewChat
    startVideoInterviewChatCompleted
  }
}
`



export const findOnePersonQuery = `
  query FindOnePerson($objectRecordId: ID!) {
    person(filter: { id: { eq: $objectRecordId } }) {
      xLink {
        label
        url
      }
      id
      createdAt
      city
      email
      jobTitle
      name {
        firstName
        lastName
      }
      phone
      linkedinLink {
        label
        url
      }
      updatedAt
      avatarUrl
      companyId
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
                    updatedAt
                    whatsappProvider
                    lastEngagementChatControl
                    candConversationStatus
                    jobs {
                       name
                       id
                       isActive
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
                    startChat
                    startChatCompleted
                    startMeetingSchedulingChat
                    chatCount
                    startMeetingSchedulingChatCompleted
                    startVideoInterviewChat
                    startVideoInterviewChatCompleted
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






export const graphqlToFetchManyCandidatesOlderSchema = `
query FindManyCandidates($lastCursor: String, $limit: Int, $filter: CandidateFilterInput) {
  candidates(after: $lastCursor, first: $limit, filter: $filter) {
    edges {
      cursor
      node {
        id
        name
        updatedAt
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
          chatFlowOrder
          isActive
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




export const graphqlToFindManyJobByArxenaSiteIdOlderSchema = `
query FindManyJobs($filter: JobFilterInput, $orderBy: [JobOrderByInput], $lastCursor: String, $limit: Int) {
jobs(filter: $filter, orderBy: $orderBy, first: $limit, after: $lastCursor) {
edges {
  node {
    __typename
    updatedAt
    isActive
    recruiterId
    arxenaSiteId
    createdAt
    name
    jobLocation
    companiesId
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
}`

