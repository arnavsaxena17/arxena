import { RelationInput } from '../types/types.js';

export function getRelationsData(objectsNameIdMap: Record<string, string>): RelationInput[] {
    return  [
        {
            "relation": {
                "fromDescription": null,
                "fromIcon": "IconBuilding",
                "fromLabel": "Jobs",
                "fromName": "jobs",
                "fromObjectMetadataId": objectsNameIdMap.company,
                "relationType": "ONE_TO_MANY",
                "toObjectMetadataId": objectsNameIdMap.job,
                "toDescription": "",
                "toLabel": "Companies",
                "toName": "companies"
            }
        },
        {
            "relation": {
                "fromDescription": null,
                "fromIcon": "IconBuilding",
                "fromLabel": "Workspace Members",
                "fromName": "workspaceMembers",
                "fromObjectMetadataId": objectsNameIdMap.workspaceMember,
                "relationType": "ONE_TO_MANY",
                "toObjectMetadataId": objectsNameIdMap.prompt,
                "toDescription": "",
                "toLabel": "Prompts",
                "toName": "prompt"
            }
        },
            {
            "relation": {
                "fromDescription": null,
                "fromIcon": "IconBuilding",
                "fromLabel": "Jobs",
                "fromName": "jobs",
                "fromObjectMetadataId": objectsNameIdMap.workspaceMember,
                "relationType": "ONE_TO_MANY",
                "toObjectMetadataId": objectsNameIdMap.job,
                "toDescription": "",
                "toLabel": "Recruiter",
                "toName": "recruiter"
            }
        },
        {
            "relation": {
                "fromDescription": null,
                // "fromIcon": "IconBuilding",
                "fromLabel": "Questions",
                "fromName": "questions",
                "fromObjectMetadataId": objectsNameIdMap.job,
                "relationType": "ONE_TO_MANY",
                "toObjectMetadataId": objectsNameIdMap.question,
                "toDescription": "",
                "toLabel": "Jobs",
                "toName": "jobs"
            }
        },
        {
            "relation": {
                "fromDescription": null,
                // "fromIcon": "IconBuilding",
                "fromLabel": "Answers",
                "fromName": "answers",
                "fromObjectMetadataId": objectsNameIdMap.question,
                "relationType": "ONE_TO_MANY",
                "toObjectMetadataId": objectsNameIdMap.answer,
                "toDescription": "",
                "toLabel": "Questions",
                "toName": "questions"
            }
        },
        {
            "relation": {
                "fromDescription": null,
                "fromLabel": "Answers",
                "fromName": "answers",
                "fromObjectMetadataId": objectsNameIdMap.candidate,
                "relationType": "ONE_TO_MANY",
                "toObjectMetadataId": objectsNameIdMap.answer,
                "toDescription": "",
                "toLabel": "Candidate",
                "toName": "candidate"
            }
        },
        {
            "relation": {
                "fromDescription": null,
                "fromLabel": "Candidates",
                "fromName": "candidates",
                "fromObjectMetadataId": objectsNameIdMap.job,
                "relationType": "ONE_TO_MANY",
                "toObjectMetadataId": objectsNameIdMap.candidate,
                "toDescription": "",
                "toLabel": "Jobs",
                "toName": "jobs"
            }
        },
        {
            "relation": {
                "fromDescription": null,
                // "fromIcon": "IconBuilding",
                "fromLabel": "Candidates",
                "fromName": "candidates",
                "fromObjectMetadataId": objectsNameIdMap.person,
                "relationType": "ONE_TO_MANY",
                "toObjectMetadataId": objectsNameIdMap.candidate,
                "toDescription": "",
                "toLabel": "People",
                "toName": "people"
            }
        },
        {
            "relation": {
                "fromDescription": null,
                // "fromIcon": "IconBuilding",
                "fromLabel": "Screenings",
                "fromName": "screenings",
                "fromObjectMetadataId": objectsNameIdMap.candidate,
                "relationType": "ONE_TO_MANY",
                "toObjectMetadataId": objectsNameIdMap.screening,
                "toDescription": "",
                "toLabel": "Candidate",
                "toName": "candidate"
            }
        },
        {
            "relation": {
                "fromDescription": null,
                // "fromIcon": "IconBuilding",
                "fromLabel": "CVSents",
                "fromName": "CVSents",
                "fromObjectMetadataId": objectsNameIdMap.candidate,
                "relationType": "ONE_TO_MANY",
                "toObjectMetadataId": objectsNameIdMap.cvsent,
                "toDescription": "",
                "toLabel": "Candidate",
                "toName": "candidate"
            }
        },
        {
            "relation": {
                "fromDescription": null,
                // "fromIcon": "IconBuilding",
                "fromLabel": "CVSents",
                "fromName": "cvSents",
                "fromObjectMetadataId": objectsNameIdMap.job,
                "relationType": "ONE_TO_MANY",
                "toObjectMetadataId": objectsNameIdMap.cvsent,
                "toDescription": "",
                "toLabel": "Job",
                "toName": "job"
            }
        },
        {
            "relation": {
                "fromDescription": null,
                // "fromIcon": "IconBuilding",
                "fromLabel": "RecruiterInterviews",
                "fromName": "recruiterInterviews",
                "fromObjectMetadataId": objectsNameIdMap.candidate,
                "relationType": "ONE_TO_MANY",
                "toObjectMetadataId": objectsNameIdMap.recruiterInterview,
                "toDescription": "",
                "toLabel": "Candidate",
                "toName": "candidate"
            }
        },
        {
            "relation": {
                "fromDescription": null,
                // "fromIcon": "IconBuilding",
                "fromLabel": "ClientInterviews",
                "fromName": "clientInterviews",
                "fromObjectMetadataId": objectsNameIdMap.candidate,
                "relationType": "ONE_TO_MANY",
                "toObjectMetadataId": objectsNameIdMap.clientInterview,
                "toDescription": "",
                "toLabel": "Candidate",
                "toName": "candidate"
            }
        },
        {
            "relation": {
                "fromDescription": null,
                // "fromIcon": "IconBuilding",
                "fromLabel": "WhatsappMessages",
                "fromName": "whatsappMessages",
                "fromObjectMetadataId": objectsNameIdMap.candidate,
                "relationType": "ONE_TO_MANY",
                "toObjectMetadataId": objectsNameIdMap.whatsappMessage,
                "toDescription": "",
                "toLabel": "Candidate",
                "toName": "candidate"
            }
        },
        {
            "relation": {
                "fromDescription": null,
                // "fromIcon": "IconBuilding",
                "fromLabel": "WhatsappMessages",
                "fromName": "whatsappMessages",
                "fromObjectMetadataId": objectsNameIdMap.workspaceMember,
                "relationType": "ONE_TO_MANY",
                "toObjectMetadataId": objectsNameIdMap.whatsappMessage,
                "toDescription": "",
                "toLabel": "Recruiter",
                "toName": "recruiter"
            }
        },
            {
            "relation": {
                "fromDescription": null,
                // "fromIcon": "IconBuilding",
                "fromLabel": "WhatsappMessages",
                "fromName": "whatsappMessages",
                "fromObjectMetadataId": objectsNameIdMap.job,
                "relationType": "ONE_TO_MANY",
                "toObjectMetadataId": objectsNameIdMap.whatsappMessage,
                "toDescription": "",
                "toLabel": "Jobs",
                "toName": "jobs"
            }
        },
        {
            "relation": {
                "fromDescription": null,
                // "fromIcon": "IconBuilding",
                "fromLabel": "CandidateReminders",
                "fromName": "candidateReminders",
                "fromObjectMetadataId": objectsNameIdMap.candidate,
                "relationType": "ONE_TO_MANY",
                "toObjectMetadataId": objectsNameIdMap.candidateReminder,
                "toDescription": "",
                "toLabel": "Candidate",
                "toName": "candidate"
            }
        },
        {
            "relation": {
                "fromDescription": null,
                // "fromIcon": "IconBuilding",
                "fromLabel": "CandidateEnrichments",
                "fromName": "candidateEnrichments",
                "fromObjectMetadataId": objectsNameIdMap.job,
                "relationType": "ONE_TO_MANY",
                "toObjectMetadataId": objectsNameIdMap.candidateEnrichment,
                "toDescription": "",
                "toLabel": "Job",
                "toName": "job"
            }
        },
        {
            "relation": {
                "fromDescription": null,
                // "fromIcon": "IconBuilding",
                "fromLabel": "Jobs",
                "fromName": "jobs",
                "fromObjectMetadataId": objectsNameIdMap.clientContact,
                "relationType": "ONE_TO_MANY",
                "toObjectMetadataId": objectsNameIdMap.job,
                "toDescription": "",
                "toLabel": "ClientContact",
                "toName": "clientContacts"
            }
        },
        {
            "relation": {
                "fromDescription": null,
                // "fromIcon": "IconBuilding",
                "fromLabel": "ClientContacts",
                "fromName": "clientContacts",
                "fromObjectMetadataId": objectsNameIdMap.person,
                "relationType": "ONE_TO_MANY",
                "toObjectMetadataId": objectsNameIdMap.clientContact,
                "toDescription": "",
                "toLabel": "People",
                "toName": "people"
            }
        },
        {
            "relation": {
                "fromDescription": null,
                // "fromIcon": "IconBuilding",
                "fromLabel": "CVsents",
                "fromName": "cvSents",
                "fromObjectMetadataId": objectsNameIdMap.candidate,
                "relationType": "ONE_TO_MANY",
                "toObjectMetadataId": objectsNameIdMap.cvsent,
                "toDescription": "",
                "toLabel": "Candidate",
                "toName": "candidate"
            }
        },
          {
    
            "relation": {
                "fromDescription": null,
                "fromIcon": "IconScan",
                "fromLabel": "AI Interviews",
                "fromName": "aIInterviews",
                "fromObjectMetadataId": objectsNameIdMap.job,
                "relationType": "ONE_TO_MANY",
                "toObjectMetadataId": objectsNameIdMap.aIInterview,
                "toIcon": "IconTargetArrow",
                "toDescription": "",
                "toLabel": "Job",
                "toName": "job"
    
            }
    
        },
    
        {
    
            "relation": {
                "fromDescription": null,
                "fromIcon": "IconScan",
                "fromLabel": "AI Interviews",
                "fromName": "aIInterviews",
                "fromObjectMetadataId": objectsNameIdMap.aIModel,
                "relationType": "ONE_TO_MANY",
                "toObjectMetadataId": objectsNameIdMap.aIInterview,
                "toIcon": "IconMessageChatbot",
                "toDescription": "",
                "toLabel": "AI Model",
                "toName": "aIModel",
    
            }
    
        },
    
        {
    
            "relation": {
                "fromDescription": null,
                "fromIcon": "IconQuestionMark",
                "fromLabel": "AI Interview Question",
                "fromName": "aIInterviewQuestions",
                "fromObjectMetadataId": objectsNameIdMap.aIInterview,
                "relationType": "ONE_TO_MANY",
                "toObjectMetadataId": objectsNameIdMap.aIInterviewQuestion,
                "toIcon": "IconScan",
                "toDescription": "",
                "toLabel": "AI Interview",
                "toName": "aIInterview",
    
            }
    
        },
    
        {
    
            "relation": {
                "fromDescription": null,
                "fromIcon": "IconPencilDown",
                "fromLabel": "Responses",
                "fromName": "responses",
                "fromObjectMetadataId": objectsNameIdMap.aIInterviewQuestion,
                "relationType": "ONE_TO_MANY",
                "toObjectMetadataId": objectsNameIdMap.response,
                "toIcon": "IconQuestionMark",
                "toDescription": "",
                "toLabel": "AI Interview Question",
                "toName": "aIInterviewQuestion",
    
            }
    
        },
    
        {
    
            "relation": {
                "fromDescription": null,
                "fromIcon": "IconPencilDown",
                "fromLabel": "Responses",
                "fromName": "responses",
                "fromObjectMetadataId": objectsNameIdMap.aIInterviewStatus,
                "relationType": "ONE_TO_MANY",
                "toObjectMetadataId": objectsNameIdMap.response,
                "toIcon": "IconActivity",
                "toDescription": "",
                "toLabel": "AI Interview Status",
                "toName": "aIInterviewStatus",
    
            }
    
        },
    
        {
    
            "relation": {
                "fromDescription": null,
                "fromIcon": "IconActivity",
                "fromLabel": "AI Interview Status",
                "fromName": "aIInterviewStatus",
                "fromObjectMetadataId": objectsNameIdMap.candidate,
                "relationType": "ONE_TO_MANY",
                "toObjectMetadataId": objectsNameIdMap.aIInterviewStatus,
                "toIcon": "IconUserStar",
                "toDescription": "",
                "toLabel": "Candidate",
                "toName": "candidate",
    
            }
    
        },
        {
            "relation": {
                "fromDescription": null,
                "fromIcon": "IconActivity",
                "fromLabel": "AI Interview Status",
                "fromName": "aIInterviewStatus",
                "fromObjectMetadataId": objectsNameIdMap.aIInterview,
                "relationType": "ONE_TO_MANY",
                "toObjectMetadataId": objectsNameIdMap.aIInterviewStatus,
                "toIcon": "IconScan",
                "toDescription": "",
                "toLabel": "AI Interview",
                "toName": "aIInterview",
            }
        }
        //     {
        //     "relation": {
        //         "fromDescription": null,
        //         // "fromIcon": "IconBuilding",
        //         "fromLabel": "VoiceMessages",
        //         "fromName": "voiceMessages",
        //         "fromObjectMetadataId": objectsNameIdMap.job,
        //         "relationType": "ONE_TO_MANY",
        //         "toObjectMetadataId": objectsNameIdMap.voiceMessages,
        //         "toDescription": "",
        //         "toLabel": "Jobs",
        //         "toName": "jobs"
        //     }
        // },
        // {
        //     "relation": {
        //         "fromDescription": null,
        //         // "fromIcon": "IconBuilding",
        //         "fromLabel": "VoiceMessages",
        //         "fromName": "voiceMessages",
        //         "fromObjectMetadataId": objectsNameIdMap.workspaceMember,
        //         "relationType": "ONE_TO_MANY",
        //         "toObjectMetadataId": objectsNameIdMap.voiceMessages,
        //         "toDescription": "",
        //         "toLabel": "Recruiter",
        //         "toName": "recruiter"
        //     }
        // },
        // {
        //     "relation": {
        //         "fromDescription": null,
        //         // "fromIcon": "IconBuilding",
        //         "fromLabel": "VoiceMessages",
        //         "fromName": "voiceMessages",
        //         "fromObjectMetadataId": objectsNameIdMap.candidate,
        //         "relationType": "ONE_TO_MANY",
        //         "toObjectMetadataId": objectsNameIdMap.voiceMessages,
        //         "toDescription": "",
        //         "toLabel": "Candidate",
        //         "toName": "candidate"
        //     }
        // },
    ]
}