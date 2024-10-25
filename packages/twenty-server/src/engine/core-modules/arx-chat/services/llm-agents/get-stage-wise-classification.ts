
import OpenAI from 'openai';
import * as allDataObjects from '../data-model-objects';
const modelName = 'gpt-4o';
import { ToolsForAgents } from '../../services/llm-agents/prompting-tool-calling';
import { ChatCompletion, ChatCompletionMessage } from 'openai/resources';
import CandidateEngagementArx from '../../services/candidate-engagement/check-candidate-engagement';
import { WhatsappAPISelector } from '../../services/whatsapp-api/whatsapp-controls';
import Anthropic from '@anthropic-ai/sdk';
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";




export async function getStageOfTheConversation(personNode:allDataObjects.PersonNode, mostRecentMessageArr: allDataObjects.ChatHistoryItem[], engagementType: 'remind' | 'engage', processorType: string) {
    let stage: string | null;
    console.log('Engagement Type::', engagementType);
    if (engagementType === 'remind') {
      console.log('Engagement type is reminder, so will try to get the stage from the last message');
      const messagesWithTimeStamp = personNode.candidates.edges[0].node.whatsappMessages.edges.map(edge => {
          return {
            role: edge.node.name === 'candidateMessage' ? 'user' : 'assistant',
            content: 'TimeStamp: ' + edge.node.createdAt + ' Message: ' + edge.node.message,
          };
        }).reverse();
      const checkReminderPrompt = await new ToolsForAgents().getTimeManagementPrompt(personNode);
      messagesWithTimeStamp.unshift({ role: 'system', content: checkReminderPrompt });
      console.log('got here to with the checkReminderPrompt prompt', checkReminderPrompt);
      // @ts-ignore
      const response = await this.openAIclient.chat.completions.create({ model: modelName, messages: messagesWithTimeStamp });
      stage = response.choices[0].message.content;
      console.log('This is the stage that is determined by the model:', stage);

      console.log('MessagesWithTimeStamp:::', messagesWithTimeStamp);
      console.log('mostRecentMessageArr::', mostRecentMessageArr);
      stage = 'remind_candidate';
      console.log('This is the stage here:', stage);
    } else {
      console.log('got here to get the stage of the conversation');
      const stagePrompt = await new ToolsForAgents().getStagePrompt();
      // console.log('got here to with the stage prompt', stagePrompt);
      const updatedMostRecentMessagesBasedOnNewSystemPrompt = await this.updateMostRecentMessagesBasedOnNewSystemPrompt(mostRecentMessageArr, stagePrompt);
      console.log('Got the updated recement messages for stage prompt:', updatedMostRecentMessagesBasedOnNewSystemPrompt);
      // @ts-ignore
      const response = await this.openAIclient.chat.completions.create({ model: modelName, messages: updatedMostRecentMessagesBasedOnNewSystemPrompt });
      console.log("This is the stage that is arrived at:::", response.choices[0].message.content)
      stage = response.choices[0].message.content ?? '1';
      console.log('This the stage that is determined by the model:', response.choices[0].message.content, '  Stage::', stage, '  processorType::', processorType);
    }
    console.log('This is the stage that is arrived at:', stage);
    return stage;
  }