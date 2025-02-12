import * as allDataObjects from '../data-model-objects';
import { ToolCallingAgents } from './tool-calling-agents';

import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

import * as allGraphQLQueries from '../../graphql-queries/graphql-queries-chatbot';
import CandidateEngagementArx from '../candidate-engagement/candidate-engagement';
import { zodResponseFormat } from 'openai/helpers/zod';
import { axiosRequest } from '../../utils/arx-chat-agent-utils';
import { PromptingAgents } from './prompting-agents';
import { JobCandidateUtils } from 'src/engine/core-modules/candidate-sourcing/utils/job-candidate-utils';
import { FilterCandidates } from '../candidate-engagement/filter-candidates';

const modelName = 'gpt-4o';

export class StageWiseClassification{
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService
  ) {}


    async getChatPromptFromWorksPageMember(currentWorkspaceMemberId: any, apiToken: string) {
      let data = JSON.stringify({
        query: allGraphQLQueries.graphqlQueryToFetchWorksPaceMembers,
        variables: { filter: { id: { eq: currentWorkspaceMemberId } } },
      });
      try {
        const response = await axiosRequest(data, apiToken);
        const prompts = response.data.data.workspaceMembers.edges[0].node.prompts.edges;
        if (prompts.length > 0) {
          return prompts[0].node.prompt;
        } else {
          throw new Error('No prompts found for the given workspace member.');
        }
      } catch (error) {
        console.error('Error fetching prompt:', error);
        throw error;
      }
    }

 

    async getChatStageFromChatHistory(messages: any,candidateId:string,jobId:string, apiToken: string) {
      // const stagePrompt = await new PromptingAgents(this.workspaceQueryService).getStagePrompt();
      console.log('Getting stage from jobIdy:::', jobId);
      console.log('Getting stage from candidateId:::', candidateId);
      const localStagePrompt = await new PromptingAgents(this.workspaceQueryService).getPromptByJobIdAndName(jobId, 'PROMPT_FOR_CHAT_CLASSIFICATION', apiToken);
      console.log('Local Stage Prompt is:::', localStagePrompt);
      let mostRecentMessageArr: allDataObjects.ChatHistoryItem[] = new FilterCandidates(this.workspaceQueryService).getMostRecentMessageFromMessagesList(messages);
      function generateHumanReadableConversation(messages: allDataObjects.ChatHistoryItem[]): string {
        return messages
          .slice(2)
          .map(message => {
            const role = message.role === 'user' ? 'Candidate' : 'Recruiter';
            return `${role}: ${message?.content}`;
          })
          .join('\n\n');
      }
      const humanReadableConversation = generateHumanReadableConversation(mostRecentMessageArr);
      console.log('Human readable conversation for statge classifcation from cahtshistory:\n', humanReadableConversation);
      // mostRecentMessageArr[0] = { role: 'system', content: stagePrompt };
      const messagesToLLM = [ { role: 'system', content: localStagePrompt }, { role: 'user', content: humanReadableConversation } ];
      console.log('Messages to LLM:::', messagesToLLM);
      console.log('Finally Sent messages for converation classificaation to OpenAI::: getting stage from chat historry::', mostRecentMessageArr );
      const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const { openAIclient } = await this.workspaceQueryService.initializeLLMClients(workspaceId);
      // @ts-ignore
      const completion = await openAIclient.beta.chat.completions.parse({ model: 'gpt-4o', messages: messagesToLLM, response_format: zodResponseFormat(new ToolCallingAgents(this.workspaceQueryService).currentConversationStage, 'conversationStage'), });
      const conversationStage = completion.choices[0].message.parsed as { stageOfTheConversation: string } | null;
      if (conversationStage) {
        console.log('This is the stage that is arrived at:::', conversationStage.stageOfTheConversation);
        return conversationStage.stageOfTheConversation;
      } else {
        console.log('Conversation stage is null');
        return 'ONLY_ADDED_NO_CONVERSATION';
      }
    }
  
}

