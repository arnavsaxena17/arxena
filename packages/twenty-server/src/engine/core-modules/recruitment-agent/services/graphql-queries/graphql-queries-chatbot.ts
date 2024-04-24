export const graphqlQueryToFindPeopleByPhoneNumber = `query FindManyPeople($filter: PersonFilterInput, $orderBy: PersonOrderByInput, $lastCursor: String, $limit: Float) {
    people(filter: $filter, orderBy: $orderBy, first: $limit, after: $lastCursor) {
      edges {
        node {
          name {
            firstName
            lastName
          }
          candidate{
              edges{
                  node {
                      id
                      job {
                        name
                        id
                        isActive
                        recruiterId
                        jobLocation
                        company{
                            name
                            descriptionOneliner
                        }
                     }
                      engagementStatus
                      whatsappMessages{
                          edges{
                              node{
                                  id
                                  message
                                  responsibleWorkspaceMemberId
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
      __typename
      responsibleWorkspaceMemberId
      message
      fromId
      phoneFrom
      jobsId
      candidateNameId
      name
    }
  }`;


  export const graphqlQueryToUpdateCandidateStatus = `mutation UpdateOneCandidate($idToUpdate: ID!, $input: CandidateUpdateInput!) {
    updateCandidate(id: $idToUpdate, data: $input) {
      updatedAt
      id
    }
  }`




  export const graphqlQueryToFindEngagedCandidates =   `query FindManyPeople($filter: PersonFilterInput, $orderBy: PersonOrderByInput, $lastCursor: String, $limit: Float) {
    people(filter: $filter, orderBy: $orderBy, first: $limit, after: $lastCursor) {
      edges {
        node {
          candidate {
              edges{
                  node{
                      id
                      job {
                         name
                         id
                         recruiterId
                         jobLocation
                         company{
                          name
                          descriptionOneliner
                      }
                      }
                      engagementStatus
                      startChat
                      whatsappMessages {
                        edges {
                          node {
                            responsibleWorkspaceMemberId
                            message
                            candidateNameId
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