import * as allDataObjects from '../data-model-objects';
import { ToolCallingAgents } from './tool-calling-agents';

import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { Transformations } from '../candidate-engagement/transformations';

import * as allGraphQLQueries from '../../graphql-queries/graphql-queries-chatbot';
import CandidateEngagementArx from '../candidate-engagement/candidate-engagement';
import { zodResponseFormat } from 'openai/helpers/zod';
import { axiosRequest } from '../../utils/arx-chat-agent-utils';
import { PromptingAgents } from './prompting-agents';

const modelName = 'gpt-4o';

export class StageWiseClassification{
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService
  ) {}

  async getStageOfTheConversation(personNode:allDataObjects.PersonNode, mostRecentMessageArr: allDataObjects.ChatHistoryItem[]) {
      let stage: string | null;
      console.log('got here to get the stage of the conversation');
        const stagePrompt = await new PromptingAgents(this.workspaceQueryService).getStagePrompt();
        // console.log('got here to with the stage prompt', stagePrompt);
        const updatedMostRecentMessagesBasedOnNewSystemPrompt = await new Transformations().updateMostRecentMessagesBasedOnNewSystemPrompt(mostRecentMessageArr, stagePrompt);
        console.log('Got the updated recement messages for stage prompt:', updatedMostRecentMessagesBasedOnNewSystemPrompt);
        // @ts-ignore
        const response = await new this.workspaceQueryService.llmProviders.openAIclient.chat.completions.create({ model: modelName, messages: updatedMostRecentMessagesBasedOnNewSystemPrompt });
        console.log("This is the stage that is arrived at:::", response.choices[0].message.content)
        stage = response.choices[0].message.content ?? '1';
        console.log('This the stage that is determined by the model:', response.choices[0].message.content);
      // }
      console.log('This is the stage that is arrived at:', stage);
      return stage;
    }


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
    async getChatStageFromChatHistory(messages: any, currentWorkspaceMemberId: any, apiToken: string) {
      // console.log("Stage Prompt is:::", stagePrompt);
      const localStagePrompt = await this.getChatPromptFromWorksPageMember(currentWorkspaceMemberId, apiToken);
      console.log('Local Stage Prompt is:::', localStagePrompt);
      let mostRecentMessageArr: allDataObjects.ChatHistoryItem[] = new Transformations().getMostRecentMessageFromMessagesList(messages);
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
      console.log('Human readable conversation:\n', humanReadableConversation);
      // mostRecentMessageArr[0] = { role: 'system', content: stagePrompt };
      const messagesToLLM = [ { role: 'system', content: localStagePrompt }, { role: 'user', content: humanReadableConversation } ];
      console.log('Messages to LLM:::', messagesToLLM);
      console.log('Finally Sent messages for converation classificaation to OpenAI:::', mostRecentMessageArr);
  
      // @ts-ignore
      const completion = await this.workspaceQueryService.llmProviders.openAIclient.beta.chat.completions.parse({
        model: 'gpt-4o',
        messages: messagesToLLM,
        response_format: zodResponseFormat(new ToolCallingAgents(this.workspaceQueryService).currentConversationStage, 'conversationStage'),
      });
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

