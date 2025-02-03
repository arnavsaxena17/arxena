import { v4 } from 'uuid';
import * as allDataObjects from '../../data-model-objects';
import { FilterCandidates } from '../filter-candidates';

import * as allGraphQLQueries from '../../../graphql-queries/graphql-queries-chatbot';
import { WorkspaceQueryService } from '../../../../workspace-modifications/workspace-modifications.service';
import { axiosRequest } from '../../../utils/arx-chat-agent-utils';
import { TimeManagement } from '../scheduling-agent';

export class StartVideoInterviewChatProcesses {
  constructor(private readonly workspaceQueryService: WorkspaceQueryService) {}

  private isWithinMorningWindow(): boolean {
    const currentTime = new Date();
    const hours = currentTime.getHours();
    return hours >= 8 && hours < 9; // 8 AM to 9 AM IST
  }

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

  async getCandidateIdsWithVideoInterviewCompleted(apiToken: string): Promise<string[]> {
    if (!this.isWithinMorningWindow()) {
      return [];
    }

    let allCandidates = await new FilterCandidates(this.workspaceQueryService).fetchAllCandidatesWithSpecificChatControl('startVideoInterviewChat', apiToken);
    console.log('Fetched', allCandidates?.length, ' candidates with chatControl startVideoInterviewChat');
    if (allCandidates.length > 0) {
      const timeWindow = TimeManagement.timeDifferentials.timeDifferentialinHoursForCheckingCandidateIdsWithVideoInterviewCompleted;

      const currentTime = new Date();
      const cutoffTime = new Date(currentTime.getTime() - timeWindow * 60 * 60 * 1000);
      const sixHoursAgo = new Date(Date.now() - TimeManagement.timeDifferentials.timeDifferentialinHoursForCheckingCandidateIdsWithVideoInterviewCompleted * 60 * 60 * 1000).toISOString();
      console.log('Date.now() sixHoursAgo::', sixHoursAgo);
      console.log('Date.now() for video interview compeleted::::', new Date(Date.now()).toISOString());
      const candidateIdsWithVideoInterviewCompleted = allCandidates
        .filter(candidate => {
          const hasCompletedInterview = candidate?.videoInterview?.edges[0]?.node?.interviewCompleted;
          if (!hasCompletedInterview) {
            return false;
          }
          const updatedAt = candidate?.videoInterview?.edges[0]?.node?.updatedAt;
          if (!updatedAt) {
            return false;
          }
          const interviewCompletionTime = new Date(updatedAt);
          const isWithinTimeWindow = interviewCompletionTime >= cutoffTime && interviewCompletionTime <= currentTime;
          const meetingChatNotStarted = !candidate.startMeetingSchedulingChat;
          if (hasCompletedInterview) {
            console.log('Candidate ID:', candidate.id);
            console.log('Interview completion time:', interviewCompletionTime.toISOString());
            console.log('Within time window:', isWithinTimeWindow);
            console.log('Meeting chat not started:', meetingChatNotStarted);
          }
          return hasCompletedInterview && isWithinTimeWindow && meetingChatNotStarted;
        })
        .map(candidate => candidate.id);

      console.log('Found', candidateIdsWithVideoInterviewCompleted.length, 'candidates with completed video interviews within the time window');
      return candidateIdsWithVideoInterviewCompleted;
    } else {
      return [];
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
