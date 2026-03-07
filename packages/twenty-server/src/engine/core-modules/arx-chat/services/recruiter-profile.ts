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

  async getRecruiterProfileByJob(
    candidateJob: Job,
    apiToken: string,
  ): Promise<RecruiterProfileType | null> {
    const recruiterId = candidateJob?.recruiterId;
    if (!recruiterId) {
      console.warn(
        '[RecruiterProfileService] Job has no recruiterId, cannot resolve recruiter profile',
        candidateJob?.id,
      );
      return null;
    }
    const workspaceMemberProfilesResponse =
      await this.staticGraphQLService.executeGraphQL(
        findWorkspaceMemberProfiles,
        { filter: { workspaceMemberId: { eq: recruiterId } } },
        apiToken,
      );
    const recruiterProfile: RecruiterProfileType | null =
      workspaceMemberProfilesResponse?.data?.data?.workspaceMemberProfiles
        ?.edges?.[0]?.node ?? null;
    if (recruiterProfile) {
      console.log(
        'Got this recruiterProfile name:',
        recruiterProfile.name,
      );
    }
    return recruiterProfile;
  }

 async  getRecruiterProfileByRecruiterId(
  recruiterId: string,
  apiToken: string,
) {
  console.log("Recruiter ID in getRecruiterProfileByRecruiterId:", recruiterId);
  const workspaceMemberProfilesResponse = await this.staticGraphQLService.executeGraphQL(findWorkspaceMemberProfiles, { filter: { workspaceMemberId: { eq: recruiterId } } }, apiToken);
  console.log('workspaceMemberProfilesResponse in get Recruiter Profile By RecruiterId:', workspaceMemberProfilesResponse.data);
  const recruiterProfile: RecruiterProfileType =
    workspaceMemberProfilesResponse?.data?.data?.workspaceMemberProfiles?.edges[0]?.node;
  return recruiterProfile;
}

 async getCurrentUser(apiToken: string, origin: string) {
  console.log('Getting current user:: for origin:', origin);
  const getCurrentUserQuery = JSON.stringify({
    query: graphqlQueryToGetCurrentUser,
    variables: {},
  });
  const response = await axiosRequest(getCurrentUserQuery, apiToken, origin);
  return response.data?.data?.currentUser;
}

 async  getRecruiterProfileFromCurrentUser(apiToken: string, origin: string) {
  const currentUser = await this.getCurrentUser(apiToken, origin);
  console.log('currentUser in getRecruiter ProfileFrom CurrentUser:', currentUser);
  const recruiterId = currentUser?.workspaceMember?.id;

  console.log('recruiterId in getRecruiterProfileFromCurrentUser:', recruiterId);
  const recruiterProfile: RecruiterProfileType =
    await this.getRecruiterProfileByRecruiterId(recruiterId, apiToken);

  return recruiterProfile;
}


}