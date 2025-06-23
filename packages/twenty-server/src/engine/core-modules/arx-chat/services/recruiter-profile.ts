import {
  findWorkspaceMemberProfiles,
  graphqlQueryToGetCurrentUser,
  Job,
  RecruiterProfileType
} from 'twenty-shared';


export async function getRecruiterProfileByJob(
  candidateJob: Job,
  apiToken: string,
) {
  const recruiterId = candidateJob?.recruiterId;

  console.log('recruiterId:', recruiterId);
  const findWorkspaceMemberProfilesQuery = JSON.stringify({
    query: findWorkspaceMemberProfiles,
    variables: { filter: { workspaceMemberId: { eq: recruiterId } } },
  });

  const workspaceMemberProfilesResponse = await this.staticGraphQLService.executeGraphQL(findWorkspaceMemberProfiles, { filter: { workspaceMemberId: { eq: recruiterId } } }, apiToken);
  const recruiterProfile: RecruiterProfileType =
    workspaceMemberProfilesResponse?.data?.data?.workspaceMemberProfiles
      ?.edges[0]?.node;
  console.log('Got this recruiterProfile:', recruiterProfile);
  return recruiterProfile;
}

export async function getRecruiterProfileByRecruiterId(
  recruiterId: string,
  apiToken: string,
) {
  const findWorkspaceMemberProfilesQuery = JSON.stringify({
    query: findWorkspaceMemberProfiles,
    variables: { filter: { workspaceMemberId: { eq: recruiterId } } },
  });

  const workspaceMemberProfilesResponse = await this.staticGraphQLService.executeGraphQL(findWorkspaceMemberProfiles, { filter: { workspaceMemberId: { eq: recruiterId } } }, apiToken);
  console.log('workspaceMemberProfilesResponse:', workspaceMemberProfilesResponse.data);
  const recruiterProfile: RecruiterProfileType =
    workspaceMemberProfilesResponse?.data?.data?.workspaceMemberProfiles?.edges[0]
      ?.node;

  console.log('recruiterProfile is this:', recruiterProfile);
  return recruiterProfile;
}

export async function getCurrentUser(apiToken: string, origin: string) {
  const getCurrentUserQuery = JSON.stringify({
    query: graphqlQueryToGetCurrentUser,
    variables: {},
  });


  const response = await this.staticGraphQLService.executeGraphQL(graphqlQueryToGetCurrentUser, {}, apiToken);


  return response.data?.data?.currentUser;
}

export async function getRecruiterProfileFromCurrentUser(apiToken: string, origin: string) {
  console.log('Getting recruiter profile from current user::');
  const currentUser = await getCurrentUser(apiToken, origin);
  console.log('currentUser:', currentUser);
  const recruiterId = currentUser?.workspaceMember?.id;

  console.log('recruiterId:', recruiterId);
  const recruiterProfile: RecruiterProfileType =
    await getRecruiterProfileByRecruiterId(recruiterId, apiToken);

  return recruiterProfile;
}
