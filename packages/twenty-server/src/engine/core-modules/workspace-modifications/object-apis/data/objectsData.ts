import { isOrgChartEnabledEnv } from 'twenty-shared';


const allObjects = [
    {
        "object": {
            "description": "",
            "icon": "IconUsers",
            "labelPlural": "Projects",
            "labelSingular": "Project",
            "nameSingular": "project",
            "namePlural": "projects"
        }
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
        "object": {
            "description": "",
            "icon": "IconMessage",
            "labelPlural": "Messages",
            "labelSingular": "Message",
            "nameSingular": "chatMessage",
            "namePlural": "chatMessages"
        }
    },
    {
        "object": {
            "description": "",
            "icon": "IconUsers",
            "labelPlural": "Candidates",
            "labelSingular": "Candidate",
            "nameSingular": "candidate",
            "namePlural": "candidates"
        }
    },
    {
        "object": {
            "description": "",
            "icon": "IconUserSearch",
            "labelPlural": "Screenings",
            "labelSingular": "Screening",
            "nameSingular": "screening",
            "namePlural": "screenings"
        }
    },
    {
        "object": {
            "description": "",
            "icon": "IconMoodCheck",
            "labelPlural": "Workspace Member Profiles",
            "labelSingular": "Workspace Member Profile",
            "nameSingular": "workspaceMemberProfile",
            "namePlural": "workspaceMemberProfiles"
        }
    },
    {
        "object": {
            "description": "",
            "icon": "IconFilterSearch",
            "labelPlural": "AI Filters",
            "labelSingular": "AI Filter",
            "nameSingular": "candidateEnrichment",
            "namePlural": "candidateEnrichments"
        }
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
        "object": {
            "description": "",
            "icon": "IconPhone",
            "labelPlural": "Phone Calls",
            "labelSingular": "Phone Call",
            "nameSingular": "phoneCall",
            "namePlural": "phoneCalls"
        }
    },    
        {
        "object": {
            "description": "",
            "icon": "IconChecklist",
            "labelPlural": "Shortlists",
            "labelSingular": "Shortlist",
            "nameSingular": "shortlist",
            "namePlural": "shortlists"

        }

    },
    {
        "object": {
            "description": "",
            "icon": "IconMessage",
            "labelPlural": "Assistant Threads",
            "labelSingular": "Assistant Thread",
            "nameSingular": "assistantThread",
            "namePlural": "assistantThreads"
        }
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
        "object": {
            "description": "",
            "icon": "IconSend",
            "labelPlural": "CV Sents",
            "labelSingular": "CV Sent",
            "nameSingular": "cvSent",
            "namePlural": "cvSents"
        }
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
    },
];

export const VIDEO_INTERVIEW_OBJECT_NAMES = [
  'videoInterview',
  'videoInterviewTemplate',
  'videoInterviewModel',
  'videoInterviewQuestion',
  'videoInterviewResponse',
] as const;

export const ASSISTANT_OBJECT_NAMES = ['assistantThread'] as const;

const OBJECTS_TO_EXCLUDE = [
  'cvSent',
  'candidateEnrichment',
  'phoneCall',
  'shortlist',
  'screening',
];

export function getObjectsToExclude(isOrgChartEnabled?: boolean): string[] {
  const enabled = isOrgChartEnabled ?? isOrgChartEnabledEnv;
  if (!enabled) {
    return [];
  }
  return OBJECTS_TO_EXCLUDE;
}

export function isOrgChartMetadataEnabled(isOrgChartEnabled?: boolean): boolean {
  return isOrgChartEnabled ?? isOrgChartEnabledEnv;
}

export function getObjectCreationArr(isOrgChartEnabled?: boolean) {
  const objectsToExclude = getObjectsToExclude(isOrgChartEnabled);
  console.log('Is org cahrt enabled:', isOrgChartEnabled);
  return allObjects.filter((object) => {
    const name = object.object.nameSingular;
    if (
      objectsToExclude.includes(name) ||
      (VIDEO_INTERVIEW_OBJECT_NAMES as readonly string[]).includes(name) ||
      (ASSISTANT_OBJECT_NAMES as readonly string[]).includes(name)
    ) {
      return false;
    }
    return true;
  });
}

export const objectCreationArr = allObjects.filter((object) => {
  const name = object.object.nameSingular;
  if (
    getObjectsToExclude().includes(name) ||
    (VIDEO_INTERVIEW_OBJECT_NAMES as readonly string[]).includes(name) ||
    (ASSISTANT_OBJECT_NAMES as readonly string[]).includes(name)
  ) {
    return false;
  }
  return true;
});
