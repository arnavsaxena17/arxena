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
  const recruiterProfile: RecruiterProfileType =
    workspaceMemberProfilesResponse?.data?.workspaceMemberProfiles?.edges[0]
      ?.node;

  return recruiterProfile;
}

export async function getCurrentUser(apiToken: string) {
  console.log('Trying to get current user::');
  const getCurrentUserQuery = JSON.stringify({
    query: graphqlQueryToGetCurrentUser,
    variables: {},
  });

  console.log('getCurrentUserQuery:', getCurrentUserQuery);

  const response = await axiosRequest(getCurrentUserQuery, apiToken);

  console.log('response.data?.currentUser:', response.data);

  return response.data?.data?.currentUser;
}

export async function getRecruiterProfileFromCurrentUser(apiToken: string) {
  const currentUser = await getCurrentUser(apiToken);
  const recruiterId = currentUser?.workspaceMember?.id;

  console.log('recruiterId:', recruiterId);
  const recruiterProfile: RecruiterProfileType =
    await getRecruiterProfileByRecruiterId(recruiterId, apiToken);

  return recruiterProfile;
}
