import { zodResponseFormat } from 'openai/helpers/zod';
import { ChatCompletionMessageParam } from 'openai/resources';
import { ChatHistoryItem, FindManyWorkspaceMembers } from 'twenty-shared';

import { FilterCandidates } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/filter-candidates';
import { PromptingAgents } from 'src/engine/core-modules/arx-chat/services/llm-agents/prompting-agents';
import { ToolCallingAgents } from 'src/engine/core-modules/arx-chat/services/llm-agents/tool-calling-agents';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';


export class StageWiseClassification {
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService : StaticGraphQLService,
  ) {}

  async getChatPromptFromWorksPageMember(
    currentWorkspaceMemberId: any,
    apiToken: string,
  ) {
    try {
      const response = await this.staticGraphQLService.executeGraphQL(
        FindManyWorkspaceMembers,
        { filter: { id: { eq: currentWorkspaceMemberId } } },
        apiToken,
      );
      const prompts =
        response.data.data.workspaceMembers.edges[0].node.prompts.edges;

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

  async getChatStageFromChatHistory(
    messages: any,
    candidateId: string,
    projectId: string,
    apiToken: string,
  ) {
    // const stagePrompt = await new PromptingAgents(this.workspaceQueryService).getStagePrompt();
    console.log('Getting stage from projectIdy:::', projectId);
    console.log('Getting stage from candidateId:::', candidateId);
    const localStagePrompt = await new PromptingAgents(
      this.workspaceQueryService,
      this.staticGraphQLService,
    ).getPromptByProjectIdAndName(
      projectId,
      'PROMPT_FOR_CHAT_CLASSIFICATION',
      apiToken,
    );

    const mostRecentMessageArr: ChatHistoryItem[] = new FilterCandidates(
      this.workspaceQueryService,
      this.staticGraphQLService,
    ).getMostRecentMessageFromMessagesList(messages);

    function generateHumanReadableConversation(
      messages: ChatHistoryItem[],
    ): string {
      return messages
        .slice(2)
        .map((message) => {
          const role = message.role === 'user' ? 'Candidate' : 'Recruiter';

          return `${role}: ${message?.content}`;
        })
        .join('\n\n');
    }
    const humanReadableConversation =
      generateHumanReadableConversation(mostRecentMessageArr);


    // mostRecentMessageArr[0] = { role: 'system', content: stagePrompt };
    const messagesToLLM: ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: localStagePrompt,
      },
      {
        role: 'user',
        content: humanReadableConversation,
      },
    ];

    const workspaceId =
      await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
    const llmClients =
      await this.workspaceQueryService.initializeLLMClients(workspaceId);
    
    if (!llmClients || !llmClients.openAIclient) {
      console.error('OpenAI client not initialized properly');
      return 'ONLY_ADDED_NO_CONVERSATION';
    }
    
    const { openAIclient } = llmClients;
    
    try {
      const completion = await openAIclient.chat.completions.create({
        model: 'gpt-5.1-chat-latest',
        messages: messagesToLLM,
        response_format: zodResponseFormat(
          new ToolCallingAgents(
            this.workspaceQueryService,
            this.staticGraphQLService,
          )
            .currentConversationStage,
          'conversationStage',
        ),
      });
      
      if (!completion || !completion.choices || !completion.choices[0]) {
        console.error('Invalid completion response from OpenAI');
        return 'ONLY_ADDED_NO_CONVERSATION';
      }
      
      const content = completion.choices[0].message.content;
      
      if (!content) {
        console.log('No content in completion response');
        return 'ONLY_ADDED_NO_CONVERSATION';
      }

      try {
        const conversationStage = JSON.parse(content) as {
          stageOfTheConversation: string;
        };

        if (conversationStage && conversationStage.stageOfTheConversation) {
          console.log(
            'This is the stage that is arrived at:::',
            conversationStage.stageOfTheConversation,
          );

          return conversationStage.stageOfTheConversation;
        } else {
          console.log('Invalid conversation stage structure');
          return 'ONLY_ADDED_NO_CONVERSATION';
        }
      } catch (parseError) {
        console.error('Error parsing conversation stage JSON:', parseError);
        return 'ONLY_ADDED_NO_CONVERSATION';
      }
    } catch (error) {
      console.error('Error calling OpenAI API for stage classification:', error);
      return 'ONLY_ADDED_NO_CONVERSATION';
    }
  }
}
