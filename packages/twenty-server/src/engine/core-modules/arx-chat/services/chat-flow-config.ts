// chat-flow-config.ts
import * as allDataObjects from './data-model-objects';
import { StartVideoInterviewChatProcesses } from '../services/candidate-engagement/chat-control-processes/start-video-interview-chat-processes';

export const defaultChatFlow: allDataObjects.ChatFlowConfig = {
  startChat: {
      chatControlType: 'startChat',
      nextNodes: ['startVideoInterviewChat', 'startMeetingSchedulingChat'],
      conditions: [
          {
              nextNode: 'startVideoInterviewChat',
              evaluator: (candidate) => candidate.candConversationStatus === 'CONVERSATION_CLOSED_TO_BE_CONTACTED'
          },
          {
              nextNode: 'startMeetingSchedulingChat',
              evaluator: (candidate) => candidate.status === 'CANDIDATE_IS_KEEN_TO_CHAT'
          }
      ],
      setup: async (candidates, job, chatControl, apiToken) => {
          // Implement the setup logic here
      },
      engage: function (candidates: any[], job: any, chatControl: any, apiToken: string): Promise<void> {
          throw new Error('Function not implemented.');
      },
      eligibilityCheck: function (candidate: any, chatControl: any): boolean {
          throw new Error('Function not implemented.');
      }
  },
  startVideoInterviewChat: {
      chatControlType: 'startVideoInterviewChat',
      nextNodes: ['startMeetingSchedulingChat'],
      conditions: [
          {
              nextNode: 'startMeetingSchedulingChat',
              evaluator: (candidate) => candidate.videoInterview?.edges[0]?.node?.interviewCompleted
          }
      ],
      setup: async (candidates, job, chatControl, apiToken) => {
          const videoInterviewProcess = new StartVideoInterviewChatProcesses();
          await videoInterviewProcess.setupVideoInterviewLinks(
              candidates,
              job,
              chatControl,
              apiToken
          );
      },
      engage: function (candidates: any[], job: any, chatControl: any, apiToken: string): Promise<void> {
          throw new Error('Function not implemented.');
      },
      eligibilityCheck: function (candidate: any, chatControl: any): boolean {
          throw new Error('Function not implemented.');
      }
  },
  startMeetingSchedulingChat: {
      chatControlType: 'startMeetingSchedulingChat',
      nextNodes: [],
      conditions: [],
      setup: async (candidates, job, chatControl, apiToken) => {
          // Implement the setup logic here
      },
      engage: function (candidates: any[], job: any, chatControl: any, apiToken: string): Promise<void> {
          throw new Error('Function not implemented.');
      },
      eligibilityCheck: function (candidate: any, chatControl: any): boolean {
          throw new Error('Function not implemented.');
      }
  }
};