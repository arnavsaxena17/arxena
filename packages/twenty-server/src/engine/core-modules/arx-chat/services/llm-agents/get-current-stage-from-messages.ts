
import { shareJDtoCandidate, updateAnswerInDatabase, updateCandidateStatus } from './tool-calls-processing';
import * as allDataObjects from '../data-model-objects';
import { FetchAndUpdateCandidatesChatsWhatsapps } from '../candidate-engagement/update-chat';
import fuzzy from 'fuzzy';
import CandidateEngagementArx from '../candidate-engagement/check-candidate-engagement';
import { CalendarEventType } from '../../../calendar-events/services/calendar-data-objects-types';
import { CalendarEmailService } from '../candidate-engagement/calendar-email';
import { MailerController } from '../../../gmail-sender/gmail-sender.controller';
import { SendEmailFunctionality } from '../candidate-engagement/send-gmail';
import { GmailMessageData } from 'src/engine/core-modules/gmail-sender/services/gmail-sender-objects-types';
import * as allGraphQLQueries from '../candidate-engagement/graphql-queries-chatbot';
import { addHoursInDate, axiosRequest, toIsoString } from '../../utils/arx-chat-agent-utils';
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { OpenAI } from "openai";
import { getStageOfTheConversation } from './get-stage-wise-classification';
import { ToolsForAgents } from './prompting-tool-calling';
import { LLMProviders } from './llm-agents';


export async function getChatStageFromChatHistory(messages: any) {
    const stagePrompt = await new ToolsForAgents().getStagePrompt();

    let mostRecentMessageArr: allDataObjects.ChatHistoryItem[] = new CandidateEngagementArx().getMostRecentMessageFromMessagesList(messages);
    mostRecentMessageArr[0] = { role: 'system', content: stagePrompt };
    // @ts-ignore
    const completion = await new LLMProviders().openAIclient.beta.chat.completions.parse({ model: "gpt-4o-mini", messages: mostRecentMessageArr, response_format: zodResponseFormat(new ToolsForAgents().currentConversationStage, "conversationStage"), });
    const conversationStage = completion.choices[0].message.parsed as { stageOfTheConversation: string } | null;
    if (conversationStage) {
        console.log("This is the stage that is arrived at:::", conversationStage.stageOfTheConversation);
        return conversationStage.stageOfTheConversation;
    } else {
        console.log("Conversation stage is null");
        return "ONLY_ADDED_NO_CONVERSATION";
    }
}