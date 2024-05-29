import { ChatOpenAI } from "@langchain/openai";
import { convertToOpenAIFunction } from "@langchain/core/utils/function_calling";
import { ChatPromptTemplate, MessagesPlaceholder, } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { AgentExecutor } from "langchain/agents";
import { formatToOpenAIFunctionMessages } from "langchain/agents/format_scratchpad";
import { OpenAIFunctionsAgentOutputParser } from "langchain/agents/openai/output_parser";
import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";
import { statusOptions, getSystemPrompt } from 'src/engine/core-modules/recruitment-agent/services/llm-agents/langchain-system-prompt';
import *  as allDataObjects from 'src/engine/core-modules/recruitment-agent/services/data-model-objects'; 
import { fetchCandidates, findMessages, upsertMessages } from 'src/engine/core-modules/recruitment-agent/services/candidate-engagement/mongo-db-methods';
import * as allTools from 'src/engine/core-modules/recruitment-agent/services/llm-agents/function-calling-tools';
// import { candidateProfile } from 'src/engine/core-modules/recruitment-agent/services/data-model-objects';
import {FetchAndUpdateCandidatesChatsWhatsapps} from 'src/engine/core-modules/recruitment-agent/services/candidate-engagement/update-chat';


const modelName = "gpt-4o";
const model = new ChatOpenAI({ modelName: modelName, temperature: 0 });
// const chatHistory: BaseMessage[] = [];
const MEMORY_KEY = "chat_history";


export class LLMChatAgent {
  async getExecutorWithPromptAndTools(candidateProfile: allDataObjects.PersonNode){
    console.log("RunninggetExecutorWithPromptAndTools:")
    const recruiterProfile =  allDataObjects.recruiterProfile
    // const candidateProfileObjAllData =  candidateProfile
    const jobProfile =  allDataObjects.jobProfile
    const availableTimeSlots = "12PM-3PM, 4PM -6PM on the 24th and 25th January 2024."
    const SYSTEM_PROMPT = await getSystemPrompt(availableTimeSlots, candidateProfile, recruiterProfile, jobProfile);
    console.log("This is the system prompt that is getting created:", SYSTEM_PROMPT)
    const memoryPrompt = ChatPromptTemplate.fromMessages([ [ "system", SYSTEM_PROMPT ],new MessagesPlaceholder(MEMORY_KEY), ["user", "{input}"], new MessagesPlaceholder("agent_scratchpad") ]);
    const tools = allTools.createCandidateTools(candidateProfile);
    // console.log("This is tools:", tools)

    const modelWithFunctions = model.bind({ functions: tools.map((tool) => convertToOpenAIFunction(tool)) });
    const agentWithMemory = RunnableSequence.from([
      {input: (i) => i.input, agent_scratchpad: (i) => formatToOpenAIFunctionMessages(i.steps), chat_history: (i) => i.chat_history }, 
      memoryPrompt, 
      modelWithFunctions, 
      new OpenAIFunctionsAgentOutputParser()]);
    const executorWithMemoryAndTools = AgentExecutor.fromAgentAndTools({ agent: agentWithMemory, tools,verbose: true});
    return executorWithMemoryAndTools 
  }

  async runChatAgent (userMessage: allDataObjects.chatMessageType)  {
    console.log("Running chatAgent")
    console.log("Received user message:", userMessage)
    const chatInput:string = userMessage.messages[0]['content'];
    console.log("Received chat input:", chatInput)
    // const candidates = await fetchCandidates();
    const candidateProfile = await new FetchAndUpdateCandidatesChatsWhatsapps().getCandidateDetailsByPhoneNumber(userMessage.phoneNumberFrom);
    const phoneNumber = userMessage.phoneNumberFrom;
    const executorWithMemoryAndTools = await new LLMChatAgent().getExecutorWithPromptAndTools(candidateProfile);
    let chatHistory = await this.getChatHistory(phoneNumber);
    console.log("This is the chat history:", chatHistory);
    console.log("This is the chat history length:", chatHistory.length, "This is the chat chatInput :", chatInput);
    const result = await executorWithMemoryAndTools.invoke({ input: chatInput, chat_history: chatHistory });
    console.log("This is the result", result);
    chatHistory = this.updateChatHistory(chatHistory, chatInput, result.output);
    console.log("This is the chat history::", chatHistory);
    upsertMessages(chatHistory, phoneNumber);
    console.log("Chat reply:", result.output);
    console.log("Chat History OBJ:", result.chat_history);
    console.log("All messages:", result.chat_history.map((message: any) => message.content));
    console.log("End of Request reached");
    return result;
  }
  
// Adjusted to handle a direct document or lack thereof
  async  getChatHistory(phoneNumber: string): Promise<BaseMessage[]> {
    console.log("Running getChatHistory");
    console.log("This is the phone number to get getChatHistory:", phoneNumber);
    const chatHistoryDocument = await findMessages(phoneNumber);
    console.log("This is the chathistory document:", chatHistoryDocument);
    if (!chatHistoryDocument || !chatHistoryDocument.messages) {
        // Handle the case where no document is found or there are no messages
        console.error('No chat history found or no messages in the document.');
        return [];
    }
    // Assumes messages are stored in an array within the document
    const chatHistory = chatHistoryDocument.messages.map(doc => {
        const { content, ...props } = doc; // Adjust according to your actual schema
        return new HumanMessage(content, props);
    });
    return chatHistory;
  }

  updateChatHistory(chatHistory: BaseMessage[], chatInput: string, output: string): HumanMessage[] {
    console.log("Running updateChatHistory")
    console.log("This is chat chatInput", chatInput)
    const kwargs = { "timestamp": new Date().toISOString(), "content": chatInput, "phoneNumberTo": "918411937769" , "phoneNumberFrom": "919326970534", };
    console.log("This is kwrargs:", kwargs)
    chatHistory.push(new HumanMessage(chatInput, kwargs));
    const kwargs_bot = { "timestamp": new Date().toISOString(), "content": output, "phoneNumberFrom": "919326970534", "phoneNumberTo": "918411937769"};
    chatHistory.push(new AIMessage(output, kwargs_bot));
    return chatHistory;
  }

  async getChatHistoryFromMongo(phoneNumber:string){
    const chatHistoryDocument = await findMessages(phoneNumber);
    return chatHistoryDocument
  }


  async upsertDocumentsIntoMongo(messages, phoneNumber){
    await upsertMessages(messages, phoneNumber);
  }

}