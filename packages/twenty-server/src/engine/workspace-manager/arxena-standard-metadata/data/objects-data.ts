import { OBJECT_DATABASE_CRUD_TOOL_ACCESS } from 'twenty-shared/ai';

import { type ArxenaObjectDefinition } from 'src/engine/workspace-manager/arxena-standard-metadata/data/arxena-metadata-types';
import { isAssistantObjectName } from 'src/engine/workspace-manager/assistant-application/constants/assistant-application.constant';
import { isShortlistPresentationObjectName } from 'src/engine/workspace-manager/shortlist-presentation-application/constants/shortlist-presentation-application.constant';
import { isVideoInterviewObjectName } from 'src/engine/workspace-manager/video-interview-application/constants/video-interview-application.constant';

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
      icon: 'IconMessage',
      labelPlural: 'Messages',
      labelSingular: 'Message',
      nameSingular: 'chatMessage',
      namePlural: 'chatMessages',
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
      icon: 'IconFilterSearch',
      labelPlural: 'AI Filters',
      labelSingular: 'AI Filter',
      nameSingular: 'candidateEnrichment',
      namePlural: 'candidateEnrichments',
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

// Org-chart mode historically excluded shortlist-domain objects; those now
 // live in the optional Shortlist Presentation app and are always filtered
 // from Arxena Standard via isShortlistPresentationObjectName.
const OBJECTS_TO_EXCLUDE: string[] = [];

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
    const nameSingular = objectDefinition.object.nameSingular;

    return (
      !objectsToExclude.includes(nameSingular) &&
      !isVideoInterviewObjectName(nameSingular) &&
      !isShortlistPresentationObjectName(nameSingular) &&
      !isAssistantObjectName(nameSingular)
    );
  });
};

export const getVideoInterviewObjectCreationArr = (): ArxenaObjectDefinition[] =>
  allObjects.filter((objectDefinition) =>
    isVideoInterviewObjectName(objectDefinition.object.nameSingular),
  );

export const getShortlistPresentationObjectCreationArr =
  (): ArxenaObjectDefinition[] =>
    allObjects.filter((objectDefinition) =>
      isShortlistPresentationObjectName(objectDefinition.object.nameSingular),
    );

export const getAssistantObjectCreationArr = (): ArxenaObjectDefinition[] =>
  allObjects.filter((objectDefinition) =>
    isAssistantObjectName(objectDefinition.object.nameSingular),
  );

export const objectCreationArr = getObjectCreationArr();
