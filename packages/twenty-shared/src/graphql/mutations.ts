export const graphqlQueryToUpdateOneReminder = `
  mutation UpdateOneCandidateReminder($idToUpdate: ID!, $input: CandidateReminderUpdateInput!) {
  updateCandidateReminder(id: $idToUpdate, data: $input) {
    __typename
  }
}
`;

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
}`;


export const createResponseMutation = `mutation CreateOneVideoInterviewResponse($input: VideoInterviewResponseCreateInput!) {
  createVideoInterviewResponse(data: $input) {
    id
    videoInterviewId
    videoInterviewQuestionId
    transcript
    completedResponse
    createdAt
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

export const graphqlQueryToCreateOneReminder = `
  mutation CreateOneCandidateReminder($input: CandidateReminderCreateInput!) {
  createCandidateReminder(data: $input) {
    __typename
  }
}
`;



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



export const graphqlToUpdateWhatsappMessageId = `
mutation UpdateOneWhatsappMessage($idToUpdate: ID!, $input: WhatsappMessageUpdateInput!) {
  updateWhatsappMessage(id: $idToUpdate, data: $input) {
   id
   createdAt
   updatedAt
  }
}
`;



export const graphqlQueryToRemoveMessages = `mutation DeleteManyWhatsappMessages($filter: WhatsappMessageFilterInput!) {
  deleteWhatsappMessages(filter: $filter) {
    id
    __typename
  }
}`;



export const graphqlToUpdateOneClientInterview =  `mutation UpdateOneClientInterview($idToUpdate: ID!, $input: ClientInterviewUpdateInput!) {
  updateClientInterview(id: $idToUpdate, data: $input) {
    __typename
    createdAt
    interviewSchedule {
      __typename
      meetingType
      position
      name
      slotsAvailable
      id
      jobId
      updatedAt
      createdAt
    }
    interviewTime
    updatedAt  
    id
    name
    position
    candidateId
  }
}`


export const graphQLtoCreateOneAttachmentFromFilePath = `mutation CreateOneAttachment($input: AttachmentCreateInput!) {
  createAttachment(data: $input) {
    __typename
  } 
}`;






export const updateOneVideoInterviewMutation = `mutation UpdateOneVideoInterview($idToUpdate: ID!, $input: VideoInterviewUpdateInput!) {
  updateVideoInterview(id: $idToUpdate, data: $input) {
      id
      interviewStarted
      interviewCompleted
      updatedAt
      createdAt
  }
  }`;

  export const graphqlToCreateOnePrompt = `mutation CreateOnePrompt($input: PromptCreateInput!) {
            createPrompt(data: $input) {
              name
              recruiter {
                colorScheme
                name {
                  firstName
                  lastName
                }
                avatarUrl
                updatedAt
                createdAt
                locale
                userEmail
                id
                userId
              }
              position
              id
              jobId
              job {
                yearsOfExperience
                id
                updatedAt
                recruiterId
                reportees
                description
                position
                specificCriteria
                arxenaSiteId
                isActive
                salaryBracket
                googleSheetUrl {
                  primaryLinkLabel
                  primaryLinkUrl
                }
                createdAt
                name
                googleSheetId
                reportsTo
                companyId
                searchName
                jobLocation
                jobCode
                talentConsiderations
                companyDetails
                pathPosition
              }
              updatedAt
              prompt
              createdAt
              recruiterId
            }
          }`

  export const graphQLToCreateOneWorkspaceMemberProfile  = `mutation CreateOneWorkspaceMemberProfile($input: WorkspaceMemberProfileCreateInput!) {
    createWorkspaceMemberProfile(data: $input) {
      id
      workspaceMember {
        id
      }
    }
  }`;
  
  


  export const CreateManyCandidates = `mutation CreateCandidates($data: [CandidateCreateInput!]!) {
    createCandidates(data: $data) {
      __typename
      id
    }
  }`;
  
  export const CreateOneCompany = `
  mutation CreateOneCompany($input: CompanyCreateInput!) {
    createCompany(data: $input) {
      __typename
    }
  }
  `;
  


  export const CreateOneObjectMetadataItem = `
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






  export const CreateOneRelationMetadata = ` mutation CreateOneRelationMetadata($input: CreateOneRelationInput!) {
    createOneRelation(input: $input) {
      id
      relationType
      fromObjectMetadataId
      toObjectMetadataId
      fromFieldMetadataId
      toFieldMetadataId
      createdAt
      updatedAt
      __typename
    }
  }
    `;
  
  
  
  export const CreateOneFieldMetadataItem = `mutation CreateOneFieldMetadataItem($input: CreateOneFieldMetadataInput!) {
        createOneField(input: $input) {
            id
            type
            name
            label
            description
            icon
            isCustom
            isActive
            isNullable
            createdAt
            updatedAt
            defaultValue
            options
        }
    }
    `;



  
  export const CreateManyCustomMetadataObject = (objName: string) => {
    return `
      mutation Create${objName}($data: [${objName}CreateInput!]!) {
        createMany${objName}(input: $data) {
          id
        }
      }
      `;
  };
  

  


export const graphqlMutationToCreatePhoneCall = `
mutation CreatePhoneCall($input: CreatePhoneCallInput!) {
    createPhoneCall(data: $input) {
        id
        personId
        phoneNumber
        callType
        duration
        datetime
    }
}`;

export const graphqlMutationToCreateSMS = `
mutation CreateSMS($input: CreateSMSInput!) {
    createSMS(data: $input) {
        id
        personId 
        phoneNumber
        messageType
        message
        timestamp
    }
}`;



export const graphqlMutationToUpdateSMS = `
mutation UpdateSMS($id: ID!, $input: UpdateSMSInput!) {
    updateSMS(id: $id, data: $input) {
        id
        personId
        phoneNumber
        messageType
        message
        timestamp
    }
}`;






export const CreateOneJob = `
mutation CreateOneJob($input: JobCreateInput!) {
  createJob(data: $input) {
    __typename
    id
  }
}`;

export const UpdateOneJob = `mutation UpdateOneJob($idToUpdate: ID!, $input: JobUpdateInput!) {
 updateJob(id: $idToUpdate, data: $input) {
   __typename
   recruiterId
   id
   specificCriteria
   createdAt
   arxenaSiteId
   pathPosition
   googleSheetUrl{
   primaryLinkUrl
   primaryLinkLabel
   }
   googleSheetId

 }}
`;


export const createOneQuestion = `
mutation CreateOneQuestion($input: QuestionCreateInput!) {
  createQuestion(data: $input) {
    __typename
  }
}`


export const CreateManyPeople = `
mutation CreatePeople($data: [PersonCreateInput!]!) {
  createPeople(data: $data) {
    __typename
    uniqueStringKey
    id
  }
}`;



export const mutationToUpdateOnePerson = `mutation UpdateOnePerson($idToUpdate: ID!, $input: PersonUpdateInput!) {
  updatePerson(id: $idToUpdate, data: $input) {
    __typename
    city
  }
}`






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




  
  export const graphQltoUpdateOneCandidate = `mutation UpdateOneCandidate($idToUpdate: ID!, $input: CandidateUpdateInput!) {
    updateCandidate(id: $idToUpdate, data: $input) {
      __typename
      engagementStatus
      whatsappProvider
      jobsId
      updatedAt
      startChat
      stopChat
      chatCount
      startChatCompleted
      startMeetingSchedulingChat
      startMeetingSchedulingChatCompleted
      startVideoInterviewChat
      startVideoInterviewChatCompleted
      position
    }
  }`;
  




export const graphqlQueryToUpdateReminderStatus = `mutation UpdateOneReminder($idToUpdate: ID!, $input: ReminderUpdateInput!) {
    updateReminder(id: $idToUpdate, data: $input) {
      updatedAt
      id
    }
  }`;




export const graphqlToAddNewPerson = `mutation CreateOnePerson($input: PersonCreateInput!) {
  createPerson(data: $input) {
    __typename
    }
}
`

export const graphqlToAddNewJob = `mutation CreateOneJob($input: JobCreateInput!) {
  createJob(data: $input) {
    __typename
  }
}
`


export const createCvsentMutation = `mutation CreateOneCvSent($input: CvSentCreateInput!) {
  createCvSent(data: $input) {
    __typename
    id
  }
}
`



export const graphqlToAddNewContact = `mutation CreateOneContact($input: ContactCreateInput!) {
  createContact(data: $input) {
    __typename
  }
}
`



export const graphqlToAddNewCandidate = `mutation CreateOneCandidate($input: CandidateCreateInput!) {
  createCandidate(data: $input) {
    __typename
  }
}
`



export const mutationToUpdateOnePhoneCall = `
mutation UpdatePhoneCall($id: ID!, $input: UpdatePhoneCallInput!) {
    updatePhoneCall(id: $id, data: $input) {
        id
        personId
        phoneNumber
        callType
        duration
        transcript
        name
        createdAt
        timestamp
        recordingAttachmentId
    }
}`;


export const createShortlistMutation = `
    mutation CreateOneShortlist($input: ShortlistCreateInput!) {
        createShortlist(data: $input) {
            id
            name
            currentJobTitle
            yearsOfExperience
            currentCompany
            universityCollege
            reasonForLeaving
            currentSalary
            functionsReportingTo
            educationalQualifications
            reportsTo
            age
            currentLocation
            noticePeriod
            expectedSalary
        }
    }
`
