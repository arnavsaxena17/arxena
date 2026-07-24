import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import {
  findWorkspaceMemberProfiles,
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
  const workspaceMemberProfilesResponse = await this.staticGraphQLService.executeGraphQL(findWorkspaceMemberProfiles, { filter: { workspaceMemberId: { eq: recruiterId } } }, apiToken);
  const recruiterProfile: RecruiterProfileType =
    workspaceMemberProfilesResponse?.data?.data?.workspaceMemberProfiles?.edges[0]?.node;
  return recruiterProfile;
}

 async getCurrentUser(apiToken: string, origin?: string) {
  return this.staticGraphQLService.getCurrentUser(apiToken);
}

 async  getRecruiterProfileFromCurrentUser(apiToken: string, origin: string) {
  const currentUser = await this.getCurrentUser(apiToken, origin);
  const recruiterId = currentUser?.workspaceMember?.id;

  const recruiterProfile: RecruiterProfileType =
    await this.getRecruiterProfileByRecruiterId(recruiterId, apiToken);

  return recruiterProfile;
}


}