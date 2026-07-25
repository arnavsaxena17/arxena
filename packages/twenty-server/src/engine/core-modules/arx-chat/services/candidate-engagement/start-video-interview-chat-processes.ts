import {
  CandidateNode,
  ChatControlsObjType,
  graphqlQueryToCreateVideoInterview
} from 'twenty-shared';
import { v4 } from 'uuid';

import { FilterCandidates } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/filter-candidates';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

export class VideoInterviewChatProcesses {
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
  ) {}

  async setupVideoInterviewLinks(
    peopleEngagementStartVideoInterviewChatArr: CandidateNode[],
    chatControl: ChatControlsObjType,
    apiToken: string,
  ) {
    if (chatControl.chatControlType === 'startVideoInterviewChat') {
      let skippedCount = 0;
      let createdCount = 0;

      for (const candidateNode of peopleEngagementStartVideoInterviewChatArr) {
        const videoInterview = candidateNode?.videoInterview?.edges[0]?.node;

        if (!videoInterview || !videoInterview.interviewLink?.primaryLinkUrl) {
          await this.createVideoInterviewLinksForCandidate(
            candidateNode.id,
            apiToken,
          );
          createdCount++;
        } else {
          skippedCount++;
        }
      }
      console.log(
        `Total candidates skipped for video interview creation: ${skippedCount}`,
      );
      console.log(`Total video interviews created: ${createdCount}`);
    }
  }

  async createVideoInterviewLinksForCandidate(
    candidateId: string,
    apiToken: string,
  ) {
    try {
      const candidateObj: CandidateNode = await new FilterCandidates(
        this.workspaceQueryService,
        this.staticGraphQLService,
      ).fetchCandidateByCandidateId(candidateId, apiToken);
      const projectId = candidateObj?.projects?.id;


      const publicWorkspaceDataByDomain = `query GetPublicWorkspaceDataByDomain {
          getPublicWorkspaceDataByDomain {
            workspaceUrls {
              subdomainUrl
            }
          }
        }`

      const publicWorkspaceDataResponse = await this.staticGraphQLService.executeGraphQL(publicWorkspaceDataByDomain, {}, apiToken);






      const subdomainUrl =
        publicWorkspaceDataResponse?.data?.data?.getPublicWorkspaceDataByDomain
          ?.workspaceUrls?.subdomainUrl || 'https://app.arxena.com/';

      console.log('subdomainUrl:', subdomainUrl);
      console.log(
        'getPublicWorkspaceDataByDomain:',
        publicWorkspaceDataResponse?.data?.data?.getPublicWorkspaceDataByDomain,
      );

      console.log('projectId:', projectId);
      const interviewObj = await new FilterCandidates(
        this.workspaceQueryService,
        this.staticGraphQLService,
      ).getInterviewByProjectId(projectId, apiToken);

      console.log('interviewObj:::', interviewObj);
      const videoInterviewId = v4();
      const videoInterviewLink =
        subdomainUrl + 'video-interview/' + videoInterviewId;
      const graphqlQueryObj = JSON.stringify({
        query: graphqlQueryToCreateVideoInterview,
        variables: {
          input: {
            id: videoInterviewId,
            candidateId: candidateObj?.id,
            name:
              'Interview - ' +
              candidateObj?.name +
              ' for ' +
              candidateObj?.projects?.name,
            videoInterviewTemplateId: interviewObj?.id,
            interviewStarted: false,
            interviewCompleted: false,
            interviewLink: {
              primaryLinkUrl:
                subdomainUrl + 'video-interview/' + videoInterviewId,
              primaryLinkLabel:
                subdomainUrl + 'video-interview/' + videoInterviewId,
            },
            interviewReviewLink: {
              primaryLinkUrl: videoInterviewLink,
              primaryLinkLabel: videoInterviewLink,
            },
            position: 'first',
          },
        },
      });

      const response = await this.staticGraphQLService.executeGraphQL(graphqlQueryToCreateVideoInterview, { input: { id: videoInterviewId, candidateId: candidateObj?.id, name: 'Interview - ' + candidateObj?.name + ' for ' + candidateObj?.projects?.name, videoInterviewTemplateId: interviewObj?.id, interviewStarted: false, interviewCompleted: false, interviewLink: { primaryLinkUrl: videoInterviewLink, primaryLinkLabel: videoInterviewLink }, interviewReviewLink: { primaryLinkUrl: videoInterviewLink, primaryLinkLabel: videoInterviewLink }, position: 'first' } }, apiToken);

      if (response.data.errors) {
        console.log(
          'Error in response for create interview for candidate:',
          response?.data?.errors,
        );
      } else {
        console.log('Video Interview created successfully');
      }

      return response.data;
    } catch (error) {
      console.log('Error in creating video interview:', error.message);
    }
  }
}
