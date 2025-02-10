export const workspacesWithOlderSchema = ["20202020-1c25-4d02-bf25-6aeccf7ea419","3b8e6458-5fc1-4e63-8563-008ccddaa6db"];


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
   url
   label
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

export const graphqlQueryToFindManyPeople = `query FindManyPeople($filter: PersonFilterInput, $orderBy: [PersonOrderByInput], $lastCursor: String, $limit: Int) {
  people(filter: $filter, orderBy: $orderBy, first: $limit, after: $lastCursor) {
    edges {
      node {
        name {
          firstName
          lastName
        }
        city
        uniqueStringKey
        candidates{
            edges{
                node {
                    id
                    name
                    whatsappProvider
                    lastEngagementChatControl
                    candConversationStatus
                    engagementStatus
                    jobs{
                        id
                        name
                        isActive
                        recruiterId
                        jobLocation
                        jobCode
                        createdAt
                        company {
                            name
                            id
                            domainName
                            descriptionOneliner
                        }

                    }
                    videoInterview{
                        edges{
                            node{
                                id
                                interviewLink{
                                  url
                                }
                            }
                        }
                    }
                    whatsappMessages{
                        edges{
                            node{
                                recruiterId
                                message
                                candidateId
                                jobsId
                                messageObj
                                position
                                lastEngagementChatControl
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
        id
        phone
        email
      }
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
    __typename
    id
  }
}
`;

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



export const CreateOneFieldMetadataItem = `
  mutation CreateOneFieldMetadataItem($input: CreateOneFieldMetadataInput!) {
  createOneField(input: $input) {
    
    __typename
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

export const FindOneJob = `
  query FindOneJob($objectRecordId: ID!) {
    job(filter: {id: {eq: $objectRecordId}}) {
        updatedAt
        isActive
        recruiterId
        arxenaSiteId
        createdAt
        jobCode
        searchName
        reportsTo
        reportees
        yearsOfExperience
        salaryBracket
        companyDetails
        talentConsiderations
        specificCriteria
        description
        name
        jobLocation
        companyId
        position
        id

    }
  }
  `;


  export const graphqlToFindManyJobByArxenaSiteIdOlderSchema = `
    query FindManyJobs($filter: JobFilterInput, $orderBy: [JobOrderByInput], $lastCursor: String, $limit: Int) {
  jobs(filter: $filter, orderBy: $orderBy, first: $limit, after: $lastCursor) {
    edges {
      node {
        __typename
        updatedAt
        isActive
        recruiterId
        arxenaSiteId
        createdAt
        name
        jobLocation
        companiesId
        position
        id
      }
      cursor
      __typename
    }
    pageInfo {
      hasNextPage
      startCursor
      endCursor
      __typename
    }
    totalCount
    __typename
  }
}`

export const graphqlToFindManyJobByArxenaSiteId = `
  query FindManyJobs($filter: JobFilterInput, $orderBy: [JobOrderByInput], $lastCursor: String, $limit: Int) {
  jobs(filter: $filter, orderBy: $orderBy, first: $limit, after: $lastCursor) {
    edges {
      node {
        __typename
        updatedAt
        isActive
        recruiterId
        arxenaSiteId
        createdAt
        name
        jobLocation
        googleSheetId
        companyId
        position
        id
      }
      cursor
      __typename
    }
    pageInfo {
      hasNextPage
      startCursor
      endCursor
      __typename
    }
    totalCount
    __typename
  }
}
  `;

  export const graphqlToFetchCandidatesWithRecentUpdates = `
  query getCandidatesWithRecentUpdates($filter: CandidateFilter) {
    candidates(filter: $filter) {
      edges {
        node {
          id
          jobs {
            id
          }
          startChat
          startChatCompleted
          startVideoInterviewChat
          startVideoInterviewChatCompleted
          startMeetingSchedulingChat
          startMeetingSchedulingChatCompleted
          updatedAt
        }
      }
    }
  }
`;




  export const graphQltoUpdateOneCandidate = `mutation UpdateOneCandidate($idToUpdate: ID!, $input: CandidateUpdateInput!) {
  updateCandidate(id: $idToUpdate, data: $input) {
    __typename
    engagementStatus
    whatsappProvider
    jobsId
    updatedAt
    startChat
    stopChat
    updatedAt
    startChatCompleted
    startMeetingSchedulingChat
    startMeetingSchedulingChatCompleted
    startVideoInterviewChat
    startVideoInterviewChatCompleted
    position
  }
}`

  