export const CreateOneJob = `
mutation CreateOneJob($input: JobCreateInput!) {
  createJob(data: $input) {
    __typename
  }
}`;

export const CreateManyPeople = `
mutation CreatePeople($data: [PersonCreateInput!]!) {
  createPeople(data: $data) {
    __typename
  }
}`;

export const CreateManyCandidates = `
mutation CreateCandidates($data: [CandidateCreateInput!]!) {
  createCandidates(data: $data) {
    __typename
  }
}`;

export const CreateOneCompany = `
mutation CreateOneCompany($input: CompanyCreateInput!) {
  createCompany(data: $input) {
    __typename
  }
}
`;
