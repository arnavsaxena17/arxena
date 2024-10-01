export const CreateOneJob = `
mutation CreateOneJob($input: JobCreateInput!) {
  createJob(data: $input) {
    __typename
    id
  }
}`;


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
    id
  }
}`;

export const CreateManyCandidates = `
mutation CreateCandidates($data: [CandidateCreateInput!]!) {
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

export const ObjectMetadataItems = `
  query ObjectMetadataItems($objectFilter: objectFilter) {
  objects(paging: {first: 1000},filter: $objectFilter) {
    edges {
      node {
        id
        nameSingular
        labelPlural
      }
    }
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
      id
      name
    }
  }
  `;

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
}
  `;


  export const graphQltoStartChat = `mutation UpdateOneCandidate($idToUpdate: ID!, $input: CandidateUpdateInput!) {
  updateCandidate(id: $idToUpdate, data: $input) {
    __typename
    engagementStatus
    whatsappProvider
    jobsId
    updatedAt
    startChat
    position
  }
}`

  export const graphQltoStopChat = `mutation UpdateOneCandidate($idToUpdate: ID!, $input: CandidateUpdateInput!) {
  updateCandidate(id: $idToUpdate, data: $input) {
    __typename
  }
}`