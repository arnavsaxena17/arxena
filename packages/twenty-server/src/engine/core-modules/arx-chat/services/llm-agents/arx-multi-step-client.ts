import OpenAI from 'openai';
import * as allDataObjects from '../data-model-objects';

const modelName = 'gpt-4o';

import { ToolsForAgents } from '../../services/llm-agents/prompting-tool-calling';
import { ChatCompletion, ChatCompletionMessage } from 'openai/resources';
import CandidateEngagementArx from '../../services/candidate-engagement/check-candidate-engagement';
import { WhatsappAPISelector } from '../../services/whatsapp-api/whatsapp-controls';
import Anthropic from '@anthropic-ai/sdk';
import { ConsoleLogger } from '@nestjs/common';

export class OpenAIArxMultiStepClient {
  personNode: allDataObjects.PersonNode;
  openAIclient: OpenAI;
  anthropic: Anthropic;
  constructor(personNode: allDataObjects.PersonNode) {
    this.openAIclient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.personNode = personNode;
    this.anthropic = new Anthropic({
      apiKey: process.env['ANTHROPIC_API_KEY'], // This is the default and can be omitted
    });
  }
  // THis is the entry point
  async createCompletion(mostRecentMessageArr: allDataObjects.ChatHistoryItem[], personNode: allDataObjects.PersonNode, engagementType: 'remind' | 'engage', isChatEnabled: boolean = true) {
    let processorType: string;
    processorType = 'stage';
    const stage = await this.getStageOfTheConversation(mostRecentMessageArr, engagementType, processorType);
    console.log('This is the stage that is arrived at CURRENT STAGE::::::::', stage);
    processorType = 'candidate-facing';
    mostRecentMessageArr = await this.runCandidateFacingAgentsAlongWithToolCalls(mostRecentMessageArr, personNode, stage, processorType, isChatEnabled);
    console.log('After running the stage and candidate facing agents, the mostRecentMessageArr is::', mostRecentMessageArr);
    processorType = 'system-facing';

    await this.runSystemFacingAgentsAlongWithToolCalls(mostRecentMessageArr, personNode, stage, processorType);
    // await this.runTimeManagementAgent(mostRecentMessageArr, personNode, stage);
    return mostRecentMessageArr;
  }

  async runCandidateFacingAgentsAlongWithToolCalls(mostRecentMessageArr: allDataObjects.ChatHistoryItem[], personNode: allDataObjects.PersonNode, stage: string, processorType: string, isChatEnabled: boolean = true) {
    const newSystemPrompt = await new ToolsForAgents().getCandidateFacingSystemPromptBasedOnStage(this.personNode, stage);
    const updatedMostRecentMessagesBasedOnNewSystemPrompt = this.updateMostRecentMessagesBasedOnNewSystemPrompt(mostRecentMessageArr, newSystemPrompt);
    const tools = await new ToolsForAgents().getCandidateFacingToolsByStage(stage);
    // @ts-ignore
    const response = await this.openAIclient.chat.completions.create({ model: modelName, messages: mostRecentMessageArr, tools: tools, tool_choice: 'auto' });
    const responseMessage: ChatCompletionMessage = response.choices[0].message;
    console.log(new Date().toString(), ' : ', 'BOT_MESSAGE in runCandidateFacingAgentsAlongWithToolCalls_stage1 :', JSON.stringify(responseMessage), '  Stage:::', stage, '  processorType::', processorType);
    mostRecentMessageArr.push(responseMessage); // extend conversation with assistant's reply
    if (responseMessage.tool_calls && isChatEnabled) {
      mostRecentMessageArr = await this.addResponseAndToolCallsToMessageHistory(responseMessage, mostRecentMessageArr, stage, processorType);
    }
    await this.sendWhatsappMessageToCandidate(response?.choices[0]?.message?.content || '', mostRecentMessageArr, 'runCandidateFacingAgentsAlongWithToolCalls_stage1', isChatEnabled);
    return mostRecentMessageArr;
  }

  async getStageOfTheConversation(mostRecentMessageArr: allDataObjects.ChatHistoryItem[], engagementType: 'remind' | 'engage', processorType: string) {
    let stage: string | null;
    console.log('Engagement Type::', engagementType);
    if (engagementType === 'remind') {
      console.log('Engagement type is reminder, so will try to get the stage from the last message');
      const messagesWithTimeStamp = this.personNode.candidates.edges[0].node.whatsappMessages.edges
        .map(edge => {
          return {
            role: edge.node.name === 'candidateMessage' ? 'user' : 'assistant',
            content: 'TimeStamp: ' + edge.node.createdAt + ' Message: ' + edge.node.message,
          };
        })
        .reverse();
      const checkReminderPrompt = await new ToolsForAgents().getTimeManagementPrompt(this.personNode);
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
      // console.log('Got the updated recement messages:', updatedMostRecentMessagesBasedOnNewSystemPrompt);
      // @ts-ignore
      const response = await this.openAIclient.chat.completions.create({ model: modelName, messages: updatedMostRecentMessagesBasedOnNewSystemPrompt });
      stage = response.choices[0].message.content ?? '1';
      console.log('This the stage that is determined by the model:', response.choices[0].message.content, '  Stage::', stage, '  processorType::', processorType);
    }
    console.log('This is the stage that is arrived at:', stage);
    return stage;
  }

  async updateMostRecentMessagesBasedOnNewSystemPrompt(mostRecentMessageArr: allDataObjects.ChatHistoryItem[], newSystemPrompt: string) {
    mostRecentMessageArr[0] = { role: 'system', content: newSystemPrompt };
    return mostRecentMessageArr;
  }

  async runSystemFacingAgentsAlongWithToolCalls(mostRecentMessageArr: allDataObjects.ChatHistoryItem[], personNode: allDataObjects.PersonNode, stage: string, processorType: string) {
    const newSystemPrompt = await new ToolsForAgents().getSystemFacingSystemPromptBasedOnStage(this.personNode, stage);
    const updatedMostRecentMessagesBasedOnNewSystemPrompt = this.updateMostRecentMessagesBasedOnNewSystemPrompt(mostRecentMessageArr, newSystemPrompt);
    const tools = await new ToolsForAgents().getSystemFacingToolsByStage(stage);
    // @ts-ignore
    const response = await this.openAIclient.chat.completions.create({ model: modelName, messages: mostRecentMessageArr, tools: tools, tool_choice: 'auto' });
    const responseMessage: ChatCompletionMessage = response.choices[0].message;
    console.log(new Date().toString(), ' : ', 'BOT_MESSAGE in runSystemFacingAgentsAlongWithToolCalls:::', JSON.stringify(responseMessage), '  Stage::', stage, 'processorType::', processorType);
    mostRecentMessageArr.push(responseMessage); // extend conversation with assistant's reply
    if (responseMessage.tool_calls) {
      mostRecentMessageArr = await this.addResponseAndToolCallsToMessageHistory(responseMessage, mostRecentMessageArr, stage, processorType);
    }
  }

  async addResponseAndToolCallsToMessageHistory(responseMessage: ChatCompletionMessage, messages: allDataObjects.ChatHistoryItem[], stage: string, processorType: string) {
    const toolCalls = responseMessage.tool_calls;
    // @ts-ignore
    if (toolCalls) {
      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        console.log('Function name is:', functionName);
        const availableFunctions = new ToolsForAgents().getAvailableFunctions();
        // @ts-ignore
        const functionToCall = availableFunctions[functionName];
        const functionArgs = JSON.parse(toolCall.function.arguments);
        const responseFromFunction = await functionToCall(functionArgs, this.personNode);
        // @ts-ignore
        messages.push({ tool_call_id: toolCall.id, role: 'tool', name: functionName, content: responseFromFunction });
      }
      const tools = await new ToolsForAgents().getCandidateFacingToolsByStage(stage);
      // @ts-ignore
      const response = await this.openAIclient.chat.completions.create({ model: modelName, messages: messages, tools: tools, tool_choice: 'auto' });
      console.log(new Date().toString(), ' : ', 'BOT_MESSAGE in addResponseAndToolCallsToMessageHistory_stage2:', JSON.stringify(response), '  Stage::', stage, 'processorType::', processorType);
      messages.push(response.choices[0].message);
      if (response.choices[0].message.tool_calls) {
        console.log('More Tool Calls inside of the addResponseAndToolCallsToMessageHistory. RECURSION Initiated:::: processorType::', processorType);
        messages = await this.addResponseAndToolCallsToMessageHistory(response.choices[0].message, messages, stage, processorType);
      }
      const mostRecentMessageArr = messages;
      if (processorType === 'candidate-facing') {
        await this.sendWhatsappMessageToCandidate(response?.choices[0]?.message?.content || '', mostRecentMessageArr, 'addResponseAndToolCallsToMessageHistory_stage2');
      }
    }
    return messages;
  }

  async sendWhatsappMessageToCandidate(messageText: string, mostRecentMessageArr: allDataObjects.ChatHistoryItem[], functionSource: string, isChatEnabled?: boolean) {
    console.log('Called sendWhatsappMessageToCandidate to send message via any whatsapp api::', functionSource);
    if (messageText.includes('#DONTRESPOND#')) {
      console.log('Found a #DONTRESPOND# message, so not sending any message');
      return;
    }
    if (messageText) {
      const whatappUpdateMessageObj = await new CandidateEngagementArx().updateChatHistoryObjCreateWhatsappMessageObj('sendWhatsappMessageToCandidateMulti', this.personNode, mostRecentMessageArr);
      if (process.env.WHATSAPP_ENABLED === 'true' && (isChatEnabled === undefined || isChatEnabled)) {
        await new WhatsappAPISelector().sendWhatsappMessage(whatappUpdateMessageObj, this.personNode, mostRecentMessageArr);
      } else {
        console.log('Whatsapp is not enabled, so not sending message:', whatappUpdateMessageObj.messages[0].content);
      }
    }
  }

  // async runTimeManagementAgent(mostRecentMessageArr: allDataObjects.ChatHistoryItem[], personNode: allDataObjects.PersonNode, stage: string) {
  //   const timeManagementPrompt = await new ToolsForAgents().getTimeManagementPrompt(personNode, stage);
  //   let updatedMostRecentMessagesBasedOnNewSystemPrompt = await this.updateMostRecentMessagesBasedOnNewSystemPrompt(mostRecentMessageArr, timeManagementPrompt);
  //   const timeManagementTool = new ToolsForAgents().getTimeManagementTools();
  //   // @ts-ignore
  //   const response = await this.openAIclient.chat.completions.create({ model: modelName, messages: updatedMostRecentMessagesBasedOnNewSystemPrompt, tools: timeManagementTool, tool_choice: "auto", });
  //   const responseMessage: ChatCompletionMessage = response.choices[0].message;
  //   console.log("BOT_MESSAGE:", responseMessage.content);
  //   updatedMostRecentMessagesBasedOnNewSystemPrompt.push(responseMessage); // extend conversation with assistant's reply
  //   if (responseMessage.tool_calls) {
  //     updatedMostRecentMessagesBasedOnNewSystemPrompt = await this.addResponseAndToolCallsToMessageHistory(responseMessage, updatedMostRecentMessagesBasedOnNewSystemPrompt, stage);
  //   }
  // }
}
