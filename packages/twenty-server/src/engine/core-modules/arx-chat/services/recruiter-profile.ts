import { findWorkspaceMemberProfiles, graphqlQueryToGetCurrentUser, Jobs, RecruiterProfileType } from 'twenty-shared';
import { axiosRequest } from '../utils/arx-chat-agent-utils';


export async function getRecruiterProfileByJob(candidateJob: Jobs, apiToken: string) {

  const recruiterId = candidateJob?.recruiterId;

  console.log("recruiterId:", recruiterId);
  const findWorkspaceMemberProfilesQuery = JSON.stringify({
    query: findWorkspaceMemberProfiles,
    variables: { filter: { workspaceMemberId: { eq: recruiterId } } },
  });
  const workspaceMemberProfilesResponse = await axiosRequest(findWorkspaceMemberProfilesQuery, apiToken);
  // console.log("workspaceMemberProfilesResponse:", workspaceMemberProfilesResponse);
  // console.log("workspaceMemberProfilesResponse:", workspaceMemberProfilesResponse.data.data.workspaceMemberProfiles.edges[0]);
  // console.log("workspaceMemberProfilesResponse:", workspaceMemberProfilesResponse.data.data.workspaceMemberProfiles.edges[0]);
  const recruiterProfile:RecruiterProfileType = workspaceMemberProfilesResponse?.data?.data?.workspaceMemberProfiles?.edges[0]?.node;
  console.log("Got this recruiterProfile:", recruiterProfile);
  return recruiterProfile;
}


export async function getRecruiterProfileByRecruiterId(recruiterId: string, apiToken: string) {
  const findWorkspaceMemberProfilesQuery = JSON.stringify({
    query: findWorkspaceMemberProfiles,
    variables: { filter: { workspaceMemberId: { eq: recruiterId } } },
  });
  const workspaceMemberProfilesResponse = await axiosRequest(findWorkspaceMemberProfilesQuery, apiToken);
  const recruiterProfile:RecruiterProfileType = workspaceMemberProfilesResponse?.data?.workspaceMemberProfiles?.edges[0]?.node;
  return recruiterProfile;
}

export async function getCurrentUser(apiToken: string) {

  const getCurrentUserQuery = JSON.stringify({
    query: graphqlQueryToGetCurrentUser,
    variables: {}
  });

  const response = await axiosRequest(getCurrentUserQuery, apiToken);
  return response.data?.currentUser;
}


export async function getRecruiterProfileFromCurrentUser(apiToken: string) {
  const currentUser = await getCurrentUser(apiToken);
  const recruiterId = currentUser?.workspaces[0].workspaceMember?.id;
  const recruiterProfile:RecruiterProfileType = await getRecruiterProfileByRecruiterId(recruiterId, apiToken);

  return recruiterProfile
}