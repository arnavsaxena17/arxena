
import * as allDataObjects from '../data-model-objects';
import * as allGraphQLQueries from '../candidate-engagement/graphql-queries-chatbot';
import CandidateEngagementArx from '../candidate-engagement/check-candidate-engagement';
import { zodResponseFormat } from "openai/helpers/zod";
import { ToolsForAgents } from './prompting-tool-calling';
import { axiosRequest } from '../../utils/arx-chat-agent-utils';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
const axios = require('axios');





export class GetCurrentStageByMessages{
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService
  ) {}
  async getChatPromptFromWorksPageMember(currentWorkspaceMemberId: any, apiToken:string) {
    let data = JSON.stringify({
        query: allGraphQLQueries.graphqlQueryToFetchWorksPaceMembers,
        variables: { filter: { id: { eq: currentWorkspaceMemberId } } }
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

async getChatStageFromChatHistory(messages: any, currentWorkspaceMemberId:any, apiToken:string) {
    // console.log("Stage Prompt is:::", stagePrompt);




    const localStagePrompt = await this.getChatPromptFromWorksPageMember(currentWorkspaceMemberId,apiToken);
    console.log("Local Stage Prompt is:::", localStagePrompt)
    let mostRecentMessageArr: allDataObjects.ChatHistoryItem[] = new CandidateEngagementArx(this.workspaceQueryService).getMostRecentMessageFromMessagesList(messages);
    function generateHumanReadableConversation(messages: allDataObjects.ChatHistoryItem[]): string {
        return messages.slice(2).map(message => {
            const role = message.role === 'user' ? 'Candidate' : 'Recruiter';
            return `${role}: ${message?.content}`;
        }).join('\n\n');
    }
    const humanReadableConversation = generateHumanReadableConversation(mostRecentMessageArr);
    console.log("Human readable conversation:\n", humanReadableConversation);
    // mostRecentMessageArr[0] = { role: 'system', content: stagePrompt };
    const messagesToLLM = [{ role: 'system', content: localStagePrompt }, { role: 'user', content: humanReadableConversation }];
    console.log("Messages to LLM:::", messagesToLLM);
    console.log("Finally Sent messages for converation classificaation to OpenAI:::", mostRecentMessageArr);

    // @ts-ignore
    const completion = await this.workspaceQueryService.llmProviders.openAIclient.beta.chat.completions.parse({ model: "gpt-4o", messages: messagesToLLM, response_format: zodResponseFormat(new ToolsForAgents().currentConversationStage, "conversationStage")});
    const conversationStage = completion.choices[0].message.parsed as { stageOfTheConversation: string } | null;
    if (conversationStage) {
        console.log("This is the stage that is arrived at:::", conversationStage.stageOfTheConversation);
        return conversationStage.stageOfTheConversation;
    } else {
        console.log("Conversation stage is null");
        return "ONLY_ADDED_NO_CONVERSATION";
    }
}

}
