import { Jobs, RecruiterProfileType } from 'twenty-shared';
import { axiosRequest } from '../utils/arx-chat-agent-utils';


const query = `query FindManyWorkspaceMemberProfiles($filter: WorkspaceMemberProfileFilterInput, $orderBy: [WorkspaceMemberProfileOrderByInput], $lastCursor: String, $limit: Int) {
  workspaceMemberProfiles(
    filter: $filter
    orderBy: $orderBy
    first: $limit
    after: $lastCursor
  ) {
    edges {
      node {
        __typename
        id
        email
        phoneNumber
        companyName 
        companyDescription
        lastName
        jobTitle
        createdAt
        phoneNumber
        name
        firstName
        typeWorkspaceMember
        email
        companyName
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
}`;
export async function getRecruiterProfileByJob(candidateJob: Jobs, apiToken: string) {

  const recruiterId = candidateJob?.recruiterId;

  console.log("recruiterId:", recruiterId);
  const findWorkspaceMemberProfilesQuery = JSON.stringify({
    query: query,
    variables: { filter: { workspaceMemberId: { eq: recruiterId } } },
  });
  const workspaceMemberProfilesResponse = await axiosRequest(findWorkspaceMemberProfilesQuery, apiToken);
  // console.log("workspaceMemberProfilesResponse:", workspaceMemberProfilesResponse);
  // console.log("workspaceMemberProfilesResponse:", workspaceMemberProfilesResponse.data.data.workspaceMemberProfiles.edges[0]);
  // console.log("workspaceMemberProfilesResponse:", workspaceMemberProfilesResponse.data.data.workspaceMemberProfiles.edges[0]);
  const recruiterProfile:RecruiterProfileType = workspaceMemberProfilesResponse?.data?.data?.workspaceMemberProfiles?.edges[0]?.node;
  return recruiterProfile;
}


export async function getRecruiterProfileByRecruiterId(recruiterId: string, apiToken: string) {
  const findWorkspaceMemberProfilesQuery = JSON.stringify({
    query: query,
    variables: { filter: { workspaceMemberId: { eq: recruiterId } } },
  });
  const workspaceMemberProfilesResponse = await axiosRequest(findWorkspaceMemberProfilesQuery, apiToken);
  const recruiterProfile:RecruiterProfileType = workspaceMemberProfilesResponse?.data?.workspaceMemberProfiles?.edges[0]?.node;
  return recruiterProfile;
}

export async function getCurrentUser(apiToken: string) {
  const query = `query GetCurrentUser {
    currentUser {
      id
      firstName
      lastName
      email
      canImpersonate
      supportUserHash
      onboardingStep
      workspaceMember {
        id
        name {
          firstName
          lastName
        }
        colorScheme
        avatarUrl
        locale
      }
      defaultWorkspace {
        id
        displayName
        logo
        domainName
        inviteHash
        allowImpersonation
        subscriptionStatus
        activationStatus
        featureFlags {
          id
          key
          value
          workspaceId
        }
        currentCacheVersion
        currentBillingSubscription {
          id
          status
          interval
        }
      }
      workspaces {
        workspace {
          id
          logo
          displayName
          domainName
        }
      }
    }
  }`;

  const getCurrentUserQuery = JSON.stringify({
    query: query,
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