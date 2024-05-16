import { ChatOpenAI } from "@langchain/openai";
import { convertToOpenAIFunction } from "@langchain/core/utils/function_calling";
import { ChatPromptTemplate, MessagesPlaceholder, } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { AgentExecutor } from "langchain/agents";
import { formatToOpenAIFunctionMessages } from "langchain/agents/format_scratchpad";
import { OpenAIFunctionsAgentOutputParser } from "langchain/agents/openai/output_parser";
import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";
import { statusOptions, getSystemPrompt } from 'src/engine/core-modules/recruitment-agent/services/constants';
import *  as allDataObjects from 'src/engine/core-modules/recruitment-agent/services/data-model-objects'; 
import {fetchCandidates, findMessages, upsertMessages} from 'src/engine/core-modules/recruitment-agent/services/databaseActions/db-master';
import * as allTools from 'src/engine/core-modules/recruitment-agent/services/databaseActions/function-calling-tools';
import {candidateProfile} from 'src/engine/core-modules/recruitment-agent/services/data-model-objects';
// console.log("statusOptions:",statusOptions);
const tools = Object.values(allTools);

const modelName = "gpt-3.5-turbo-1106";
const model = new ChatOpenAI({ modelName: modelName, temperature: 0 });
// const chatHistory: BaseMessage[] = [];
const MEMORY_KEY = "chat_history";


export class LLMChatAgent {
 getExecutorWithPromptAndTools(phoneNumber, candidateProfile){
  console.log("RunninggetExecutorWithPromptAndTools:")
  console.log("This is the candidate profile created to receive data::, candidateProfile", candidateProfile)
  const recruiterProfile =  allDataObjects.recruiterProfile
  const candidateProfileObjAllData =  allDataObjects.candidateProfile
  const jobProfile =  allDataObjects.jobProfile
  const availableTimeSlots = "12PM-3PM, 4PM -6PM on the 24th and 25th January 2024."
  const SYSTEM_PROMPT = getSystemPrompt(availableTimeSlots, candidateProfileObjAllData, recruiterProfile, jobProfile);
  console.log("This is the system prompt that is getting created:", SYSTEM_PROMPT)
  const memoryPrompt = ChatPromptTemplate.fromMessages([ [ "system", SYSTEM_PROMPT ],new MessagesPlaceholder(MEMORY_KEY), ["user", "{input}"], new MessagesPlaceholder("agent_scratchpad") ]);
  const modelWithFunctions = model.bind({ functions: tools.map((tool) => convertToOpenAIFunction(tool)) });
  const agentWithMemory = RunnableSequence.from([{input: (i) => i.input, agent_scratchpad: (i) => formatToOpenAIFunctionMessages(i.steps), chat_history: (i) => i.chat_history }, memoryPrompt, modelWithFunctions, new OpenAIFunctionsAgentOutputParser() ]);
  const executorWithMemoryAndTools = AgentExecutor.fromAgentAndTools({ agent: agentWithMemory, tools,verbose: true});
  return executorWithMemoryAndTools 
}

async runChatAgent   (userMessage: allDataObjects.userMessageType)  {
  console.log("Running chatAgent")
  console.log("Received user message:", userMessage)
  const chatInput:string = userMessage.messages[0]['content'];
  console.log("Received chat input:", chatInput)
  const candidates = await fetchCandidates();
  console.log("This is the candidates", candidates);
  const phoneNumber = userMessage.phoneNumber;
  const executorWithMemoryAndTools = new LLMChatAgent().getExecutorWithPromptAndTools(phoneNumber, candidateProfile);
  let chatHistory = await this.getChatHistory(phoneNumber);
  console.log("This is the chat history:", JSON.stringify(chatHistory, null, 2));
  console.log("This is the chat history length:", chatHistory.length, "This is the chat chatInput :", chatInput);
  const result = await executorWithMemoryAndTools.invoke({ input: chatInput, chat_history: chatHistory });
  console.log("This is the result", result);
  chatHistory = this.updateChatHistory(chatHistory, chatInput, result.output);
  console.log("This is the chat history::", chatHistory)
  upsertMessages(chatHistory, phoneNumber);
  console.log("Chat reply:", result.output);
  console.log("Chat History OBJ:", result.chat_history);
  console.log("All messages:", result.chat_history.map((message: any) => message.content));
  console.log("End of Request reached");
  return result;
}
// Adjusted to handle a direct document or lack thereof
async  getChatHistory(phoneNumber: string): Promise<BaseMessage[]> {
  console.log("Running getChatHistory")
  console.log("This is the phone number to get getChatHistory:", phoneNumber)
  const chatHistoryDocument = await findMessages(phoneNumber);
  console.log("This is the chathistory document:", chatHistoryDocument)
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
  const kwargs = { "timestamp": new Date().toISOString(), "content": chatInput, "phoneNumber": "918411937769" };
  console.log("This is kwrargs:", kwargs)
  chatHistory.push(new HumanMessage(chatInput, kwargs));
  const kwargs_bot = { "timestamp": new Date().toISOString(), "content": output, "phoneNumber": "918411937769" };
  chatHistory.push(new AIMessage(output, kwargs_bot));
  return chatHistory;
}

}