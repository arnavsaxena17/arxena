import { OBJECT_DATABASE_CRUD_TOOL_ACCESS } from 'twenty-shared/ai';

import { type ArxenaObjectDefinition } from 'src/engine/workspace-manager/arxena-standard-metadata/data/arxena-metadata-types';

// Default mirrors workflows `isOrgChartEnabledEnv = false` — include all objects.
const IS_ORG_CHART_ENABLED_DEFAULT = false;

const allObjects: ArxenaObjectDefinition[] = [
  {
    object: {
      description: '',
      icon: 'IconUsers',
      labelPlural: 'Projects',
      labelSingular: 'Project',
      nameSingular: 'project',
      namePlural: 'projects',
    },
  },
  //     {
  //     "object": {
  //         "description": "",
  //         "icon": "IconReplace",
  //         "labelPlural": "Whatsapp Templates",
  //         "labelSingular": "Whatsapp Templates",
  //         "nameSingular": "whatsappTemplate",
  //         "namePlural": "whatsappTemplates"
  //     }
  // },
  {
    object: {
      description: '',
      icon: 'IconPrompt',
      labelPlural: 'Prompts',
      labelSingular: 'Prompt',
      nameSingular: 'prompt',
      namePlural: 'prompts',
    },
  },

  {
    object: {
      description: '',
      icon: 'IconPencilDown',
      labelPlural: 'Candidate Fields',
      labelSingular: 'Candidate Field',
      nameSingular: 'candidateField',
      namePlural: 'candidateFields',
    },
  },
  {
    object: {
      description: '',
      icon: 'IconMessage',
      labelPlural: 'Messages',
      labelSingular: 'Message',
      nameSingular: 'whatsappMessage',
      namePlural: 'whatsappMessages',
    },
  },
  {
    object: {
      description: '',
      icon: 'IconBrandAnsible',
      labelPlural: 'Candidate Field Values',
      labelSingular: 'Candidate Field Value',
      nameSingular: 'candidateFieldValue',
      namePlural: 'candidateFieldValues',
    },
  },
  {
    object: {
      description: '',
      icon: 'IconUsers',
      labelPlural: 'Candidates',
      labelSingular: 'Candidate',
      nameSingular: 'candidate',
      namePlural: 'candidates',
    },
  },
  {
    object: {
      description: '',
      icon: 'IconUserSearch',
      labelPlural: 'Screenings',
      labelSingular: 'Screening',
      nameSingular: 'screening',
      namePlural: 'screenings',
    },
  },
  {
    object: {
      description: '',
      icon: 'IconMoodCheck',
      labelPlural: 'Workspace Member Profiles',
      labelSingular: 'Workspace Member Profile',
      nameSingular: 'workspaceMemberProfile',
      namePlural: 'workspaceMemberProfiles',
    },
  },
  {
    object: {
      description: '',
      icon: 'IconFocus2',
      labelPlural: 'Offers',
      labelSingular: 'Offer',
      nameSingular: 'offer',
      namePlural: 'offers',
    },
  },
  {
    object: {
      description: '',
      icon: 'IconClockHour3',
      labelPlural: 'Candidate Reminders',
      labelSingular: 'Candidate Reminder',
      nameSingular: 'candidateReminder',
      namePlural: 'candidateReminders',
    },
  },
  {
    object: {
      description: '',
      icon: 'IconFilterSearch',
      labelPlural: 'AI Filters',
      labelSingular: 'AI Filter',
      nameSingular: 'candidateEnrichment',
      namePlural: 'candidateEnrichments',
    },
  },
  {
    object: {
      description: '',
      icon: 'IconUsers',
      labelPlural: 'Client Contacts',
      labelSingular: 'Client Contact',
      nameSingular: 'clientContact',
      namePlural: 'clientContacts',
    },
  },
  //     {

  //     "object": {

  //         "description": "",
  //         "icon": "IconActivity",
  //         "labelPlural": "Video Interviews",
  //         "labelSingular": "Video Interview",
  //         "nameSingular": "videoInterview",
  //         "namePlural": "videoInterviews"
  //     }

  // },

  // {
  //     "object": {
  //         "description": "",
  //         "icon": "IconPencilDown",
  //         "labelPlural": "Video Interview Responses",
  //         "labelSingular": "Video Interview Response",
  //         "nameSingular": "videoInterviewResponse",
  //         "namePlural": "videoInterviewResponses"
  //     }

  // },
  {
    object: {
      description: '',
      icon: 'IconActivity',
      labelPlural: 'Video Interviews',
      labelSingular: 'Video Interview',
      nameSingular: 'videoInterview',
      namePlural: 'videoInterviews',
    },
    databaseCrudToolAccess: OBJECT_DATABASE_CRUD_TOOL_ACCESS.videoInterview,
  },
  {
    object: {
      description: '',
      icon: 'IconPencilDown',
      labelPlural: 'Video Interview Responses',
      labelSingular: 'Video Interview Response',
      nameSingular: 'videoInterviewResponse',
      namePlural: 'videoInterviewResponses',
    },
    databaseCrudToolAccess:
      OBJECT_DATABASE_CRUD_TOOL_ACCESS.videoInterviewResponse,
  },
  {
    object: {
      description: '',
      icon: 'IconQuestionMark',
      labelPlural: 'Video Interview Questions',
      labelSingular: 'Video Interview Question',
      nameSingular: 'videoInterviewQuestion',
      namePlural: 'videoInterviewQuestions',
    },
    databaseCrudToolAccess:
      OBJECT_DATABASE_CRUD_TOOL_ACCESS.videoInterviewQuestion,
  },
  {
    object: {
      description: '',
      icon: 'IconScan',
      labelPlural: 'Video Interview Templates',
      labelSingular: 'Video Interview Template',
      nameSingular: 'videoInterviewTemplate',
      namePlural: 'videoInterviewTemplates',
    },
    databaseCrudToolAccess:
      OBJECT_DATABASE_CRUD_TOOL_ACCESS.videoInterviewTemplate,
  },
  {
    object: {
      description: '',
      icon: 'IconCode',
      labelPlural: 'Video Interview Models',
      labelSingular: 'Video Interview Model',
      nameSingular: 'videoInterviewModel',
      namePlural: 'videoInterviewModels',
    },
    databaseCrudToolAccess: OBJECT_DATABASE_CRUD_TOOL_ACCESS.videoInterviewModel,
  },
  {
    object: {
      description: '',
      icon: 'IconPhone',
      labelPlural: 'Phone Calls',
      labelSingular: 'Phone Call',
      nameSingular: 'phoneCall',
      namePlural: 'phoneCalls',
    },
  },
  {
    object: {
      description: '',
      icon: 'IconMessage',
      labelPlural: 'Text Messages',
      labelSingular: 'Text Message',
      nameSingular: 'textMessage',
      namePlural: 'textMessages',
    },
  },
  {
    object: {
      description: '',
      icon: 'IconChecklist',
      labelPlural: 'Shortlists',
      labelSingular: 'Shortlist',
      nameSingular: 'shortlist',
      namePlural: 'shortlists',
    },
  },
  {
    object: {
      description: '',
      icon: 'IconUsersGroup',
      labelPlural: 'Recruiter Interviews',
      labelSingular: 'Recruiter Interview',
      nameSingular: 'recruiterInterview',
      namePlural: 'recruiterInterviews',
    },
  },
  {
    object: {
      description: '',
      icon: 'IconMessage',
      labelPlural: 'Assistant Threads',
      labelSingular: 'Assistant Thread',
      nameSingular: 'assistantThread',
      namePlural: 'assistantThreads',
    },
  },
  // {
  //     "object": {
  //         "description": "",
  //         "icon": "IconMessage",
  //         "labelPlural": "Assistant Messages",
  //         "labelSingular": "Assistant Message",
  //         "nameSingular": "assistantMessage",
  //         "namePlural": "assistantMessages"
  //     }
  // },
  // {
  //     "object": {
  //         "description": "",
  //         "icon": "IconUsers",
  //         "labelPlural": "Assistant Thread Candidates",
  //         "labelSingular": "Assistant Thread Candidate",
  //         "nameSingular": "assistantThreadCandidate",
  //         "namePlural": "assistantThreadCandidates"
  //     }
  // },
  {
    object: {
      description: '',
      icon: 'IconSend',
      labelPlural: 'CV Sents',
      labelSingular: 'CV Sent',
      nameSingular: 'cvSent',
      namePlural: 'cvSents',
    },
  },
  {
    object: {
      description: '',
      icon: 'IconMoodCheck',
      labelPlural: 'Client Interviews',
      labelSingular: 'Client Interview',
      nameSingular: 'clientInterview',
      namePlural: 'clientInterviews',
    },
  },
  {
    object: {
      description: '',
      icon: 'IconTimeDuration60',
      labelPlural: 'Interview Schedules',
      labelSingular: 'Interview Schedule',
      nameSingular: 'interviewSchedule',
      namePlural: 'interviewSchedules',
    },
  },
  // {
  //     "object": {
  //         "description": "",
  //         "icon": "IconUsers",
  //         "labelPlural": "Interview Meetings",
  //         "labelSingular": "Interview Meeting",
  //         "nameSingular": "interviewMeeting",
  //         "namePlural": "interviewMeetings"
  //     }
  // },
  {
    object: {
      description: 'Saved org chart build (metadata pointer to S3/cache)',
      icon: 'IconHierarchy2',
      labelPlural: 'Org Charts',
      labelSingular: 'Org Chart',
      nameSingular: 'orgChart',
      namePlural: 'orgCharts',
    },
    databaseCrudToolAccess: OBJECT_DATABASE_CRUD_TOOL_ACCESS.orgChart,
  },
  {
    object: {
      description:
        'Workspace-level seller company profile, default ICP, and GTM search blurbs shared across runs',
      icon: 'IconTargetArrow',
      labelPlural: 'Workspace Profiles',
      labelSingular: 'Workspace Profile',
      nameSingular: 'workspaceProfile',
      namePlural: 'workspaceProfiles',
    },
  },
  {
    object: {
      description:
        'Registered website domain for visitor tracking (script allowlist)',
      icon: 'IconWorldWww',
      labelPlural: 'Website Domains',
      labelSingular: 'Website Domain',
      nameSingular: 'websiteDomain',
      namePlural: 'websiteDomains',
    },
  },
  {
    object: {
      description:
        'Company-level website visitor session identified via IP resolution',
      icon: 'IconEye',
      labelPlural: 'Website Visitors',
      labelSingular: 'Website Visitor',
      nameSingular: 'websiteVisitor',
      namePlural: 'websiteVisitors',
    },
  },
];

const OBJECTS_TO_EXCLUDE = [
  'videoInterview',
  'videoInterviewTemplate',
  'videoInterviewModel',
  'videoInterviewQuestion',
  'videoInterviewResponse',
  'clientInterview',
  'interviewSchedule',
  'cvSent',
  'candidateEnrichment',
  'candidateReminder',
  'clientContact',
  'phoneCall',
  'textMessage',
  'shortlist',
  'recruiterInterview',
  'screening',
  'offer',
];

export const getObjectsToExclude = (isOrgChartEnabled?: boolean): string[] => {
  const enabled = isOrgChartEnabled ?? IS_ORG_CHART_ENABLED_DEFAULT;

  if (!enabled) {
    return [];
  }

  return OBJECTS_TO_EXCLUDE;
};

export const isOrgChartMetadataEnabled = (
  isOrgChartEnabled?: boolean,
): boolean => {
  return isOrgChartEnabled ?? IS_ORG_CHART_ENABLED_DEFAULT;
};

export const getObjectCreationArr = (
  isOrgChartEnabled?: boolean,
): ArxenaObjectDefinition[] => {
  const objectsToExclude = getObjectsToExclude(isOrgChartEnabled);

  return allObjects.filter((objectDefinition) => {
    return !objectsToExclude.includes(objectDefinition.object.nameSingular);
  });
};

export const objectCreationArr = getObjectCreationArr();
