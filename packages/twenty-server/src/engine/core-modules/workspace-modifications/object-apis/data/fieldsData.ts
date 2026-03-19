import { FieldInput } from 'twenty-shared';

import { getObjectsToExclude } from './objectsData';

type FieldWithObject = {
  objectName: string;
  field: NonNullable<FieldInput>['field'];
};

export function getFieldsData(
  objectsNameIdMap: Record<string, string>,
  isOrgChartEnabled?: boolean,
): FieldInput[] {
  const objectsToExclude = getObjectsToExclude(isOrgChartEnabled);
  const allFields: FieldWithObject[] = [
    {
      objectName: 'candidate',
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
      objectName: 'candidate',
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
      objectName: 'recruiterInterview',
      field: {
        description: '',
        label: 'Schedule',
        name: 'schedule',
        objectMetadataId: objectsNameIdMap.recruiterInterview,
        type: 'DATE_TIME',
      },
    },
    {
      objectName: 'interviewSchedule',
      field: {
        description: '',
        label: 'Slots Available',
        name: 'slotsAvailable',
        objectMetadataId: objectsNameIdMap.interviewSchedule,
        type: 'RAW_JSON',
      },
    },
    {
      objectName: 'clientInterview',
      field: {
        description: '',
        label: 'Interview Time',
        name: 'interviewTime',
        objectMetadataId: objectsNameIdMap.clientInterview,
        type: 'RAW_JSON',
      },
    },
    {
      objectName: 'clientInterview',
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
      objectName: 'interviewSchedule',
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
      objectName: 'workspaceMemberProfile',
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
      objectName: 'phoneCall',
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
      objectName: 'textMessage',
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
      objectName: 'recruiterInterview',
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
      objectName: 'recruiterInterview',
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
      objectName: 'offer',
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
      objectName: 'offer',
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
      objectName: 'whatsappMessage',
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
      objectName: 'workspaceMemberProfile',
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
      objectName: 'workspaceMemberProfile',
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
      objectName: 'workspaceMemberProfile',
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
      objectName: 'workspaceMemberProfile',
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
      objectName: 'workspaceMemberProfile',
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
      objectName: 'workspaceMemberProfile',
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
      objectName: 'workspaceMemberProfile',
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
      objectName: 'workspaceMemberProfile',
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
      objectName: 'workspaceMemberProfile',
      field: {
        description: 'Unipile account ID for LinkedIn (org chart, search)',
        icon: 'IconLinkedin',
        label: 'LinkedIn Unipile Account ID',
        name: 'linkedinUnipileAccountId',
        objectMetadataId: objectsNameIdMap.workspaceMemberProfile,
        type: 'TEXT',
      },
    },
    {
      objectName: 'workspaceMemberProfile',
      field: {
        description: 'Unipile account ID for WhatsApp',
        icon: 'IconPhone',
        label: 'WhatsApp Unipile Account ID',
        name: 'whatsappUnipileAccountId',
        objectMetadataId: objectsNameIdMap.workspaceMemberProfile,
        type: 'TEXT',
      },
    },
    {
      objectName: 'workspaceMemberProfile',
      field: {
        description: 'If true, keep LinkedIn connected for engagement (never evict from pool)',
        icon: 'IconLink',
        label: 'Keep LinkedIn Connected',
        name: 'keepLinkedinConnected',
        objectMetadataId: objectsNameIdMap.workspaceMemberProfile,
        type: 'BOOLEAN',
      },
    },
    {
      objectName: 'person',
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
      objectName: 'whatsappMessage',
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
      objectName: 'whatsappMessage',
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
      objectName: 'textMessage',
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
      objectName: 'phoneCall',
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
      objectName: 'phoneCall',
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
      objectName: 'phoneCall',
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
      objectName: 'textMessage',
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
      objectName: 'phoneCall',
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
      objectName: 'textMessage',
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
      objectName: 'whatsappMessage',
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
      objectName: 'whatsappMessage',
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
      objectName: 'whatsappMessage',
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
      objectName: 'whatsappMessage',
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
      objectName: 'whatsappMessage',
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
      objectName: 'whatsappMessage',
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
      objectName: 'whatsappMessage',
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
      objectName: 'whatsappMessage',
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
      objectName: 'job',
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
      objectName: 'job',
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
      objectName: 'job',
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
      objectName: 'job',
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
      objectName: 'job',
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
      objectName: 'job',
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
      objectName: 'job',
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
      objectName: 'job',
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
      objectName: 'job',
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
      objectName: 'job',
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
      objectName: 'job',
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
      objectName: 'job',
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
      objectName: 'job',
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
      objectName: 'job',
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
      objectName: 'candidateField',
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
    //     },
    {
      objectName: 'candidate',
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
      objectName: 'candidate',
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
      objectName: 'candidate',
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
      objectName: 'candidate',
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
      objectName: 'candidate',
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
      objectName: 'candidate',
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
      objectName: 'candidate',
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
      objectName: 'candidate',
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
      objectName: 'candidate',
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
      objectName: 'candidate',
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
      objectName: 'candidate',
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
      objectName: 'candidate',
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
      objectName: 'candidate',
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
      objectName: 'candidate',
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
      objectName: 'candidate',
      field: {
        description: '',
        label: 'lastEngagementChatControl',
        name: 'lastEngagementChatControl',
        objectMetadataId: objectsNameIdMap.candidate,
        type: 'TEXT',
      },
    },
    {
      objectName: 'candidate',
      field: {
        description: '',
        label: 'Job specific fields',
        name: 'jobSpecificFields',
        objectMetadataId: objectsNameIdMap.candidate,
        type: 'RAW_JSON',
      },
    },

    {
      objectName: 'job',
      field: {
        description: '',
        label: 'chatFlowOrder',
        name: 'chatFlowOrder',
        objectMetadataId: objectsNameIdMap.job,
        type: 'RAW_JSON',
      },
    },
    {
      objectName: 'job',
      field: {
        description: 'Delay in minutes after last message before processing engagement from the queue. Default 2.',
        label: 'Engagement processing delay (minutes)',
        name: 'engagementProcessingDelayMinutes',
        objectMetadataId: objectsNameIdMap.job,
        type: 'NUMBER',
        defaultValue: 2,
      },
    },

    {
      objectName: 'candidate',
      field: {
        description: '',
        label: 'shortlistObj',
        name: 'shortlistObj',
        objectMetadataId: objectsNameIdMap.candidate,
        type: 'RAW_JSON',
      },
    },
    {
      objectName: 'company',
      field: {
        description: '',
        label: 'descriptionOneliner',
        name: 'descriptionOneliner',
        objectMetadataId: objectsNameIdMap.company,
        type: 'TEXT',
      },
    },
    {
      objectName: 'candidateReminder',
      field: {
        description: '',
        label: 'remindCandidateAtTimestamp',
        name: 'remindCandidateAtTimestamp',
        objectMetadataId: objectsNameIdMap.candidateReminder,
        type: 'DATE_TIME',
      },
    },
    {
      objectName: 'candidateReminder',
      field: {
        description: '',
        label: 'remindCandidateDuration',
        name: 'remindCandidateDuration',
        objectMetadataId: objectsNameIdMap.candidateReminder,
        type: 'TEXT',
      },
    },
    {
      objectName: 'candidateReminder',
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
      objectName: 'candidateEnrichment',
      field: {
        description: '',
        label: 'selectedMetadataFields',
        name: 'selectedMetadataFields',
        objectMetadataId: objectsNameIdMap.candidateEnrichment,
        type: 'RAW_JSON',
      },
    },
    {
      objectName: 'candidateEnrichment',
      field: {
        description: '',
        label: 'modelName',
        name: 'modelName',
        objectMetadataId: objectsNameIdMap.candidateEnrichment,
        type: 'TEXT',
      },
    },
    {
      objectName: 'candidateEnrichment',
      field: {
        description: '',
        label: 'filterDescription',
        name: 'filterDescription',
        objectMetadataId: objectsNameIdMap.candidateEnrichment,
        type: 'TEXT',
      },
    },
    {
      objectName: 'candidateEnrichment',
      field: {
        description: '',
        label: 'fields',
        name: 'fields',
        objectMetadataId: objectsNameIdMap.candidateEnrichment,
        type: 'RAW_JSON',
      },
    },
    {
      objectName: 'candidateEnrichment',
      field: {
        description: '',
        label: 'sampleJson',
        name: 'sampleJson',
        objectMetadataId: objectsNameIdMap.candidateEnrichment,
        type: 'RAW_JSON',
      },
    },
    {
      objectName: 'prompt',
      field: {
        description: '',
        label: 'Prompt',
        name: 'prompt',
        objectMetadataId: objectsNameIdMap.prompt,
        type: 'TEXT',
      },
    },
    {
      objectName: 'candidateEnrichment',
      field: {
        description: '',
        label: 'prompt',
        name: 'prompt',
        objectMetadataId: objectsNameIdMap.candidateEnrichment,
        type: 'TEXT',
      },
    },
    {
      objectName: 'candidateEnrichment',
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
            {
              color: 'turquoise',
              label: 'gpt-4o-mini-search-preview',
              position: 1,
              value: 'gpt4ominisearchpreview',
            },
        ],
        type: 'SELECT',
      },
    },
    {
      objectName: 'job',
      field: {
        description: '',
        label: 'Arxena Job Id',
        name: 'arxenaSiteId',
        objectMetadataId: objectsNameIdMap.job,
        type: 'TEXT',
      },
    },

    {
      objectName: 'videoInterviewModel',
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
      objectName: 'videoInterviewModel',
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
      objectName: 'videoInterviewTemplate',
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
      objectName: 'videoInterviewTemplate',
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
      objectName: 'videoInterviewQuestion',
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
      objectName: 'videoInterviewQuestion',
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
      objectName: 'videoInterviewQuestion',
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
      objectName: 'videoInterviewQuestion',
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
      objectName: 'videoInterviewQuestion',
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
      objectName: 'videoInterviewResponse',
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
      objectName: 'videoInterviewResponse',
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
      objectName: 'videoInterviewResponse',
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
      objectName: 'videoInterviewResponse',
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
      objectName: 'videoInterviewResponse',
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
      objectName: 'videoInterviewResponse',
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
      objectName: 'shortlist',
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
      objectName: 'shortlist',
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
      objectName: 'shortlist',
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
      objectName: 'shortlist',
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
      objectName: 'shortlist',
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
      objectName: 'shortlist',
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
      objectName: 'shortlist',
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
      objectName: 'shortlist',
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
      objectName: 'shortlist',
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
      objectName: 'shortlist',
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
      objectName: 'shortlist',
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
      objectName: 'shortlist',
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
      objectName: 'shortlist',
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
      objectName: 'shortlist',
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
      objectName: 'shortlist',
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
      objectName: 'person',
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
      objectName: 'candidate',
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
      objectName: 'candidate',
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
      objectName: 'candidate',
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
      objectName: 'candidate',
      field: {
        description: 'Job Title',
        icon: 'IconPencilStar',
        label: 'jobTitle',
        name: 'jobTitle',
        objectMetadataId: objectsNameIdMap.candidate,
        type: 'TEXT',
      },
    },
    {
      objectName: 'candidate',
      field: {
        description: 'Job Company Name',
        icon: 'IconBuilding',
        label: 'Job Company Name',
        name: 'jobCompanyName',
        objectMetadataId: objectsNameIdMap.candidate,
        type: 'TEXT',
      },
    },
    {
      objectName: 'candidate',
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
      objectName: 'job',
      field: {
        description: 'Link for Candidate Tracker Google Sheet',
        label: 'Google Sheet Url',
        name: 'googleSheetUrl',
        objectMetadataId: objectsNameIdMap.job,
        type: 'LINKS',
      },
    },
    {
      objectName: 'videoInterview',
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
      objectName: 'videoInterview',
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
      objectName: 'candidate',
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
      objectName: 'candidate',
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
      objectName: 'candidate',
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
      objectName: 'candidate',
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
      objectName: 'person',
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
      objectName: 'videoInterview',
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
      objectName: 'videoInterview',
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
    // Assistant Thread fields
    // Note: 'name' field is automatically added by buildDefaultFieldsForCustomObject when the object is created
    {
      objectName: 'assistantThread',
      field: {
        description: '',
        label: 'Messages',
        name: 'messages',
        objectMetadataId: objectsNameIdMap.assistantThread,
        type: 'RAW_JSON',
      },
    },
    {
      objectName: 'assistantThread',
      field: {
        description: '',
        label: 'Last Table Data',
        name: 'lastTableData',
        objectMetadataId: objectsNameIdMap.assistantThread,
        type: 'RAW_JSON',
      },
    },
    {
      objectName: 'assistantThread',
      field: {
        description: 'Agent scratch pad / pending notes for this thread (JSON array of { summary, createdAt? })',
        label: 'Agent Notes',
        name: 'agentNotes',
        objectMetadataId: objectsNameIdMap.assistantThread,
        type: 'RAW_JSON',
      },
    },
    {
      objectName: 'assistantThread',
      field: {
        description:
          'Assistant agent events for this thread (JSON array of { status, summary?, error?, toolName?, runId?, timestamp })',
        label: 'Agent Events',
        name: 'agentEvents',
        objectMetadataId: objectsNameIdMap.assistantThread,
        type: 'RAW_JSON',
      },
    },
    {
      objectName: 'assistantThread',
      field: {
        description:
          'Controls whether this assistant thread runs in fully autonomous or permissioned (human approval) mode',
        label: 'Assistant Mode',
        name: 'assistantMode',
        objectMetadataId: objectsNameIdMap.assistantThread,
        type: 'SELECT',
        defaultValue: 'permissioned',
        options: [
          {
            color: 'green',
            label: 'Fully autonomous',
            position: 0,
            value: 'fully_autonomous',
          },
          {
            color: 'blue',
            label: 'Permissioned',
            position: 1,
            value: 'permissioned',
          },
        ],
      },
    },
    {
      objectName: 'assistantThread',
      field: {
        description: 'Search/assistant parameters for this thread (generated and resolved search parameters)',
        label: 'Assistant Parameters',
        name: 'assistantParameters',
        objectMetadataId: objectsNameIdMap.assistantThread,
        type: 'RAW_JSON',
      },
    },
    {
      objectName: 'assistantThread',
      field: {
        description: 'Enrichment configurations for this thread',
        label: 'Enrichment Configs',
        name: 'enrichmentConfigs',
        objectMetadataId: objectsNameIdMap.assistantThread,
        type: 'RAW_JSON',
      },
    },
    {
      objectName: 'assistantThread',
      field: {
        description: 'Column filters for candidate filtering',
        label: 'Column Filters',
        name: 'columnFilters',
        objectMetadataId: objectsNameIdMap.assistantThread,
        type: 'RAW_JSON',
      },
    },
    {
      objectName: 'assistantThread',
      field: {
        description: 'Search strategy for this thread',
        label: 'Assistant Search Strategy',
        name: 'assistantSearchStrategy',
        objectMetadataId: objectsNameIdMap.assistantThread,
        type: 'RAW_JSON',
      },
    },
    {
      objectName: 'assistantThread',
      field: {
        description: 'Whether this thread is currently active',
        label: 'Is Active',
        name: 'isActive',
        objectMetadataId: objectsNameIdMap.assistantThread,
        type: 'BOOLEAN',
        defaultValue: false,
      },
    },
    // // Assistant Message fields
    // {
    //   field: {
    //     description: '',
    //     label: 'Thread',
    //     name: 'assistantThread',
    //     objectMetadataId: objectsNameIdMap.assistantMessage,
    //     type: 'LINKS',
    //   },
    // },
    // {
    //   field: {
    //     description: '',
    //     label: 'Role',
    //     name: 'role',
    //     objectMetadataId: objectsNameIdMap.assistantMessage,
    //     type: 'SELECT',
    //     options: [
    //       {
    //         color: 'blue',
    //         label: 'User',
    //         position: 0,
    //         value: 'user',
    //       },
    //       {
    //         color: 'green',
    //         label: 'Assistant',
    //         position: 1,
    //         value: 'assistant',
    //       },
    //     ],
    //   },
    // },
    // {
    //   field: {
    //     description: '',
    //     label: 'Content',
    //     name: 'content',
    //     objectMetadataId: objectsNameIdMap.assistantMessage,
    //     type: 'TEXT',
    //   },
    // },
    // {
    //   field: {
    //     description: '',
    //     label: 'Tool Calls',
    //     name: 'toolCalls',
    //     objectMetadataId: objectsNameIdMap.assistantMessage,
    //     type: 'RAW_JSON',
    //   },
    // },
    // {
    //   field: {
    //     description: '',
    //     label: 'Table Data Ref',
    //     name: 'tableDataRef',
    //     objectMetadataId: objectsNameIdMap.assistantMessage,
    //     type: 'RAW_JSON',
    //   },
    // },
    // // Assistant Thread Candidate fields
    // {
    //   field: {
    //     description: '',
    //     label: 'Thread',
    //     name: 'assistantThread',
    //     objectMetadataId: objectsNameIdMap.assistantThreadCandidate,
    //     type: 'LINKS',
    //   },
    // },
    // {
    //   field: {
    //     description: '',
    //     label: 'Candidate',
    //     name: 'candidate',
    //     objectMetadataId: objectsNameIdMap.assistantThreadCandidate,
    //     type: 'LINKS',
    //   },
    // },
    // {
    //   field: {
    //     description: '',
    //     label: 'Job',
    //     name: 'job',
    //     objectMetadataId: objectsNameIdMap.assistantThreadCandidate,
    //     type: 'LINKS',
    //   },
    // },
    // {
    //   field: {
    //     description: '',
    //     label: 'Person',
    //     name: 'person',
    //     objectMetadataId: objectsNameIdMap.assistantThreadCandidate,
    //     type: 'LINKS',
    //   },
    // },
  ];

  return allFields
    .filter((f) => !objectsToExclude.includes(f.objectName))
    .map((f) => ({ field: f.field }));
}
