// chat-flow-manager.ts
// import { ChatFlowConfig, ChatProcessResult } from './chat-flow-types';
// import { axiosRequest } from './utils/arx-chat-agent-utils';

import{ axiosRequest } from '../utils/arx-chat-agent-utils';
import { TimeManagement } from '../services/candidate-engagement/scheduling-agent';
import * as allDataObjects from './data-model-objects';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import * as allGraphQLQueries from '../graphql-queries/graphql-queries-chatbot';

export class ChatFlowManager {
  constructor(
    private readonly config: allDataObjects.ChatFlowConfig,
    private readonly workspaceQueryService: WorkspaceQueryService
  ) {}

  async processNode(
    nodeKey: string,
    candidates: any[],
    job: any,
    chatControl: any,
    apiToken: string
  ): Promise<void> {
    const node = this.config[nodeKey];
    
    // 1. Setup phase (e.g., creating video interview links)
    if (node.setup) {
      await node.setup(candidates, job, chatControl, apiToken);
    }

    // 2. Filter eligible candidates
    const eligibleCandidates = candidates.filter(candidate => 
      node.eligibilityCheck?.(candidate, chatControl) ?? true
    );

    // 3. Initial engagement (sending first messages)
    if (node.engage) {
      await node.engage(eligibleCandidates, job, chatControl, apiToken);
    }

    // 4. Process ongoing conversations
    // await this.processCandidateConversations(
    //   eligibleCandidates,
    //   job,
    //   chatControl,
    //   apiToken
    // );

    // // 5. Check conditions and trigger next nodes
    // await this.processNextNodes(eligibleCandidates, node, job, apiToken);
  }



  

  async getRecentCandidateIdsToMakeUpdatesonChats(
    apiToken: string,
    startTime: Date,
    endTime: Date
  ): Promise<allDataObjects.ChatProcessResult> {
    try {
      const graphqlQueryObj = JSON.stringify({
        query: allGraphQLQueries.graphQlToFetchWhatsappMessages,
        variables: {
          filter: {
            createdAt: {
              gte: startTime.toISOString(),
              lte: endTime.toISOString()
            }
          },
          orderBy: [{ position: 'AscNullsFirst' }]
        }
      });

      const data = await axiosRequest(graphqlQueryObj, apiToken);
      const messages = data?.data?.data.whatsappMessages?.edges || [];

      const filteredMessages = messages.filter(edge => 
        !edge.node.candidate.startMeetingSchedulingChat && 
        !edge.node.candidate.startVideoInterviewChat
      );

      return {
        candidateIds: Array.from(new Set(
          filteredMessages.map(edge => edge?.node?.candidateId)
        )),
        jobIds: Array.from(new Set(
          filteredMessages.map(edge => edge?.node?.jobsId)
        ))
      };
    } catch (error) {
      console.log('Error fetching recent WhatsApp messages:', error);
      return { candidateIds: [], jobIds: [] };
    }
  }

  private async createChatControl(
    candidateId: string,
    chatControlType: string,
    apiToken: string
  ): Promise<void> {
    const graphqlVariables = {
      idToUpdate: candidateId,
      input: { [chatControlType]: true }
    };
    
    const graphqlQueryObj = JSON.stringify({
      query: allGraphQLQueries.graphQltoUpdateOneCandidate,
      variables: graphqlVariables
    });

    await axiosRequest(graphqlQueryObj, apiToken);
  }
}