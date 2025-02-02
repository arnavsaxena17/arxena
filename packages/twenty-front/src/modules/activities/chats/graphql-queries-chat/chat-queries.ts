import { gql } from "@apollo/client";




export const mutationToUpdateOneCandidate = `mutation UpdateOneCandidate($idToUpdate: ID!, $input: CandidateUpdateInput!) {
    updateCandidate(id: $idToUpdate, data: $input) {
        whatsappProvider
        startChat
        status
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