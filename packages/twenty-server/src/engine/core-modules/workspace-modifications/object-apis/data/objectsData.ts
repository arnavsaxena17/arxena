import { isOrgChartEnabledEnv } from 'twenty-shared';

const allObjects = [
    {
        "object": {
            "description": "",
            "icon": "IconUsers",
            "labelPlural": "Jobs",
            "labelSingular": "Job",
            "nameSingular": "job",
            "namePlural": "jobs"
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
            "icon": "IconPrompt",
            "labelPlural": "Prompts",
            "labelSingular": "Prompt",
            "nameSingular": "prompt",
            "namePlural": "prompts"
        }
    },    

    {
        "object": {
            "description": "",
            "icon": "IconPencilDown",
            "labelPlural": "Candidate Fields",
            "labelSingular": "Candidate Field",
            "nameSingular": "candidateField",
            "namePlural": "candidateFields"
        }
    },
        {
        "object": {
            "description": "",
            "icon": "IconBrandWhatsapp",
            "labelPlural": "Whatsapp Messages",
            "labelSingular": "Whatsapp Message",
            "nameSingular": "whatsappMessage",
            "namePlural": "whatsappMessages"
        }
    },
    {
        "object": {
            "description": "",
            "icon": "IconBrandAnsible",
            "labelPlural": "Candidate Field Values",
            "labelSingular": "Candidate Field Value",
            "nameSingular": "candidateFieldValue",
            "namePlural": "candidateFieldValues"
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
            "icon": "IconFocus2",
            "labelPlural": "Offers",
            "labelSingular": "Offer",
            "nameSingular": "offer",
            "namePlural": "offers"
        }
    },
    {
        "object": {
            "description": "",
            "icon": "IconClockHour3",
            "labelPlural": "Candidate Reminders",
            "labelSingular": "Candidate Reminder",
            "nameSingular": "candidateReminder",
            "namePlural": "candidateReminders"
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
    {
        "object": {
            "description": "",
            "icon": "IconUsers",
            "labelPlural": "Client Contacts",
            "labelSingular": "Client Contact",
            "nameSingular": "clientContact",
            "namePlural": "clientContacts"
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
            "icon": "IconActivity",
            "labelPlural": "Video Interviews",
            "labelSingular": "Video Interview",
            "nameSingular": "videoInterview",
            "namePlural": "videoInterviews"
        }
    },
    {
        "object": {
            "description": "",
            "icon": "IconPencilDown",
            "labelPlural": "Video Interview Responses",
            "labelSingular": "Video Interview Response",
            "nameSingular": "videoInterviewResponse",
            "namePlural": "videoInterviewResponses"
        }
    },
        {
        "object": {
            "description": "",
            "icon": "IconQuestionMark",
            "labelPlural": "Video Interview Questions",
            "labelSingular": "Video Interview Question",
            "nameSingular": "videoInterviewQuestion",
            "namePlural": "videoInterviewQuestions"
        }
    },
    {
        "object": {
            "description": "",
            "icon": "IconScan",
            "labelPlural": "Video Interview Templates",
            "labelSingular": "Video Interview Template",
            "nameSingular": "videoInterviewTemplate",
            "namePlural": "videoInterviewTemplates"
        }
    },
    {
        "object": {
            "description": "",
            "icon": "IconCode",
            "labelPlural": "Video Interview Models",
            "labelSingular": "Video Interview Model",
            "nameSingular": "videoInterviewModel",
            "namePlural": "videoInterviewModels"
        }
    },
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
            "icon": "IconMessage",
            "labelPlural": "Text Messages",
            "labelSingular": "Text Message",
            "nameSingular": "textMessage",
            "namePlural": "textMessages"
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
            "icon": "IconUsersGroup",
            "labelPlural": "Recruiter Interviews",
            "labelSingular": "Recruiter Interview",
            "nameSingular": "recruiterInterview",
            "namePlural": "recruiterInterviews"
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
    {
        "object": {
            "description": "",
            "icon": "IconMoodCheck",
            "labelPlural": "Client Interviews",
            "labelSingular": "Client Interview",
            "nameSingular": "clientInterview",
            "namePlural": "clientInterviews"
        }
    },
    {
        "object": {
            "description": "",
            "icon": "IconTimeDuration60",
            "labelPlural": "Interview Schedules",
            "labelSingular": "Interview Schedule",
            "nameSingular": "interviewSchedule",
            "namePlural": "interviewSchedules"
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
  'offer'
];

export function getObjectsToExclude(isOrgChartEnabled?: boolean): string[] {
  const enabled = isOrgChartEnabled ?? isOrgChartEnabledEnv;
  if (!enabled) {
    return [];
  }
  return OBJECTS_TO_EXCLUDE;
}

export function getObjectCreationArr(isOrgChartEnabled?: boolean) {
  const objectsToExclude = getObjectsToExclude(isOrgChartEnabled);
  console.log("Is org cahrt enabled:", isOrgChartEnabled)
  const objectsToCreate = allObjects.filter(
      (object) => !objectsToExclude.includes(object.object.nameSingular),
    );
  return objectsToCreate
}

export const objectCreationArr = allObjects.filter(
  (object) => !getObjectsToExclude().includes(object.object.nameSingular),
);
