import { gql } from "@apollo/client";




export const graphQltoUpdateOneCandidate = `mutation UpdateOneCandidate($idToUpdate: ID!, $input: CandidateUpdateInput!) {
    updateCandidate(id: $idToUpdate, data: $input) {
        whatsappProvider
        startChat
        status
        stopChat
        startChatCompleted
        startMeetingSchedulingChat
        startMeetingSchedulingChatCompleted
        startVideoInterviewChat
        startVideoInterviewChatCompleted
        jobsId
        createdAt
        updatedAt
        stopChat
    }
    }
`

export const mutationToUpdateOnePerson = `mutation UpdateOnePerson($idToUpdate: ID!, $input: PersonUpdateInput!) {
  updatePerson(id: $idToUpdate, data: $input) {
    __typename
    city
  }
}
`