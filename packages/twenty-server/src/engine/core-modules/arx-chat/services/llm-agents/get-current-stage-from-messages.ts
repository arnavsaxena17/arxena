
// import { shareJDtoCandidate, updateAnswerInDatabase, updateCandidateStatus } from './tool-calls-processing';
import * as allDataObjects from '../data-model-objects';
// import { FetchAndUpdateCandidatesChatsWhatsapps } from '../candidate-engagement/update-chat';
import * as allGraphQLQueries from '../candidate-engagement/graphql-queries-chatbot';
// import fuzzy from 'fuzzy';
import CandidateEngagementArx from '../candidate-engagement/check-candidate-engagement';
// import { CalendarEventType } from '../../../calendar-events/services/calendar-data-objects-types';
// import { CalendarEmailService } from '../candidate-engagement/calendar-email';
// import { MailerController } from '../../../gmail-sender/gmail-sender.controller';
// import { SendEmailFunctionality } from '../candidate-engagement/send-gmail';
// import { GmailMessageData } from 'src/engine/core-modules/gmail-sender/services/gmail-sender-objects-types';
// import * as allGraphQLQueries from '../candidate-engagement/graphql-queries-chatbot';
// import { addHoursInDate, axiosRequest, toIsoString } from '../../utils/arx-chat-agent-utils';
import { zodResponseFormat } from "openai/helpers/zod";
// import { z } from "zod";
// import { OpenAI } from "openai";
// import { getStageOfTheConversation } from './get-stage-wise-classification';
import { ToolsForAgents } from './prompting-tool-calling';
import { LLMProviders } from './llm-agents';
import { axiosRequest } from '../../utils/arx-chat-agent-utils';
const axios = require('axios');


async function getChatPromptFromWorksPageMember(currentWorkspaceMemberId: any) {
    let data = JSON.stringify({
        query: allGraphQLQueries.graphqlQueryToFetchWorksPaceMembers,
        variables: { filter: { id: { eq: currentWorkspaceMemberId } } }
    });
    try {
        const response = await axiosRequest(data);
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

export async function getChatStageFromChatHistory(messages: any, currentWorkspaceMemberId:any) {
    // console.log("Stage Prompt is:::", stagePrompt);
    const localStagePrompt = await getChatPromptFromWorksPageMember(currentWorkspaceMemberId);
    console.log("Local Stage Prompt is:::", localStagePrompt)
    let mostRecentMessageArr: allDataObjects.ChatHistoryItem[] = new CandidateEngagementArx().getMostRecentMessageFromMessagesList(messages);
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
    const completion = await new LLMProviders().openAIclient.beta.chat.completions.parse({ model: "gpt-4o", messages: messagesToLLM, response_format: zodResponseFormat(new ToolsForAgents().currentConversationStage, "conversationStage"), });
    const conversationStage = completion.choices[0].message.parsed as { stageOfTheConversation: string } | null;
    if (conversationStage) {
        console.log("This is the stage that is arrived at:::", conversationStage.stageOfTheConversation);
        return conversationStage.stageOfTheConversation;
    } else {
        console.log("Conversation stage is null");
        return "ONLY_ADDED_NO_CONVERSATION";
    }
}