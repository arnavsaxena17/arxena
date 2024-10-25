import OpenAI from 'openai';
import * as allDataObjects from '../data-model-objects';
const modelName = 'gpt-4o';
import { ToolsForAgents } from '../../services/llm-agents/prompting-tool-calling';
import { ChatCompletionMessage } from 'openai/resources';
import CandidateEngagementArx from '../../services/candidate-engagement/check-candidate-engagement';
import { WhatsappAPISelector } from '../../services/whatsapp-api/whatsapp-controls';
import Anthropic from '@anthropic-ai/sdk';
import { checkIfResponseMessageSoundsHumanLike } from './human-or-bot-type-response-classification'
import {LLMProviders} from './llm-agents'
export class OpenAIArxMultiStepClient {
  personNode: allDataObjects.PersonNode;
  LLMProviders: LLMProviders;
  constructor(personNode: allDataObjects.PersonNode) {
    this.personNode = personNode;
    this.LLMProviders = new LLMProviders();
  }
  async createCompletion(mostRecentMessageArr: allDataObjects.ChatHistoryItem[],chatControl:allDataObjects.chatControls, isChatEnabled: boolean = true) {
    mostRecentMessageArr = await this.runAgentAlongWithToolCalls(mostRecentMessageArr, chatControl, isChatEnabled);
    console.log('After running the stage and candidate facing agents, the mostRecentMessageArr is::', mostRecentMessageArr);
    return mostRecentMessageArr;
  }

  async getHumanLikeResponseMessageFromLLM( mostRecentMessageArr: allDataObjects.ChatHistoryItem[], tools: any ): Promise<ChatCompletionMessage | null> {
    try {
      console.log("Going to get human like response from llm");
      const MAX_ATTEMPTS = 3;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        // @ts-ignore
        const response = await this.LLMProviders.openAIclient.chat.completions.create({ model: modelName, messages: mostRecentMessageArr, tools: tools, tool_choice: 'auto' }); 
        const responseMessage = response.choices[0].message;
        console.log(`Response from attempt ${attempt}:`, response.choices[0]);
        if (!responseMessage.content) {
          console.log("Response Message is mostly null");
          return responseMessage;
        }
        const responseMessageType = await checkIfResponseMessageSoundsHumanLike(responseMessage);
        console.log(`Check if this sounds like a human message ${attempt} time:`, responseMessageType);
        if (responseMessageType === "seemsHumanMessage") {
          return responseMessage;
        }
        if (attempt === MAX_ATTEMPTS) {
          console.log("Maximum attempts reached. Returning last response regardless of human-likeness");
          return responseMessage;
        }
        console.log(`Attempt ${attempt} produced bot-like response, trying again...`);
      }
      return null; // This line should never be reached due to the for loop structure
    } catch (error) {
      console.log("Error in getHumanLikeResponse:", error);
      return null;
    }
  }
  
  async getMostRecentChatsByPerson(mostRecentMessageArr:allDataObjects.ChatHistoryItem[]){
    const lastThreeChats = mostRecentMessageArr.slice(-3);
    // Return the array in reverse order (most recent last)
    return lastThreeChats.reverse().map(chat => ({
      role: chat.role,
      content: chat.content
    }));
  
  }
  async runAgentAlongWithToolCalls(mostRecentMessageArr: allDataObjects.ChatHistoryItem[],  chatControl:allDataObjects.chatControls,  isChatEnabled: boolean = true ) {
    try{
      const lastFewChats = await this.getMostRecentChatsByPerson(mostRecentMessageArr)
      console.log("Going to run candidate facing agents with tool calls in and most recent message is :",lastFewChats )
      const newSystemPrompt = await new ToolsForAgents().getSystemPrompt(this.personNode);
      const updatedMostRecentMessagesBasedOnNewSystemPrompt = await this.updateMostRecentMessagesBasedOnNewSystemPrompt(mostRecentMessageArr, newSystemPrompt);
      const tools = await new ToolsForAgents().getTools();
      const responseMessage = await this.getHumanLikeResponseMessageFromLLM(updatedMostRecentMessagesBasedOnNewSystemPrompt, tools)
      console.log('BOT_MESSAGE in  :', "at::", new Date().toString(), ' ::: ' ,JSON.stringify(responseMessage));
      if (responseMessage){
        mostRecentMessageArr.push(responseMessage);
      }
      else{
        console.log("Response message from getHumanLikeResponse MessageFromLLM is null, so returning as it is")
        return mostRecentMessageArr
      }
      if (responseMessage?.tool_calls && isChatEnabled) {
        mostRecentMessageArr = await this.addResponseAndToolCallsToMessageHistory(responseMessage, mostRecentMessageArr,chatControl);
      }
      console.log("Sending message to candidate from addResponseAndToolCallsToMessageHistory_stage1", mostRecentMessageArr.slice(-1)[0].content);
      console.log("Message text in stage 1 received based on which we will decide whether to send message or not::",  mostRecentMessageArr.slice(-1)[0].content)
      await new WhatsappAPISelector().sendWhatsappMessageToCandidate( mostRecentMessageArr.slice(-1)[0].content || '', this.personNode,mostRecentMessageArr, 'runCandidateFacingAgentsAlongWithToolCalls_stage1', chatControl, isChatEnabled);
      return mostRecentMessageArr;
    }
    catch (error){
      console.log("There has been an error in runCandidateFacingAgentsAlongWithToolCalls::", error)
      return mostRecentMessageArr
    }
  }
  async addResponseAndToolCallsToMessageHistory(responseMessage: ChatCompletionMessage, mostRecentMessageArr: allDataObjects.ChatHistoryItem[],  chatControl:allDataObjects.chatControls) {
    const toolCalls = responseMessage?.tool_calls;
    console.log("We have made a total of ", toolCalls?.length, " tool calls in current chatResponseMessage")
    if (toolCalls) {
      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        console.log('Function name is:', functionName);
        const availableFunctions = new ToolsForAgents().getAvailableFunctions();
        const functionToCall = availableFunctions[functionName];
        const functionArgs = JSON.parse(toolCall.function.arguments);
        const responseFromFunction = await functionToCall(functionArgs, this.personNode);
        mostRecentMessageArr.push({ tool_call_id: toolCall.id, role: 'tool', name: functionName, content: responseFromFunction });
      }
      const tools = await new ToolsForAgents().getTools();
      // @ts-ignore
      const response = await this.LLMProviders.openAIclient.chat.completions.create({ model: modelName, messages: mostRecentMessageArr, tools: tools, tool_choice: 'auto' });
      console.log('BOT_MESSAGE in runCandidateFacingAgentsAlongWithToolCalls_stage2 :', "at::", new Date().toString(), ' ::: ' ,JSON.stringify(responseMessage));
      mostRecentMessageArr.push(response.choices[0].message);
      let firstStageMessageArr = mostRecentMessageArr.slice(-1)
      if (response?.choices[0]?.message?.tool_calls) {
        console.log('More Tool Calls inside of the addResponseAndToolCallsToMessageHistory. RECURSION Initiated:::: processorType::');
        mostRecentMessageArr = await this.addResponseAndToolCallsToMessageHistory(response.choices[0].message, mostRecentMessageArr, chatControl);
      }
      let messageArr_stage2 = mostRecentMessageArr.slice(-1)
      if ( messageArr_stage2[0].content != firstStageMessageArr[0].content) {
        console.log("Sending message to candidate from addResponseAndToolCallsToMessageHistory_stage2", messageArr_stage2);
        await new WhatsappAPISelector().sendWhatsappMessageToCandidate(response?.choices[0]?.message?.content || '', this.personNode,messageArr_stage2,'addResponseAndToolCallsToMessageHistory_stage2', chatControl);
      }
      else{
        console.log("The message we tried to send but sending is is ::", messageArr_stage2[0].content, "processorType")
      }
    }
    return mostRecentMessageArr;
  }

  async updateMostRecentMessagesBasedOnNewSystemPrompt(mostRecentMessageArr: allDataObjects.ChatHistoryItem[], newSystemPrompt: string) {
    mostRecentMessageArr[0] = { role: 'system', content: newSystemPrompt };
    return mostRecentMessageArr;
  }

  async sendWhatsappMessageToCandidate(messageText: string, mostRecentMessageArr: allDataObjects.ChatHistoryItem[], functionSource: string,chatControl:allDataObjects.chatControls, isChatEnabled?: boolean, ) {
    console.log('Called sendWhatsappMessage ToCandidate to send message via any whatsapp api::', functionSource, "message text::", messageText);
    if (mostRecentMessageArr[0].role != 'system' && mostRecentMessageArr.length==1) {
      console.log('Found a single sneaky message which is coming out:: ', messageText);
      return;
    }
    if (messageText.includes('#DONTRESPOND#') || messageText.includes('DONTRESPOND') && messageText) {
      console.log('Found a #DONTRESPOND# message, so not sending any message');
      return;
    }
    console.log("Going to create whatsaappupdatemessage obj for message text::", messageText)
    const whatappUpdateMessageObj:allDataObjects.candidateChatMessageType = await new CandidateEngagementArx().updateChatHistoryObjCreateWhatsappMessageObj('sendWhatsappMessageToCandidateMulti', this.personNode, mostRecentMessageArr);
    if (whatappUpdateMessageObj.messages[0].content?.includes('#DONTRESPOND#') || whatappUpdateMessageObj.messages[0].content?.includes('DONTRESPOND') && whatappUpdateMessageObj.messages[0].content) {
      console.log('Found a #DONTRESPOND# message, so not sending any message');
      return;
    }
    if ((!messageText || messageText == "") && (!whatappUpdateMessageObj.messages[0].content || whatappUpdateMessageObj.messages[0].content=="") ) {
      console.log('Message text is empty, so not sending any message');
      console.log('Current messageText::', messageText);
      console.log('Current whatappUpdateMessageObj.messages[0].content::', whatappUpdateMessageObj.messages[0].content);
      return;
    }
    if (whatappUpdateMessageObj.messages[0].content ||  messageText) {
      if (process.env.WHATSAPP_ENABLED === 'true' && (isChatEnabled === undefined || isChatEnabled)) {
        await new WhatsappAPISelector().sendWhatsappMessage(whatappUpdateMessageObj, this.personNode, mostRecentMessageArr, chatControl);
      } else {
        console.log('Whatsapp is not enabled, so not sending message:', whatappUpdateMessageObj.messages[0].content);
      }
    }
  }
}
