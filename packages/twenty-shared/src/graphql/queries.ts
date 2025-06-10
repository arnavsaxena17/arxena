export const graphqlToFetchWhatsappMessageByWhatsappId = `query FindOneWhatsappMessage($whatsappMessageId: String!) {
  whatsappMessage(filter: {whatsappMessageId: {eq: $whatsappMessageId}}) {
    id
    candidateId
    whatsappMessageId
    message
    messageObj
  }
}`;


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
`;

export const graphqlQueryToFindVideoInterviewTemplatesByJobId = `query FindManyVideoInterviewTemplates($filter: VideoInterviewTemplateFilterInput, $orderBy: [VideoInterviewTemplateOrderByInput], $lastCursor: String, $limit: Int) {
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
        candidateFields{
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
              source
              campaign
              whatsappProvider
              candidateFieldValues{
            edges{
              node{
                  id
                  name
                  candidateFields{
                      name
                      id
                  }
              }
            }
          }
            }
          }
        }
        recruiter{
            id
            workspaceMemberProfile{
                edges{
                    node{
                        id
                        name
                        phoneNumber
                        companyDescription
                        jobTitle
                    }
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

export const FindManyVideoInterviewModels = `query FindManyVideoInterviewModels($filter: VideoInterviewModelFilterInput, $orderBy: [VideoInterviewModelOrderByInput], $lastCursor: String, $limit: Int) {
  videoInterviewModels(
    filter: $filter
    orderBy: $orderBy
    first: $limit
    after: $lastCursor
  ) {
    edges {
      node {
        __typename
        country
        createdAt
        createdBy {
          source
          workspaceMemberId
          name
          context
          __typename
        }
        deletedAt
        id
        language
        name
        updatedAt
      }
      cursor
      __typename
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
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
          offerId
          candidateFieldValueId
          candidateFieldId
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

export const findWorkspaceMemberProfiles = `query FindManyWorkspaceMemberProfiles($filter: WorkspaceMemberProfileFilterInput, $orderBy: [WorkspaceMemberProfileOrderByInput], $lastCursor: String, $limit: Int) {
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
        phoneNumber
        companyName
        companyDescription
        lastName
        createdAt
        name
        linkedinUrl
        jobTitle
        updatedAt
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
}`;

export const graphQueryToFindManyvideoInterviews = `query FindManyVideoInterviews($filter: VideoInterviewFilterInput, $orderBy: [VideoInterviewOrderByInput], $lastCursor: String, $limit: Int) {
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
            primaryLinkLabel
            primaryLinkUrl
          __typename
        }
        candidate {
          __typename
          id
          name
          position
          stopChat
          peopleId
          startChat
          chatCount
          status
          jobSpecificFields
          jobsId
          createdAt
          source
          campaign
          updatedAt
          engagementStatus
          messagingChannel
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
            primaryLinkLabel
            primaryLinkUrl
            __typename
          }
          resdexNaukriUrl {
            primaryLinkLabel
            primaryLinkUrl
            __typename
          }
          linkedinUrl {
            primaryLinkLabel
            primaryLinkUrl
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
            emails{
              primaryEmail
            }            
            phones{
              primaryPhoneNumber
            }
            linkedinLink{
              primaryLinkLabel
              primaryLinkUrl
              secondaryLinks
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

export const graphqQlToFindManyVideoInterviewQuestionsQuery = `
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

export const fullFindManyObjectsFieldsQuery = `query ObjectMetadataItems {
    objects(paging: { first: 1000 }) {
      edges {
        node {
          id
          dataSourceId
          nameSingular
          namePlural
          labelSingular
          labelPlural
          description
          icon
          isCustom
          isRemote
          isActive
          isSystem
          createdAt
          updatedAt
          labelIdentifierFieldMetadataId
          imageIdentifierFieldMetadataId
          shortcut
          isLabelSyncedWithName
          duplicateCriteria
          indexMetadatas(paging: { first: 100 }) {
            edges {
              node {
                id
                createdAt
                updatedAt
                name
                indexWhereClause
                indexType
                isUnique
                indexFieldMetadatas(paging: { first: 100 }) {
                  edges {
                    node {
                      id
                      createdAt
                      updatedAt
                      order
                      fieldMetadataId
                    }
                  }
                }
              }
            }
          }
          fieldsList {
            id
            type
            name
            label
            description
            icon
            isCustom
            isActive
            isSystem
            isNullable
            isUnique
            createdAt
            updatedAt
            defaultValue
            options
            settings
            isLabelSyncedWithName
            relationDefinition {
              relationId
              direction
              sourceObjectMetadata {
                id
                nameSingular
                namePlural
              }
              sourceFieldMetadata {
                id
                name
              }
              targetObjectMetadata {
                id
                nameSingular
                namePlural
              }
              targetFieldMetadata {
                id
                name
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }`;

export const queryObjectMetadataItems = `query ObjectMetadataItems($objectFilter: ObjectFilter, $fieldFilter: FieldFilter) {
  objects(paging: {first: 1000}, filter: $objectFilter) {
    edges {
      node {
        id
        nameSingular
        namePlural
        labelSingular
        labelPlural
        fields(paging: {first: 1000}, filter: $fieldFilter) {
          edges {
            node {
              name
              id
            }
          }
        }
      }
    }
  }
}`;

export const graphQlTofindManyCandidateEnrichments = `query FindManyCandidateEnrichments($filter: CandidateEnrichmentFilterInput, $orderBy: [CandidateEnrichmentOrderByInput], $lastCursor: String, $limit: Int) {
          candidateEnrichments(
            filter: $filter
            orderBy: $orderBy
            first: $limit
            after: $lastCursor
          ) {
            edges {
              node {
                prompt
                modelName
                createdAt
                fields
                id
                name
                selectedModel
                selectedMetadataFields
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
        prompt {
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
                    source
                    campaign
                    people {
                      id
                      name {
                        firstName
                        lastName
                      }
                    }
                    candidateFieldValues{
                      edges{
                        node{
                            id
                            name
                            candidateFields{
                                name
                                id
                            }
                        }
                      }
                    }
                    clientInterview {
                        edges{
                            node{
                                id
                                name
                                jobId
                                createdAt
                                updatedAt
                                candidateId
                                clientInterviewCompleted
                            }
                        }
                    }
                    whatsappProvider
                    lastEngagementChatControl
                    candConversationStatus
                    jobs {
                       name
                       id
                       isActive
                       jobLocation
                       createdAt
                       updatedAt
                       companyDetails
                       jobCode
                       recruiterId
                       company{
                        name
                        id
                        domainName{
                          primaryLinkUrl
                        }
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
                                primaryLinkUrl
                              }
                          }
                      }
                    }
                    engagementStatus
                    messagingChannel
                    whatsappProvider
                    startVideoInterviewChat
                    startChatCompleted
                    startMeetingSchedulingChat
                    chatCount
                    startMeetingSchedulingChatCompleted
                    startVideoInterviewChat
                    startVideoInterviewChatCompleted
                    remarks
                    phoneNumber{
                      primaryPhoneNumber
                    }
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
                                  primaryLinkUrl
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
                          messageObj
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
        name {
          firstName
          lastName
        }
        linkedinLink{
          primaryLinkLabel
          primaryLinkUrl
          secondaryLinks
        }
        phones{
          primaryPhoneNumber
        }
        emails{
            primaryEmail
        }
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
                phoneNumber{
                  primaryPhoneNumber

                }
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
          source
          campaign
          startChat
          chatCount
          remarks
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
`;

export const graphqlQueryToGetCurrentUser = `query GetCurrentUser {
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
  analyticsTinybirdJwts {
    getWebhookAnalytics
    getPageviewsAnalytics
    getUsersAnalytics
    getServerlessFunctionDuration
    getServerlessFunctionSuccessRate
    getServerlessFunctionErrorCount
    __typename
  }
  onboardingStatus
  workspaceMember {
    ...WorkspaceMemberQueryFragment
    __typename
  }
  workspaceMembers {
    ...WorkspaceMemberQueryFragment
    __typename
  }
  currentUserWorkspace {
    settingsPermissions
    objectRecordsPermissions
    __typename
  }
  currentWorkspace {
    id
    displayName
    logo
    inviteHash
    allowImpersonation
    activationStatus
    isPublicInviteLinkEnabled
    isGoogleAuthEnabled
    isMicrosoftAuthEnabled
    isPasswordAuthEnabled
    subdomain
    hasValidEnterpriseKey
    customDomain
    workspaceUrls {
      subdomainUrl
      customUrl
      __typename
    }
    featureFlags {
      id
      key
      value
      workspaceId
      __typename
    }
    metadataVersion
    currentBillingSubscription {
      id
      status
      interval
      __typename
    }
    billingSubscriptions {
      id
      status
      __typename
    }
    workspaceMembersCount
    __typename
  }
  workspaces {
    workspace {
      id
      logo
      displayName
      subdomain
      customDomain
      workspaceUrls {
        subdomainUrl
        customUrl
        __typename
      }
      __typename
    }
    __typename
  }
  userVars
  __typename
  }

fragment WorkspaceMemberQueryFragment on WorkspaceMember {
  id
  name {
    firstName
    lastName
    __typename
  }
  colorScheme
  avatarUrl
  locale
  userEmail
  timeZone
  dateFormat
  timeFormat
  __typename
  }`;

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

export const graphqlQueryToFindManyCandidateFields = `query FindManyCandidateFields($filter: CandidateFieldFilterInput, $orderBy: [CandidateFieldOrderByInput], $lastCursor: String, $limit: Int) {
    candidateFields(filter: $filter, orderBy: $orderBy, first: $limit, after: $lastCursor) {
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

export const graphqlToFindManyCandidateFieldValues = `query FindManyCandidateFieldValues($filter: CandidateFieldValueFilterInput, $orderBy: [CandidateFieldValueOrderByInput], $lastCursor: String, $limit: Int) {
    candidateFieldValues(filter: $filter, orderBy: $orderBy, first: $limit, after: $lastCursor) {
      edges {
        node {
          __typename
          position
          createdAt
          name
          candidateFields {
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
            messagingChannel
            whatsappProvider
            peopleId
            jobsId
            name
            status
            createdAt
            updatedAt
            source
            campaign
            whatsappProvider
            startChat
            remarks
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
          candidateFieldId
          personId
          videoInterviewTemplateId
          offerId
          cvSentId
          companyId
          videoInterviewResponseId
          candidateFieldValueId
          recruiterInterviewId
        }
      }
    }
    id
    videoInterviewTemplateId
    interviewReviewLink {
      primaryLinkLabel
      primaryLinkUrl
    }
    candidate {
      __typename
      id
      name
      position
      stopChat
      peopleId
      startChat
      remarks
      messagingChannel
      chatCount
      status
      source
      campaign
      jobSpecificFields
      jobsId
      createdAt
      updatedAt
      engagementStatus
      messagingChannel
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
        primaryLinkLabel
        primaryLinkUrl
        __typename
      }
      resdexNaukriUrl {
        primaryLinkLabel
        primaryLinkUrl
        __typename
      }
      linkedinUrl {
        primaryLinkLabel
        primaryLinkUrl
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
        emails{
          primaryEmail
        }            
        phones{
          primaryPhoneNumber
        }
        linkedinLink{
          primaryLinkLabel
          primaryLinkUrl
          secondaryLinks
        }
      }
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
    interviewStarted
    name
    updatedAt
    interviewLink {
      primaryLinkLabel
      primaryLinkUrl
    }
    interviewCompleted
    createdAt
  }
  }
  `;

export const graphqlToFetchAllCandidateData = `
  query FindManyCandidates($lastCursor: String, $limit: Int, $filter: CandidateFilterInput) {
    candidates(after: $lastCursor, first: $limit, filter: $filter) {
        pageInfo {
          hasNextPage
          startCursor
          endCursor
      }
      edges {
        cursor
        node {
          id
          name
          updatedAt
          createdAt
          whatsappProvider
          phoneNumber{
            primaryPhoneNumber
          }
          email{
            primaryEmail
          }
          candConversationStatus
          peopleId
          startVideoInterviewChat
          source
          campaign
          remarks
          messagingChannel
          attachments {
            edges {
              node {
                authorId
                createdAt
                fullPath
                id
              }
            }
          }
          clientInterview {
            edges{
              node{
                id
                name
                jobId
                createdAt
                updatedAt
                clientInterviewCompleted
                candidateId
              }
            }
          }
          lastEngagementChatControl
          startVideoInterviewChat
          startMeetingSchedulingChat
          stopChat
          uniqueStringKey
          hiringNaukriUrl{
            primaryLinkUrl
            primaryLinkLabel
          }
          resdexNaukriUrl{
            primaryLinkUrl
            primaryLinkLabel
          }
          linkedinUrl {
            primaryLinkUrl
            primaryLinkLabel
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
        videoInterview{
            edges{
                node{
                id
                interviewLink{
                  primaryLinkUrl
                }
                createdAt
                updatedAt
                interviewStarted
                interviewCompleted
                videoInterviewTemplate {
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
        candidateFieldValues {
            edges{
              node{
                  id
                  name
                  candidateFields {
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
            linkedinLink {
              primaryLinkLabel
              primaryLinkUrl
              secondaryLinks
            }
            phones {
                primaryPhoneNumber
            }
            emails {
                primaryEmail
            }
            jobTitle
            uniqueStringKey  
            phoneCall {
                edges {
                    node {
                        name
                        id
                        transcript
                        attachments {
                            edges {
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
          remarks
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
                messageObj
                createdAt
                whatsappDeliveryStatus
                id
                name
                recruiterId
                message
                candidateId
                jobsId
                position
                phoneTo
                phoneFrom
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
            companyDetails
            chatFlowOrder
            pathPosition
            createdAt
            updatedAt
            interviewSchedule {
              edges {
                  node {
                      id
                      name
                      createdAt
                      slotsAvailable
                      meetingType
                  }
                }
              }
            company {
              name
              id
              domainName {
                primaryLinkUrl
              }
              descriptionOneliner
            }
          }
        }
      }
    }
  }`;

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
  `;

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
        candidate{
          id
          name
          updatedAt
          createdAt
          whatsappProvider
          remarks
          phoneNumber{
            primaryPhoneNumber
          }
          email{
            primaryEmail
          }
          linkedinUrl{
            primaryLinkUrl
            primaryLinkLabel
          }
          displayPicture{
            primaryLinkUrl
          }
        }
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
`;

export const findOneCandidate = `query FindOneCandidate($objectRecordId: ID!) {
candidate(filter: {id: {eq: $objectRecordId}}) {
  whatsappProvider
  people {
    id
    name {
      firstName
      lastName
    }
    linkedinLink{
      primaryLinkLabel
      primaryLinkUrl
      secondaryLinks
    }
    companyId
    phones{
        primaryPhoneNumber
    }
    emails{
        primaryEmail
    }    id
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
    messagingChannel
    updatedAt
    startChat
    remarks
    startChatCompleted
    startMeetingSchedulingChat
    chatCount
    startMeetingSchedulingChatCompleted
    startVideoInterviewChat
    startVideoInterviewChatCompleted
  }
}
`;

export const findOnePersonQuery = `
  query FindOnePerson($objectRecordId: ID!) {
    person(filter: { id: { eq: $objectRecordId } }) {
      xLink {
        primaryLinkLabel
        primaryLinkUrl
      }
      id
      createdAt
      city
      jobTitle
      name {
        firstName
        lastName
      }
        phones{
            primaryPhoneNumber
        }
        emails{
            primaryEmail
        }      
        linkedinLink {
            primaryLinkLabel
            primaryLinkUrl
      }
      updatedAt
      avatarUrl
      companyId
    }
  }
`;

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
                          messageObj
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
        linkedinLink{
          primaryLinkLabel
          primaryLinkUrl
          secondaryLinks
        }
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



export const getExistingRelationsQuery = `query GetExistingRelations($objectMetadataId: ID!) {
  relations(filter: { 
    or: [
      { fromObjectMetadataId: { eq: $objectMetadataId } },
      { toObjectMetadataId: { eq: $objectMetadataId } }
    ]
  }) {
    edges {
      node {
        fromObjectMetadataId
        toObjectMetadataId
      }
    }
  }
}
`;



export const findManyViewsQuery = `
query FindManyViews($filter: ViewFilterInput, $orderBy: [ViewOrderByInput], $lastCursor: String, $limit: Int) {
  views(filter: $filter, orderBy: $orderBy, first: $limit, after: $lastCursor) {
    edges {
      node {
        __typename
        createdAt
        icon
        id
        isCompact
        kanbanAggregateOperation
        kanbanAggregateOperationFieldMetadataId
        kanbanFieldMetadataId
        key
        name
        objectMetadataId
        position
        type
        updatedAt
        viewFields {
          edges {
            node {
              __typename
              aggregateOperation
              createdAt
              deletedAt
              fieldMetadataId
              id
              isVisible
              position
              size
              updatedAt
              viewId
            }
          }
        }
      }
      cursor
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
    totalCount
  }
}
`;



