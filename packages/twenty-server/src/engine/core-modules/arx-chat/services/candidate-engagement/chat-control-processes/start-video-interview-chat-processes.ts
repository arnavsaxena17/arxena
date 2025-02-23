import { v4 } from 'uuid';
import * as allDataObjects from '../../data-model-objects';
import { FilterCandidates } from '../filter-candidates';

import * as allGraphQLQueries from '../../../graphql-queries/graphql-queries-chatbot';
import { WorkspaceQueryService } from '../../../../workspace-modifications/workspace-modifications.service';
import { axiosRequest } from '../../../utils/arx-chat-agent-utils';
export class StartVideoInterviewChatProcesses {
  constructor(private readonly workspaceQueryService: WorkspaceQueryService) {}


  async setupVideoInterviewLinks(peopleEngagementStartVideoInterviewChatArr: allDataObjects.PersonNode[], candidateJob: allDataObjects.Jobs, chatControl: allDataObjects.chatControls, apiToken: string) {
    if (chatControl.chatControlType === 'startVideoInterviewChat') {
      let skippedCount = 0;
      let createdCount = 0;
      for (const personNode of peopleEngagementStartVideoInterviewChatArr) {
        const candidateNode = personNode?.candidates?.edges[0]?.node;
        const videoInterview = candidateNode?.videoInterview?.edges[0]?.node;
        if (!videoInterview || !videoInterview.interviewLink?.url) {
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
      const candidateObj: allDataObjects.CandidateNode = await new FilterCandidates(this.workspaceQueryService).fetchCandidateByCandidateId(candidateId, apiToken);
      const jobId = candidateObj?.jobs?.id;
      console.log('jobId:', jobId);
      const interviewObj = await new FilterCandidates(this.workspaceQueryService).getInterviewByJobId(jobId, apiToken);
      console.log('interviewObj:::', interviewObj);
      const videoInterviewId = v4();
      const graphqlQueryObj = JSON.stringify({
        query: allGraphQLQueries.graphqlQueryToCreateVideoInterview,
        variables: {
          input: {
            id: videoInterviewId,
            candidateId: candidateObj?.id,
            name: 'Interview - ' + candidateObj?.name + ' for ' + candidateObj?.jobs?.name,
            videoInterviewTemplateId: interviewObj?.id,
            interviewStarted: false,
            interviewCompleted: false,
            interviewLink: {
              url: '/video-interview/' + videoInterviewId,
              label: '/video-interview/' + videoInterviewId,
            },
            interviewReviewLink: {
              url: '/video-interview-review/' + candidateObj?.id,
              label: '/video-interview-review/' + candidateObj?.id,
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
