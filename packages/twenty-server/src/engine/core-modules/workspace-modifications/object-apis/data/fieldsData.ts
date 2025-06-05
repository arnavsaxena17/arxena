import { FieldInput } from 'twenty-shared';

export function getFieldsData(
  objectsNameIdMap: Record<string, string>,
): FieldInput[] {
  return [
    {
      field: {
        description: '',
        icon: 'IconUsers',
        label: 'Status',
        name: 'status',
        options: [
          {
            color: 'red',
            label: 'Not Interested',
            position: 0,
            value: 'NOT_INTERESTED',
          },
          {
            color: 'green',
            label: 'Interested',
            position: 0,
            value: 'INTERESTED',
          },
          {
            color: 'orange',
            label: 'CV Received',
            position: 0,
            value: 'CV_RECEIVED',
          },
          {
            color: 'turquoise',
            label: 'Not Fit',
            position: 0,
            value: 'NOT_FIT',
          },
          {
            color: 'turquoise',
            label: 'Sourced',
            position: 0,
            value: 'SOURCED',
          },
          {
            color: 'green',
            label: 'Screening',
            position: 0,
            value: 'SCREENING',
          },
          {
            color: 'turquoise',
            label: 'Recruiter Interview',
            position: 1,
            value: 'RECRUITER_INTERVIEW',
          },
          {
            color: 'sky',
            label: 'CV Sent',
            position: 2,
            value: 'CV_SENT',
          },
          {
            color: 'blue',
            label: 'Client Interview',
            position: 3,
            value: 'CLIENT_INTERVIEW',
          },
          {
            color: 'purple',
            label: 'Negotiation',
            position: 4,
            value: 'NEGOTIATION',
          },
        ],
        objectMetadataId: objectsNameIdMap.candidate,
        type: 'SELECT',
      },
    },
    {
      field: {
        description: 'Status of Candidates',
        icon: 'IconUsers',
        label: 'candConversationStatus',
        name: 'candConversationStatus',
        options: [
          {
            color: 'blue',
            label: 'Conversation Closed To Be Contacted',
            position: 0,
            value: 'CONVERSATION_CLOSED_TO_BE_CONTACTED',
          },
          {
            color: 'green',
            label: 'Candidate Is Keen To Chat',
            position: 1,
            value: 'CANDIDATE_IS_KEEN_TO_CHAT',
          },
          {
            color: 'turquoise',
            label: 'Candidate Has Followed Up To Setup Chat',
            position: 2,
            value: 'CANDIDATE_HAS_FOLLOWED_UP_TO_SETUP_CHAT',
          },
          {
            color: 'sky',
            label: 'Candidate Is Reluctant To Discuss Compensation',
            position: 3,
            value: 'CANDIDATE_IS_RELUCTANT_TO_DISCUSS_COMPENSATION',
          },
          {
            color: 'turquoise',
            label: 'Candidate Salary Out of Range',
            position: 4,
            value: 'CANDIDATE_SALARY_OUT_OF_RANGE',
          },
          {
            color: 'turquoise',
            label: 'Candidate Refuses To Relocate',
            position: 5,
            value: 'CANDIDATE_REFUSES_TO_RELOCATE',
          },
          {
            color: 'orange',
            label: 'Shared JD Has Not Responded',
            position: 6,
            value: 'SHARED_JD_HAS_NOT_RESPONDED',
          },
          {
            color: 'turquoise',
            label: 'Stopped Responding On Questions',
            position: 7,
            value: 'STOPPED_RESPONDING_ON_QUESTIONS',
          },
          {
            color: 'red',
            label: 'Candidate Declined Opportunity',
            position: 8,
            value: 'CANDIDATE_DECLINED_OPPORTUNITY',
          },
          {
            color: 'green',
            label: 'Conversation Started Has Not Responded',
            position: 9,
            value: 'CONVERSATION_STARTED_HAS_NOT_RESPONDED',
          },

          {
            color: 'red',
            label: 'Only Added No Conversation',
            position: 10,
            value: 'ONLY_ADDED_NO_CONVERSATION',
          },
        ],
        objectMetadataId: objectsNameIdMap.candidate,
        type: 'SELECT',
      },
    },
    {
      field: {
        description: '',
        label: 'Schedule',
        name: 'schedule',
        objectMetadataId: objectsNameIdMap.recruiterInterview,
        type: 'DATE_TIME',
      },
    },
    {
      field: {
        description: '',
        label: 'Slots Available',
        name: 'slotsAvailable',
        objectMetadataId: objectsNameIdMap.interviewSchedule,
        type: 'RAW_JSON',
      },
    },
    {
      field: {
        description: '',
        label: 'Interview Time',
        name: 'interviewTime',
        objectMetadataId: objectsNameIdMap.clientInterview,
        type: 'RAW_JSON',
      },
    },
    {
      field: {
        description: '',
        label: 'Client Interview Completed',
        name: 'clientInterviewCompleted',
        objectMetadataId: objectsNameIdMap.clientInterview,
        type: 'BOOLEAN',
        defaultValue: false,
      },
    },

    // {
    //     "field": {
    //         "description": "",
    //         "icon": "IconReload",
    //         "label": "Meeting Duration",
    //         "name": "durationMeeting",
    //         "options": [{
    //                 "color": "green",
    //                 "label": "30 mins",
    //                 "position": 0,
    //                 "value": "mins30"
    //             },
    //             {
    //                 "color": "turquoise",
    //                 "label": "45 mins",
    //                 "position": 1,
    //                 "value": "mins45"
    //             },
    //             {
    //                 "color": "sky",
    //                 "label": "1 hour",
    //                 "position": 2,
    //                 "value": "hour1"
    //             },
    //             {
    //                 "color": "sky",
    //                 "label": "1.5 hours",
    //                 "position": 3,
    //                 "value": "hours15"
    //             },
    //             {
    //                 "color": "sky",
    //                 "label": "2 hours",
    //                 "position": 3,
    //                 "value": "hours2"
    //             },
    //         ],
    //         "objectMetadataId": objectsNameIdMap.interviewSchedule,
    //         "type": "SELECT"
    //     }

    // },
    {
      field: {
        description: '',
        icon: 'IconVideoCall',
        label: 'Meeting Type',
        name: 'meetingType',
        options: [
          {
            color: 'green',
            label: 'In Person',
            position: 0,
            value: 'inPerson',
          },
          {
            color: 'turquoise',
            label: 'Online',
            position: 1,
            value: 'online',
          },
          {
            color: 'sky',
            label: 'Walk In',
            position: 2,
            value: 'walkIn',
          },
        ],
        objectMetadataId: objectsNameIdMap.interviewSchedule,
        type: 'SELECT',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconUserCircle',
        label: 'Workspace Member Type',
        name: 'typeWorkspaceMember',
        options: [
          {
            color: 'green',
            label: 'Candidate Type',
            position: 0,
            value: 'candidateType',
          },
          {
            color: 'turquoise',
            label: 'Client Type',
            position: 1,
            value: 'clientType',
          },
          {
            color: 'sky',
            label: 'Recruiter Type',
            position: 2,
            value: 'recruiterType',
          },
        ],
        objectMetadataId: objectsNameIdMap.workspaceMemberProfile,
        type: 'SELECT',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconPhoneCall',
        label: 'Call Type',
        name: 'callType',
        options: [
          {
            color: 'green',
            label: 'Incoming',
            position: 0,
            value: 'INCOMING',
          },
          {
            color: 'turquoise',
            label: 'Outgoing',
            position: 1,
            value: 'OUTGOING',
          },
          {
            color: 'sky',
            label: 'Missed',
            position: 2,
            value: 'MISSED',
          },
          {
            color: 'sky',
            label: 'Rejected',
            position: 3,
            value: 'REJECTED',
          },
        ],
        objectMetadataId: objectsNameIdMap.phoneCall,
        type: 'SELECT',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconMessage',
        label: 'Text Message Type',
        name: 'textMessageType',
        options: [
          {
            color: 'green',
            label: 'Incoming',
            position: 0,
            value: 'INCOMING',
          },
          {
            color: 'turquoise',
            label: 'Outgoing',
            position: 1,
            value: 'OUTGOING',
          },
        ],
        objectMetadataId: objectsNameIdMap.textMessage,
        type: 'SELECT',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconFileText',
        label: 'Transcription',
        name: 'transcription',
        objectMetadataId: objectsNameIdMap.recruiterInterview,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconChartBar',
        label: 'Analysis',
        name: 'analysis',
        objectMetadataId: objectsNameIdMap.recruiterInterview,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconCalendar',
        label: 'Date of Joining',
        name: 'dateofJoining',
        objectMetadataId: objectsNameIdMap.offer,
        type: 'DATE_TIME',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconNumber',
        label: 'Number of Days',
        name: 'numberofDays',
        objectMetadataId: objectsNameIdMap.offer,
        type: 'NUMBER',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconPhone',
        label: 'From Phone',
        name: 'phoneFrom',
        objectMetadataId: objectsNameIdMap.whatsappMessage,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconMail',
        label: 'Email',
        name: 'email',
        objectMetadataId: objectsNameIdMap.workspaceMemberProfile,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconLinkedin',
        label: 'Linkedin URL',
        name: 'linkedinUrl',
        objectMetadataId: objectsNameIdMap.workspaceMemberProfile,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconPhone',
        label: 'Phone Number',
        name: 'phoneNumber',
        objectMetadataId: objectsNameIdMap.workspaceMemberProfile,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconBuilding',
        label: 'Company Name',
        name: 'companyName',
        objectMetadataId: objectsNameIdMap.workspaceMemberProfile,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconFileDescription',
        label: 'Company Description',
        name: 'companyDescription',
        objectMetadataId: objectsNameIdMap.workspaceMemberProfile,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconUser',
        label: 'First Name',
        name: 'firstName',
        objectMetadataId: objectsNameIdMap.workspaceMemberProfile,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconBriefcase',
        label: 'Job Title',
        name: 'jobTitle',
        objectMetadataId: objectsNameIdMap.workspaceMemberProfile,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconUser',
        label: 'Last Name',
        name: 'lastName',
        objectMetadataId: objectsNameIdMap.workspaceMemberProfile,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconCurrencyDollar',
        label: 'Salary',
        name: 'salary',
        objectMetadataId: objectsNameIdMap.person,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconPhone',
        label: 'To Phone',
        name: 'phoneTo',
        objectMetadataId: objectsNameIdMap.whatsappMessage,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconMessage',
        label: 'Message',
        name: 'message',
        objectMetadataId: objectsNameIdMap.whatsappMessage,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconMessage',
        label: 'Message',
        name: 'message',
        objectMetadataId: objectsNameIdMap.textMessage,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconClockHour3',
        label: 'Duration',
        name: 'duration',
        objectMetadataId: objectsNameIdMap.phoneCall,
        type: 'NUMBER',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconPhone',
        label: 'phoneNumber',
        name: 'phoneNumber',
        objectMetadataId: objectsNameIdMap.phoneCall,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconFileText',
        label: 'Transcript',
        name: 'transcript',
        objectMetadataId: objectsNameIdMap.phoneCall,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconPhone',
        label: 'phoneNumber',
        name: 'phoneNumber',
        objectMetadataId: objectsNameIdMap.textMessage,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconCalendar',
        label: 'TimeStamp',
        name: 'timestamp',
        objectMetadataId: objectsNameIdMap.phoneCall,
        type: 'DATE_TIME',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconCalendar',
        label: 'TimeStamp',
        name: 'timestamp',
        objectMetadataId: objectsNameIdMap.textMessage,
        type: 'DATE_TIME',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconJson',
        label: 'messageObj',
        name: 'messageObj',
        objectMetadataId: objectsNameIdMap.whatsappMessage,
        type: 'RAW_JSON',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconJson',
        label: 'messageObjWithTimeStamp',
        name: 'messageObjWithTimeStamp',
        objectMetadataId: objectsNameIdMap.whatsappMessage,
        type: 'RAW_JSON',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconBrandWhatsapp',
        label: 'whatsappProvider',
        name: 'whatsappProvider',
        objectMetadataId: objectsNameIdMap.whatsappMessage,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconId',
        label: 'whatsappMessageId',
        name: 'whatsappMessageId',
        objectMetadataId: objectsNameIdMap.whatsappMessage,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconCheck',
        label: 'whatsappDeliveryStatus',
        name: 'whatsappDeliveryStatus',
        objectMetadataId: objectsNameIdMap.whatsappMessage,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconMessageCircle',
        label: 'typeOfMessage',
        name: 'typeOfMessage',
        objectMetadataId: objectsNameIdMap.whatsappMessage,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: 'lastEngagementChatControl',
        icon: 'IconMessageDots',
        label: 'lastEngagementChatControl',
        name: 'lastEngagementChatControl',
        objectMetadataId: objectsNameIdMap.whatsappMessage,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconAudio',
        label: 'audioFilePath',
        name: 'audioFilePath',
        objectMetadataId: objectsNameIdMap.whatsappMessage,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconToggleLeft',
        label: 'isActive',
        name: 'isActive',
        objectMetadataId: objectsNameIdMap.job,
        type: 'BOOLEAN',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconMapPin',
        label: 'jobLocation',
        name: 'jobLocation',
        objectMetadataId: objectsNameIdMap.job,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconTable',
        label: 'Google Sheet Id',
        name: 'googleSheetId',
        objectMetadataId: objectsNameIdMap.job,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconBarcode',
        label: 'jobCode',
        name: 'jobCode',
        objectMetadataId: objectsNameIdMap.job,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconSearch',
        label: 'Search Name',
        name: 'searchName',
        objectMetadataId: objectsNameIdMap.job,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconUserCircle',
        label: 'Reports To',
        name: 'reportsTo',
        objectMetadataId: objectsNameIdMap.job,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconUsers',
        label: 'Reportees',
        name: 'reportees',
        objectMetadataId: objectsNameIdMap.job,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconClock',
        label: 'Years of Experience',
        name: 'yearsOfExperience',
        objectMetadataId: objectsNameIdMap.job,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconCurrencyDollar',
        label: 'Salary Bracket',
        name: 'salaryBracket',
        objectMetadataId: objectsNameIdMap.job,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconBuilding',
        label: 'Company Details',
        name: 'companyDetails',
        objectMetadataId: objectsNameIdMap.job,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconUserSearch',
        label: 'Talent Considerations',
        name: 'talentConsiderations',
        objectMetadataId: objectsNameIdMap.job,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconList',
        label: 'Specific Criteria',
        name: 'specificCriteria',
        objectMetadataId: objectsNameIdMap.job,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconFileDescription',
        label: 'Description',
        name: 'description',
        objectMetadataId: objectsNameIdMap.job,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconRoute',
        label: 'pathPosition',
        name: 'pathPosition',
        objectMetadataId: objectsNameIdMap.job,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconText',
        label: 'candidateFieldType',
        name: 'candidateFieldType',
        objectMetadataId: objectsNameIdMap.candidateField,
        type: 'TEXT',
      },
    },
    // {
    //   field: {
    //     description: '',
    //     icon: 'IconText',
    //     label: 'fieldValueString',
    //     name: 'fieldValueString',
    //     objectMetadataId: objectsNameIdMap.candidateFieldValue,
    //     type: 'TEXT',
    //   },
    // },
    // {
    //   field: {
    //     description: '',
    //     icon: 'IconNumber',
    //     label: 'fieldValueNumber',
    //     name: 'fieldValueNumber',
    //     objectMetadataId: objectsNameIdMap.candidateFieldValue,
    //     type: 'NUMBER',
    //   },
    // },
    // {
    //   field: {
    //     description: '',
    //     icon: 'IconToggleLeft',
    //     label: 'fieldValueBoolean',
    //     name: 'fieldValueBoolean',
    //     objectMetadataId: objectsNameIdMap.candidateFieldValue,
    //     type: 'BOOLEAN',
    //   },
    // },
    // {
    //   field: {
    //     description: '',
    //     icon: 'IconJson',
    //     label: 'fieldValueJSON',
    //     name: 'fieldValueJSON',
    //     objectMetadataId: objectsNameIdMap.candidateFieldValue,
    //     type: 'RAW_JSON',
    //   },
    // },
    {
      field: {
        description: '',
        icon: 'IconShoppingCart',
        label: 'isProfilePurchased',
        name: 'isProfilePurchased',
        objectMetadataId: objectsNameIdMap.candidate,
        type: 'BOOLEAN',
        defaultValue: false,
      },
    },
    {
      field: {
        description: '',
        icon: 'IconMail',
        label: 'email',
        name: 'email',
        objectMetadataId: objectsNameIdMap.candidate,
        type: 'EMAILS',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconPhone',
        label: 'phoneNumber',
        name: 'phoneNumber',
        objectMetadataId: objectsNameIdMap.candidate,
        type: 'PHONES',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconUserCheck',
        label: 'engagementStatus',
        name: 'engagementStatus',
        objectMetadataId: objectsNameIdMap.candidate,
        type: 'BOOLEAN',
        defaultValue: false,
      },
    },
    {
      field: {
        description: '',
        icon: 'IconMessageChatbot',
        label: 'startChat',
        name: 'startChat',
        objectMetadataId: objectsNameIdMap.candidate,
        type: 'BOOLEAN',
        defaultValue: false,
      },
    },
    {
      field: {
        description: '',
        icon: 'IconMessageCheck',
        label: 'startChatCompleted',
        name: 'startChatCompleted',
        objectMetadataId: objectsNameIdMap.candidate,
        type: 'BOOLEAN',
        defaultValue: false,
      },
    },
    {
      field: {
        description: '',
        icon: 'IconVideo',
        label: 'startVideoInterviewChat',
        name: 'startVideoInterviewChat',
        objectMetadataId: objectsNameIdMap.candidate,
        type: 'BOOLEAN',
        defaultValue: false,
      },
    },
    {
      field: {
        description: '',
        icon: 'IconMessageNumber',
        label: 'chatCount',
        name: 'chatCount',
        objectMetadataId: objectsNameIdMap.candidate,
        type: 'NUMBER',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconCalendarTime',
        label: 'startMeetingSchedulingChat',
        name: 'startMeetingSchedulingChat',
        objectMetadataId: objectsNameIdMap.candidate,
        type: 'BOOLEAN',
        defaultValue: false,
      },
    },
    {
      field: {
        description: '',
        icon: 'IconCalendarCheck',
        label: 'startMeetingSchedulingChatCompleted',
        name: 'startMeetingSchedulingChatCompleted',
        objectMetadataId: objectsNameIdMap.candidate,
        type: 'BOOLEAN',
        defaultValue: false,
      },
    },
    {
      field: {
        description:
          'This will stop the chatbot from chatting with the candidates',
        icon: 'IconHandStop',
        label: 'stopChat',
        name: 'stopChat',
        objectMetadataId: objectsNameIdMap.candidate,
        type: 'BOOLEAN',
        defaultValue: false,
      },
    },
    {
      field: {
        description: '',
        icon: 'IconBrandWhatsapp',
        label: 'whatsappProvider',
        name: 'whatsappProvider',
        objectMetadataId: objectsNameIdMap.candidate,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconPhone',
        label: 'Remarks',
        name: 'remarks',
        objectMetadataId: objectsNameIdMap.candidate,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: '',
        icon: 'IconVideoCheck',
        label: 'startVideoInterviewChatCompleted',
        // "name": "isVideoInterviewCompleted",
        name: 'startVideoInterviewChatCompleted',
        objectMetadataId: objectsNameIdMap.candidate,
        type: 'BOOLEAN',
        defaultValue: false,
      },
    },
    {
      field: {
        description: '',
        label: 'lastEngagementChatControl',
        name: 'lastEngagementChatControl',
        objectMetadataId: objectsNameIdMap.candidate,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: '',
        label: 'Job specific fields',
        name: 'jobSpecificFields',
        objectMetadataId: objectsNameIdMap.candidate,
        type: 'RAW_JSON',
      },
    },

    {
      field: {
        description: '',
        label: 'chatFlowOrder',
        name: 'chatFlowOrder',
        objectMetadataId: objectsNameIdMap.job,
        type: 'RAW_JSON',
      },
    },

    {
      field: {
        description: '',
        label: 'shortlistObj',
        name: 'shortlistObj',
        objectMetadataId: objectsNameIdMap.candidate,
        type: 'RAW_JSON',
      },
    },
    {
      field: {
        description: '',
        label: 'descriptionOneliner',
        name: 'descriptionOneliner',
        objectMetadataId: objectsNameIdMap.company,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: '',
        label: 'remindCandidateAtTimestamp',
        name: 'remindCandidateAtTimestamp',
        objectMetadataId: objectsNameIdMap.candidateReminder,
        type: 'DATE_TIME',
      },
    },
    {
      field: {
        description: '',
        label: 'remindCandidateDuration',
        name: 'remindCandidateDuration',
        objectMetadataId: objectsNameIdMap.candidateReminder,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: '',
        label: 'isReminderActive',
        name: 'isReminderActive',
        objectMetadataId: objectsNameIdMap.candidateReminder,
        type: 'BOOLEAN',
        defaultValue: false,
      },
    },
    {
      field: {
        description: '',
        label: 'selectedMetadataFields',
        name: 'selectedMetadataFields',
        objectMetadataId: objectsNameIdMap.candidateEnrichment,
        type: 'RAW_JSON',
      },
    },
    {
      field: {
        description: '',
        label: 'modelName',
        name: 'modelName',
        objectMetadataId: objectsNameIdMap.candidateEnrichment,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: '',
        label: 'filterDescription',
        name: 'filterDescription',
        objectMetadataId: objectsNameIdMap.candidateEnrichment,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: '',
        label: 'fields',
        name: 'fields',
        objectMetadataId: objectsNameIdMap.candidateEnrichment,
        type: 'RAW_JSON',
      },
    },
    {
      field: {
        description: '',
        label: 'sampleJson',
        name: 'sampleJson',
        objectMetadataId: objectsNameIdMap.candidateEnrichment,
        type: 'RAW_JSON',
      },
    },
    {
      field: {
        description: '',
        label: 'Prompt',
        name: 'prompt',
        objectMetadataId: objectsNameIdMap.prompt,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: '',
        label: 'prompt',
        name: 'prompt',
        objectMetadataId: objectsNameIdMap.candidateEnrichment,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: '',
        label: 'selectedModel',
        name: 'selectedModel',
        objectMetadataId: objectsNameIdMap.candidateEnrichment,
        options: [
          {
            color: 'green',
            label: 'gpt-3.5-turbo',
            position: 0,
            value: 'gpt35turbo',
          },
          {
            color: 'turquoise',
            label: 'gpt-4o',
            position: 1,
            value: 'gpt4o',
          },
          {
            color: 'turquoise',
            label: 'gpt-4o-mini',
            position: 1,
            value: 'gpt4omini',
          },
        ],
        type: 'SELECT',
      },
    },
    {
      field: {
        description: '',
        label: 'Arxena Job Id',
        name: 'arxenaSiteId',
        objectMetadataId: objectsNameIdMap.job,
        type: 'TEXT',
      },
    },

    {
      field: {
        description: '',
        icon: 'IconFlag',
        label: 'Country',
        name: 'country',
        options: [
          {
            color: 'green',
            label: 'India',
            position: 0,
            value: 'IN',
          },
          {
            color: 'turquoise',
            label: 'United States',
            position: 1,
            value: 'US',
          },
          {
            color: 'sky',
            label: 'United Kingdom',
            position: 2,
            value: 'GB',
          },
          {
            color: 'blue',
            label: 'Japan',
            position: 3,
            value: 'JP',
          },
          {
            color: 'purple',
            label: 'France',
            position: 4,
            value: 'FR',
          },
        ],
        objectMetadataId: objectsNameIdMap.videoInterviewModel,
        type: 'SELECT',
      },
    },

    {
      field: {
        description: '',
        icon: 'IconLanguage',
        label: 'Language',
        name: 'language',
        options: [
          {
            color: 'green',
            label: 'English (United States)',
            position: 0,
            value: 'ENGLISH_UNITED_STATES',
          },
          {
            color: 'turquoise',
            label: 'English (United Kingdom)',
            position: 1,
            value: 'ENGLISH_UNITED_KINGDOM',
          },
          {
            color: 'sky',
            label: 'Hindi',
            position: 2,
            value: 'HINDI',
          },
          {
            color: 'blue',
            label: 'Japanese',
            position: 3,
            value: 'JAPANESE',
          },
          {
            color: 'purple',
            label: 'French',
            position: 4,
            value: 'FRENCH',
          },
        ],
        objectMetadataId: objectsNameIdMap.videoInterviewModel,
        type: 'SELECT',
      },
    },
    {
      field: {
        description: 'Additional Points to be added in introduction',
        icon: 'IconAbc',
        label: 'Introduction',
        name: 'introduction',
        objectMetadataId: objectsNameIdMap.videoInterviewTemplate,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: 'Additional Instructions',
        icon: 'IconAbc',
        label: 'Instructions',
        name: 'instructions',
        objectMetadataId: objectsNameIdMap.videoInterviewTemplate,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: 'Video or Text based Interview',
        icon: 'IconAdjustmentsQuestion',
        label: 'Question Type',
        name: 'questionType',
        options: [
          {
            color: 'green',
            label: 'Video',
            position: 0,
            value: 'VIDEO',
          },
          {
            color: 'turquoise',
            label: 'Test (No Model)',
            position: 1,
            value: 'TEXT',
          },
        ],
        objectMetadataId: objectsNameIdMap.videoInterviewQuestion,
        type: 'SELECT',
      },
    },

    {
      field: {
        description: '',
        icon: 'IconCameraQuestion',
        label: 'Answer Type',
        name: 'answerType',
        options: [
          {
            color: 'green',
            label: 'Video (Real Time Recording)',
            position: 0,
            value: 'VIDEO',
          },
          {
            color: 'turquoise',
            label: 'Test (No Recording)',
            position: 1,
            value: 'TEXT',
          },
        ],
        objectMetadataId: objectsNameIdMap.videoInterviewQuestion,
        type: 'SELECT',
      },
    },

    {
      field: {
        description: 'Time Limit of Recording',
        icon: 'IconTimeDuration30',
        label: 'Time Limit',
        name: 'timeLimit',
        objectMetadataId: objectsNameIdMap.videoInterviewQuestion,
        type: 'NUMBER',
      },
    },

    {
      field: {
        description: 'The Question',
        icon: 'IconQuestion',
        label: 'Question Value',
        name: 'questionValue',
        objectMetadataId: objectsNameIdMap.videoInterviewQuestion,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: 'No. of Retakes allowed in case of answer type video',
        icon: 'IconReload',
        label: 'Retakes',
        name: 'retakes',
        options: [
          {
            color: 'green',
            label: '0',
            position: 0,
            value: 'ZERO',
          },
          {
            color: 'turquoise',
            label: '1',
            position: 1,
            value: 'ONE',
          },
          {
            color: 'sky',
            label: '2',
            position: 2,
            value: 'TWO',
          },
        ],
        objectMetadataId: objectsNameIdMap.videoInterviewQuestion,
        type: 'SELECT',
      },
    },

    {
      field: {
        description: 'Whether the candidate has started responding or not',
        icon: 'IconLocationQuestion',
        label: 'Started Responding',
        name: 'startedResponding',
        objectMetadataId: objectsNameIdMap.videoInterviewResponse,
        type: 'BOOLEAN',
        defaultValue: false,
      },
    },
    {
      field: {
        description: 'Whether the canadidate has completed responding or not',
        icon: 'IconLocationCheck',
        label: 'Completed Response',
        name: 'completedResponse',
        objectMetadataId: objectsNameIdMap.videoInterviewResponse,
        type: 'BOOLEAN',
        defaultValue: false,
      },
    },
    {
      field: {
        description: 'Total Time',
        icon: 'IconDeviceWatchPause',
        label: 'Timer',
        name: 'timer',
        objectMetadataId: objectsNameIdMap.videoInterviewResponse,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: 'Time Adherence',
        icon: 'IconTimeDuration30',
        label: 'Time Limit Adherence',
        name: 'timeLimitAdherence',
        objectMetadataId: objectsNameIdMap.videoInterviewResponse,
        type: 'BOOLEAN',
        defaultValue: false,
      },
    },

    {
      field: {
        description: 'Transcript of the Response',
        icon: 'IconFileTextAI',
        label: 'Transcript',
        name: 'transcript',
        objectMetadataId: objectsNameIdMap.videoInterviewResponse,
        type: 'TEXT',
      },
    },

    {
      field: {
        description: 'Feedback for the Response',
        icon: 'IconPencilStar',
        label: 'Feedback',
        name: 'feedback',
        objectMetadataId: objectsNameIdMap.videoInterviewResponse,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: 'Shortlists for Client',
        icon: 'IconInputSearch',
        label: 'Full Name',
        name: 'fullName',
        objectMetadataId: objectsNameIdMap.shortlist,
        type: 'TEXT',
      },
    },

    {
      field: {
        description: 'Shortlists for Client',
        icon: 'IconInputSearch',
        label: 'Age',
        name: 'age',
        objectMetadataId: objectsNameIdMap.shortlist,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: 'Shortlists for Client',
        icon: 'IconInputSearch',
        label: 'Years of Experience',
        name: 'yearsOfExperience',
        objectMetadataId: objectsNameIdMap.shortlist,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: 'Shortlists for Client',
        icon: 'IconInputSearch',
        label: 'Educational Qualifications',
        name: 'educationalQualifications',
        objectMetadataId: objectsNameIdMap.shortlist,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: 'Shortlists for Client',
        icon: 'IconInputSearch',
        label: 'University College',
        name: 'universityCollege',
        objectMetadataId: objectsNameIdMap.shortlist,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: 'Shortlists for Client',
        icon: 'IconInputSearch',
        label: 'Current Job Title',
        name: 'currentJobTitle',
        objectMetadataId: objectsNameIdMap.shortlist,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: 'Shortlists for Client',
        icon: 'IconInputSearch',
        label: 'Current Company',
        name: 'currentCompany',
        objectMetadataId: objectsNameIdMap.shortlist,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: 'Shortlists for Client',
        icon: 'IconInputSearch',
        label: 'Current Location',
        name: 'currentLocation',
        objectMetadataId: objectsNameIdMap.shortlist,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: 'Shortlists for Client',
        icon: 'IconInputSearch',
        label: 'Current Role Description',
        name: 'currentRoleDescription',
        objectMetadataId: objectsNameIdMap.shortlist,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: 'Shortlists for Client',
        icon: 'IconInputSearch',
        label: 'Reports To',
        name: 'reportsTo',
        objectMetadataId: objectsNameIdMap.shortlist,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: 'Shortlists for Client',
        icon: 'IconInputSearch',
        label: 'Functions Reporting To',
        name: 'functionsReportingTo',
        objectMetadataId: objectsNameIdMap.shortlist,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: 'Shortlists for Client',
        icon: 'IconInputSearch',
        label: 'reason For Leaving',
        name: 'reasonForLeaving',
        objectMetadataId: objectsNameIdMap.shortlist,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: 'Shortlists for Client',
        icon: 'IconInputSearch',
        label: 'Current Salary',
        name: 'currentSalary',
        objectMetadataId: objectsNameIdMap.shortlist,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: 'Shortlists for Client',
        icon: 'IconInputSearch',
        label: 'Expected Salary',
        name: 'expectedSalary',
        objectMetadataId: objectsNameIdMap.shortlist,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: 'Shortlists for Client',
        icon: 'IconInputSearch',
        label: 'Notice Period',
        name: 'noticePeriod',
        objectMetadataId: objectsNameIdMap.shortlist,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: 'uniqueStringKey for the person',
        icon: 'IconPencilStar',
        label: 'uniqueStringKey',
        name: 'uniqueStringKey',
        objectMetadataId: objectsNameIdMap.person,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: 'uniqueStringKey for the candidate',
        icon: 'IconPencilStar',
        label: 'uniqueStringKey',
        name: 'uniqueStringKey',
        objectMetadataId: objectsNameIdMap.candidate,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: 'source for the candidate',
        icon: 'IconPencilStar',
        label: 'source',
        name: 'source',
        objectMetadataId: objectsNameIdMap.candidate,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: 'campaign for the candidate',
        icon: 'IconPencilStar',
        label: 'campaign',
        name: 'campaign',
        objectMetadataId: objectsNameIdMap.candidate,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: 'Messaging Channel',
        icon: 'IconMessageCircle',
        label: 'Messaging Channel',
        name: 'messagingChannel',
        objectMetadataId: objectsNameIdMap.candidate,
        type: 'TEXT',
      },
    },
    {
      field: {
        description: 'Link for Candidate Tracker Google Sheet',
        label: 'Google Sheet Url',
        name: 'googleSheetUrl',
        objectMetadataId: objectsNameIdMap.job,
        type: 'LINKS',
      },
    },
    {
      field: {
        description: 'Link Shared with the candidate',
        icon: 'IconLink',
        label: 'Interview Link',
        name: 'interviewLink',
        objectMetadataId: objectsNameIdMap.videoInterview,
        type: 'LINKS',
      },
    },
    {
      field: {
        description: 'Link with Interview Review',
        icon: 'IconLink',
        label: 'Interview Review Link',
        name: 'interviewReviewLink',
        objectMetadataId: objectsNameIdMap.videoInterview,
        type: 'LINKS',
      },
    },
    {
      field: {
        description: 'Hiring Naukri URL',
        icon: 'IconLink',
        label: 'hiringNaukriUrl',
        name: 'hiringNaukriUrl',
        objectMetadataId: objectsNameIdMap.candidate,
        type: 'LINKS',
      },
    },
    {
      field: {
        description: 'Resdex Naukri URL',
        icon: 'IconLink',
        label: 'resdexNaukriUrl',
        name: 'resdexNaukriUrl',
        objectMetadataId: objectsNameIdMap.candidate,
        type: 'LINKS',
      },
    },
    {
      field: {
        description: 'LinkedIn URL',
        icon: 'IconLink',
        label: 'linkedinUrl',
        name: 'linkedinUrl',
        objectMetadataId: objectsNameIdMap.candidate,
        type: 'LINKS',
      },
    },
    {
      field: {
        description: 'Display Picture URL',
        icon: 'IconLink',
        label: 'displayPicture',
        name: 'displayPicture',
        objectMetadataId: objectsNameIdMap.candidate,
        type: 'LINKS',
      },
    },
    {
      field: {
        description: 'Display Picture URL',
        icon: 'IconLink',
        label: 'displayPicture',
        name: 'displayPicture',
        objectMetadataId: objectsNameIdMap.person,
        type: 'LINKS',
      },
    },
    {
      field: {
        description: 'Interview Started or Not',
        icon: 'IconAdjustmentsQuestion',
        label: 'Interview Started',
        name: 'interviewStarted',
        objectMetadataId: objectsNameIdMap.videoInterview,
        type: 'BOOLEAN',
        defaultValue: false,
      },
    },
    {
      field: {
        description: 'Interview Completed or Not',
        icon: 'IconAdjustmentsCheck',
        label: 'Interview Completed',
        name: 'interviewCompleted',
        objectMetadataId: objectsNameIdMap.videoInterview,
        type: 'BOOLEAN',
        defaultValue: false,
      },
    },
  ];
}
