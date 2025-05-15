import {
  findWorkspaceMemberProfiles,
  graphqlQueryToGetCurrentUser,
  Jobs,
  RecruiterProfileType,
} from 'twenty-shared';

import { axiosRequest } from 'src/engine/core-modules/arx-chat/utils/arx-chat-agent-utils';

export async function getRecruiterProfileByJob(
  candidateJob: Jobs,
  apiToken: string,
) {
  const recruiterId = candidateJob?.recruiterId;

  console.log('recruiterId:', recruiterId);
  const findWorkspaceMemberProfilesQuery = JSON.stringify({
    query: findWorkspaceMemberProfiles,
    variables: { filter: { workspaceMemberId: { eq: recruiterId } } },
  });
  const workspaceMemberProfilesResponse = await axiosRequest(
    findWorkspaceMemberProfilesQuery,
    apiToken,
  );
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
  const workspaceMemberProfilesResponse = await axiosRequest(
    findWorkspaceMemberProfilesQuery,
    apiToken,
  );
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


  const response = await axiosRequest(getCurrentUserQuery, apiToken, origin);


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
