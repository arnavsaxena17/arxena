import { v4 } from 'uuid';
import { FilterCandidates } from '../filter-candidates';

import { CandidateNode, ChatControlsObjType, graphqlQueryToCreateVideoInterview, Jobs, PersonNode } from 'twenty-shared';
import { WorkspaceQueryService } from '../../../../workspace-modifications/workspace-modifications.service';
import { axiosRequest } from '../../../utils/arx-chat-agent-utils';
export class StartVideoInterviewChatProcesses {
  constructor(private readonly workspaceQueryService: WorkspaceQueryService) {}
  async setupVideoInterviewLinks(peopleEngagementStartVideoInterviewChatArr: PersonNode[], candidateJob: Jobs, chatControl: ChatControlsObjType, apiToken: string) {
    if (chatControl.chatControlType === 'startVideoInterviewChat') {
      let skippedCount = 0;
      let createdCount = 0;
      for (const personNode of peopleEngagementStartVideoInterviewChatArr) {
        const candidateNode = personNode?.candidates?.edges[0]?.node;
        const videoInterview = candidateNode?.videoInterview?.edges[0]?.node;
        if (!videoInterview || !videoInterview.interviewLink?.primaryLinkUrl) {
          await this.createVideoInterviewForCandidate(candidateNode.id, apiToken);
          createdCount++;
        } else {
          skippedCount++;
        }
      }
      console.log(`Total candidates skipped for video interview creation: ${skippedCount}`);
      console.log(`Total video interviews created: ${createdCount}`);
    }
  }
  async createVideoInterviewForCandidate(candidateId: string, apiToken: string) {
    try {
      const candidateObj: CandidateNode = await new FilterCandidates(this.workspaceQueryService).fetchCandidateByCandidateId(candidateId, apiToken);
      const jobId = candidateObj?.jobs?.id;


      // Get workspace details
      const publicWorkspaceDataResponse = await axiosRequest(JSON.stringify({
        operationName: 'GetPublicWorkspaceDataByDomain',
        variables: {},
        query: `query GetPublicWorkspaceDataByDomain {
          getPublicWorkspaceDataByDomain {
            workspaceUrls {
              subdomainUrl
            }
          }
        }`
      }), apiToken);

      const subdomainUrl = publicWorkspaceDataResponse?.data?.data?.getPublicWorkspaceDataByDomain?.workspaceUrls?.subdomainUrl || 'https://app.arxena.com/';
      
      console.log('jobId:', jobId);
      const interviewObj = await new FilterCandidates(this.workspaceQueryService).getInterviewByJobId(jobId, apiToken);
      console.log('interviewObj:::', interviewObj);
      const videoInterviewId = v4();
      const graphqlQueryObj = JSON.stringify({
        query: graphqlQueryToCreateVideoInterview,
        variables: {
          input: {
            id: videoInterviewId,
            candidateId: candidateObj?.id,
            name: 'Interview - ' + candidateObj?.name + ' for ' + candidateObj?.jobs?.name,
            videoInterviewTemplateId: interviewObj?.id,
            interviewStarted: false,
            interviewCompleted: false,
            interviewLink: {
              primaryLinkUrl: subdomainUrl+ 'video-interview/' + videoInterviewId,
              primaryLinkLabel: subdomainUrl + 'video-interview/' + videoInterviewId,
            },
            interviewReviewLink: {
              primaryLinkUrl: subdomainUrl+ 'video-interview-review/' + videoInterviewId,
              primaryLinkLabel: subdomainUrl+ 'video-interview-review/' + videoInterviewId,
            },
            position: 'first',
          },
        },
      });

      const response = await axiosRequest(graphqlQueryObj, apiToken);
      if (response.data.errors) {
        console.log('Error in response for create interview for candidate:', response?.data?.errors);
      } else {
        console.log('Video Interview created successfully');
      }

      return response.data;
    } catch (error) {
      console.log('Error in creating video interview:', error.message);
    }
  }
}
