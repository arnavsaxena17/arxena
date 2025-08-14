import { axiosRequest } from 'src/engine/core-modules/candidate-sourcing/utils/utils';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import {
  findWorkspaceMemberProfiles,
  graphqlQueryToGetCurrentUser,
  Job,
  RecruiterProfileType
} from 'twenty-shared';



export class RecruiterProfileService {
  constructor(private readonly staticGraphQLService: StaticGraphQLService) {}

   async  getRecruiterProfileByJob(
  candidateJob: Job,
  apiToken: string,
) {
  const recruiterId = candidateJob?.recruiterId;
  console.log('recruiterId in getRecruiterProfileByJob:', recruiterId);
  const workspaceMemberProfilesResponse = await this.staticGraphQLService.executeGraphQL(findWorkspaceMemberProfiles, { filter: { workspaceMemberId: { eq: recruiterId } } } , apiToken);
  const recruiterProfile: RecruiterProfileType = workspaceMemberProfilesResponse?.data?.data?.workspaceMemberProfiles?.edges[0]?.node;
  console.log('Got this recruiterProfile:', recruiterProfile);
  return recruiterProfile;
}

 async  getRecruiterProfileByRecruiterId(
  recruiterId: string,
  apiToken: string,
) {
  console.log("Recruiter ID in getRecruiterProfileByRecruiterId:", recruiterId);
  const workspaceMemberProfilesResponse = await this.staticGraphQLService.executeGraphQL(findWorkspaceMemberProfiles, { filter: { workspaceMemberId: { eq: recruiterId } } }, apiToken);
  console.log('workspaceMemberProfilesResponse in getRecruiterProfileByRecruiterId:', workspaceMemberProfilesResponse.data);
  const recruiterProfile: RecruiterProfileType =
    workspaceMemberProfilesResponse?.data?.data?.workspaceMemberProfiles?.edges[0]
      ?.node;

    console.log("Number of recruiter profiles:", workspaceMemberProfilesResponse?.data?.data?.workspaceMemberProfiles?.edges?.length);
  console.log('recruiterProfile is this:', recruiterProfile);
  return recruiterProfile;
}

 async  getCurrentUser(apiToken: string, origin: string) {
  console.log('Getting current user::');
  const getCurrentUserQuery = JSON.stringify({
    query: graphqlQueryToGetCurrentUser,
    variables: {},
  });



  // const response = await this.staticGraphQLService.executeGraphQL(graphqlQueryToGetCurrentUser, {}, apiToken);
  const response = await axiosRequest(getCurrentUserQuery, apiToken, origin);

  return response.data?.data?.currentUser;
}

 async  getRecruiterProfileFromCurrentUser(apiToken: string, origin: string) {
  console.log('Getting recruiter profile from current user::');
  const currentUser = await this.getCurrentUser(apiToken, origin);
  console.log('currentUser in getRecruiter ProfileFrom CurrentUser:', currentUser);
  const recruiterId = currentUser?.workspaceMember?.id;

  console.log('recruiterId in getRecruiterProfileFromCurrentUser:', recruiterId);
  const recruiterProfile: RecruiterProfileType =
    await this.getRecruiterProfileByRecruiterId(recruiterId, apiToken);

  return recruiterProfile;
}


}