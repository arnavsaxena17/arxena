export const graphqlQueryToFindPeopleByPhoneNumber = `query FindManyPeople($filter: PersonFilterInput, $orderBy: PersonOrderByInput, $lastCursor: String, $limit: Int) {
  people(filter: $filter, orderBy: $orderBy, first: $limit, after: $lastCursor) {
    edges {
      node {
        name {
          firstName
          lastName
        }
        candidates{
            edges{
                node {
                    id
                    engagementStatus
                    jobs{
                        id
                        name
                        isActive
                        recruiterId
                        jobLocation
                        createdAt
                        companies {
                            name
                            id
                            descriptionOneliner
                        }

                    }
                    whatsappMessages{
                        edges{
                            node{
                                id
                                message
                                recruiterId
                            }
                        }
                    }
                }
            }
        }
        id
        phone
        email
      }
    }
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
    }
  }`;


  export const graphqlQueryToUpdateCandidateStatus = `mutation UpdateOneCandidate($idToUpdate: ID!, $input: CandidateUpdateInput!) {
    updateCandidate(id: $idToUpdate, data: $input) {
      updatedAt
      id
    }
  }`




  export const graphqlQueryToFindEngagedCandidates =   `query FindManyPeople($filter: PersonFilterInput, $orderBy: PersonOrderByInput, $lastCursor: String, $limit: Int) {
    people(filter: $filter, orderBy: $orderBy, first: $limit, after: $lastCursor) {
      edges {
        node {
          candidates {
              edges{
                  node{
                      id
                      jobs {
                         name
                         id
                         recruiterId
                         jobLocation
                         companies {
                          name
                          descriptionOneliner
                      }
                      }
                      engagementStatus
                      startChat
                      whatsappMessages {
                        edges {
                          node {
                            recruiterId
                            message
                            candidateId
                            jobsId
                            position
                            phoneTo
                            updatedAt
                            createdAt
                            id
                            name
                            phoneFrom
                          }
                        }
                      }
                  }
              }
          }
          phone
          name {
            firstName
            lastName
          }
          email
          jobTitle
          id
          position
          
        }
      }
    }
  }`