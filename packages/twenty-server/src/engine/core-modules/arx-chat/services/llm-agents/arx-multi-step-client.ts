import * as allDataObjects from '../data-model-objects';
const modelName = 'gpt-4o';
import { ToolsForAgents } from '../../services/llm-agents/prompting-tool-calling';
import { ChatCompletionMessage } from 'openai/resources';
import CandidateEngagementArx from '../../services/candidate-engagement/check-candidate-engagement';
import { WhatsappAPISelector } from '../../services/whatsapp-api/whatsapp-controls';
import { checkIfResponseMessageSoundsHumanLike } from './human-or-bot-type-response-classification'
import {getMostRecentChatsByPerson, updateMostRecentMessagesBasedOnNewSystemPrompt} from '../../utils/arx-chat-agent-utils'
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

export class OpenAIArxMultiStepClient {
  private readonly personNode: allDataObjects.PersonNode;
  private readonly workspaceQueryService: WorkspaceQueryService;
  constructor(personNode: allDataObjects.PersonNode,  workspaceQueryService: WorkspaceQueryService) {
    this.personNode = personNode;
    this.workspaceQueryService = workspaceQueryService;
  }
  async createCompletion(mostRecentMessageArr: allDataObjects.ChatHistoryItem[],  chatControl:allDataObjects.chatControls,apiToken:string,  isChatEnabled: boolean = true ) {
    try{
      const lastFewChats = await getMostRecentChatsByPerson(mostRecentMessageArr)
      console.log("Going to run candidate facing agents with tool calls in and most recent message is :",lastFewChats )

      const newSystemPrompt = await new ToolsForAgents(this.workspaceQueryService).getSystemPrompt(this.personNode, chatControl,apiToken);
      const updatedMostRecentMessagesBasedOnNewSystemPrompt = await updateMostRecentMessagesBasedOnNewSystemPrompt(mostRecentMessageArr, newSystemPrompt);
      const tools = await new ToolsForAgents(this.workspaceQueryService).getTools(chatControl);
      const responseMessage = await this.getHumanLikeResponseMessageFromLLM(updatedMostRecentMessagesBasedOnNewSystemPrompt, tools, apiToken)
      console.log('BOT_MESSAGE in  :', "at::", new Date().toString(), ' ::: ' ,JSON.stringify(responseMessage));
      if (responseMessage){
        mostRecentMessageArr.push(responseMessage);
      }
      else{
        console.log("Response message from getHumanLikeResponse MessageFromLLM is null, so returning as it is")
        return mostRecentMessageArr
      }
      if (responseMessage?.tool_calls && isChatEnabled) {
        mostRecentMessageArr = await this.addResponseAndToolCallsToMessageHistory(responseMessage, mostRecentMessageArr,chatControl, apiToken,isChatEnabled);
      }
      console.log("Sending message to candidate from addResponseAndToolCallsToMessageHistory_stage1", mostRecentMessageArr.slice(-1)[0].content);
      console.log("Message text in stage 1 received based on which we will decide whether to send message or not::",  mostRecentMessageArr.slice(-1)[0].content)
      await new WhatsappAPISelector(this.workspaceQueryService).sendWhatsappMessageToCandidate( mostRecentMessageArr.slice(-1)[0].content || '', this.personNode,mostRecentMessageArr, 'runCandidateFacingAgentsAlongWithToolCalls_stage1', chatControl,apiToken, isChatEnabled);
      return mostRecentMessageArr;
    }
    catch (error){
      console.log("There has been an error in runCandidateFacingAgentsAlongWithToolCalls::", error)
      return mostRecentMessageArr
    }
  }

  async getHumanLikeResponseMessageFromLLM( mostRecentMessageArr: allDataObjects.ChatHistoryItem[], tools: any, apiToken:string ): Promise<ChatCompletionMessage | null> {
    try {
      console.log("Going to get human like response from llm");
      const MAX_ATTEMPTS = 3;

      const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const { openAIclient } = await this.workspaceQueryService.initializeLLMClients(workspaceId);

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        // @ts-ignore
        const response = await openAIclient.chat.completions.create({ model: modelName, messages: mostRecentMessageArr, tools: tools, tool_choice: 'auto' }); 
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

 
  async addResponseAndToolCallsToMessageHistory(responseMessage: ChatCompletionMessage, mostRecentMessageArr: allDataObjects.ChatHistoryItem[],  chatControl:allDataObjects.chatControls, apiToken:string,isChatEnabled,) {
    const toolCalls = responseMessage?.tool_calls;
    console.log("We have made a total of ", toolCalls?.length, " tool calls in current chatResponseMessage")
    const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
    const { openAIclient } = await this.workspaceQueryService.initializeLLMClients(workspaceId);

    if (toolCalls) {
      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        console.log('Function name is:', functionName);
        const availableFunctions = new ToolsForAgents(this.workspaceQueryService).getAvailableFunctions(apiToken);
        const functionToCall = availableFunctions[functionName];
        const functionArgs = JSON.parse(toolCall.function.arguments);
        const responseFromFunction = await functionToCall(functionArgs, this.personNode, chatControl,apiToken);
        mostRecentMessageArr.push({ tool_call_id: toolCall.id, role: 'tool', name: functionName, content: responseFromFunction });
      }
      const tools = await new ToolsForAgents(this.workspaceQueryService).getTools(chatControl);
      // @ts-ignore
      const response = await openAIclient.chat.completions.create({ model: modelName, messages: mostRecentMessageArr, tools: tools, tool_choice: 'auto' });
      console.log('BOT_MESSAGE in runCandidateFacingAgentsAlongWithToolCalls_stage2 :', "at::", new Date().toString(), ' ::: ' ,JSON.stringify(responseMessage));
      mostRecentMessageArr.push(response.choices[0].message);
      let firstStageMessageArr = mostRecentMessageArr.slice(-1)
      if (response?.choices[0]?.message?.tool_calls) {
        console.log('More Tool Calls inside of the addResponseAndToolCallsToMessageHistory. RECURSION Initiated:::: processorType::');
        mostRecentMessageArr = await this.addResponseAndToolCallsToMessageHistory(response.choices[0].message, mostRecentMessageArr, chatControl,apiToken, isChatEnabled);
      } else {
        console.log('No Tool Calls received this in sub-response of the big response::');  
      }
      let messageArr_stage2 = mostRecentMessageArr.slice(-1)
      if ( messageArr_stage2[0].content != firstStageMessageArr[0].content) {
        console.log("Sending message to candidate from addResponseAndToolCallsToMessageHistory_stage2", messageArr_stage2);
        await new WhatsappAPISelector(this.workspaceQueryService).sendWhatsappMessageToCandidate(response?.choices[0]?.message?.content || '', this.personNode,messageArr_stage2,'addResponseAndToolCallsToMessageHistory_stage2', chatControl,apiToken, isChatEnabled);
      }
      else{
        console.log("The message we tried to send but sending is is ::", messageArr_stage2[0].content, "processorType")
      }
    }
    else{
      console.log("No tool calls in response message")
    }
    return mostRecentMessageArr;
  }

  
}
