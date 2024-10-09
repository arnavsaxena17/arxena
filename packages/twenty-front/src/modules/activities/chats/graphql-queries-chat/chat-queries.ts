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