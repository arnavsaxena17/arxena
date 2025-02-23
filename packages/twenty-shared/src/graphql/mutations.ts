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



export const graphQlToUpdateCandidate = `mutation UpdateOneCandidate($idToUpdate: ID!, $input: CandidateUpdateInput!) {
  updateCandidate(id: $idToUpdate, data: $input) {
      __typename
  }
}`;

export const mutationToUpdateOnePerson = `mutation UpdateOnePerson($idToUpdate: ID!, $input: PersonUpdateInput!) {
  updatePerson(id: $idToUpdate, data: $input) {
    __typename
    city
  }
}`;

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

export const graphqlQueryToUpdateCandidateEngagementStatus = `mutation UpdateOneCandidate($idToUpdate: ID!, $input: CandidateUpdateInput!) {
  updateCandidate(id: $idToUpdate, data: $input) {
    updatedAt
    id
  }
}`;
export const graphqlQueryToUpdateCandidateChatCount = `mutation UpdateOneCandidate($idToUpdate: ID!, $input: CandidateUpdateInput!) {
  updateCandidate(id: $idToUpdate, data: $input) {
    updatedAt
    id
  }
}`;

export const graphqlQueryToUpdateCandidateStatus = `mutation UpdateOneCandidate($idToUpdate: ID!, $input: CandidateUpdateInput!) {
updateCandidate(id: $idToUpdate, data: $input) {
  __typename
  status
  }
}`;

export const graphqlQueryToUpdateReminderStatus = `mutation UpdateOneReminder($idToUpdate: ID!, $input: ReminderUpdateInput!) {
  updateReminder(id: $idToUpdate, data: $input) {
    updatedAt
    id
  }
}`;

export const graphqlQueryToUpdateMessageDeliveryStatus = `
  mutation UpdateOneWhatsappMessage($idToUpdate: ID!, $input: WhatsappMessageUpdateInput!) {
    updateWhatsappMessage(id: $idToUpdate, data: $input) {
      __typename
      whatsappDeliveryStatus
      whatsappMessageId
    }
  }`;

export const graphqlToCreateOneMetatDataObjectItems = `
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
`;

export const graphQLtoCreateOneAttachmentFromFilePath = `mutation CreateOneAttachment($input: AttachmentCreateInput!) {
  createAttachment(data: $input) {
    __typename
  } 
}`;
