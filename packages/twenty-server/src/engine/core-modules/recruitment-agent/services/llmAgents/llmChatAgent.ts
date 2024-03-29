import { ChatOpenAI } from "@langchain/openai";
import { convertToOpenAIFunction } from "@langchain/core/utils/function_calling";
import { ChatPromptTemplate, MessagesPlaceholder, } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { AgentExecutor } from "langchain/agents";
import { formatToOpenAIFunctionMessages } from "langchain/agents/format_scratchpad";
import { OpenAIFunctionsAgentOutputParser } from "langchain/agents/openai/output_parser";
import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";
import { statusOptions, getSystemPrompt } from 'src/engine/core-modules/recruitment-agent/services/constants';
import *  as allDataObjects from 'src/engine/core-modules/recruitment-agent/services/dataModelObjects'; 
import {fetchCandidates, findMessages, upsertMessages} from 'src/engine/core-modules/recruitment-agent/services/databaseActions/dbMaster';
import * as allTools from 'src/engine/core-modules/recruitment-agent/services/databaseActions/functionCallingTools';

console.log("statusOptions:",statusOptions);
const tools = Object.values(allTools);

const modelName = "gpt-3.5-turbo";
const model = new ChatOpenAI({ modelName: modelName, temperature: 0 });
// const chatHistory: BaseMessage[] = [];
const MEMORY_KEY = "chat_history";



function getExecutorWithPromptAndTools(phoneNumber){

  const recruiterProfile =  allDataObjects.recruiterProfile
  const candidateProfile =  allDataObjects.candidateProfile
  const jobProfile =  allDataObjects.jobProfile
  const availableTimeSlots = "12PM-3PM, 4PM -6PM on the 24th and 25th January 2024."
  const SYSTEM_PROMPT = getSystemPrompt(availableTimeSlots, candidateProfile, recruiterProfile, jobProfile);
  const memoryPrompt = ChatPromptTemplate.fromMessages([ [ "system", SYSTEM_PROMPT ],
  new MessagesPlaceholder(MEMORY_KEY), ["user", "{input}"], new MessagesPlaceholder("agent_scratchpad") ]);
  const modelWithFunctions = model.bind({ functions: tools.map((tool) => convertToOpenAIFunction(tool)) });
  const agentWithMemory = RunnableSequence.from([{input: (i) => i.input, agent_scratchpad: (i) => formatToOpenAIFunctionMessages(i.steps), chat_history: (i) => i.chat_history }, memoryPrompt, modelWithFunctions, new OpenAIFunctionsAgentOutputParser() ]);
  const executorWithMemoryAndTools = AgentExecutor.fromAgentAndTools({ agent: agentWithMemory, tools,verbose: true});
  return executorWithMemoryAndTools 
}

export const runChatAgent = async (userMessage: allDataObjects.userMessageType) => {
  const chatInput = userMessage.messages[0]['content'];
  const candidates = await fetchCandidates();
  console.log("This is the candidates", candidates);
  const phoneNumber = userMessage.phoneNumber;
  const executorWithMemoryAndTools = getExecutorWithPromptAndTools(phoneNumber);
  let chatHistory = await getChatHistory(phoneNumber);
  const result = await executorWithMemoryAndTools.invoke({ input: chatInput, chat_history: chatHistory });
  console.log("This is the result", result);
  chatHistory = updateChatHistory(chatHistory, chatInput, result.output);
  upsertMessages(chatHistory, phoneNumber);
  console.log("Chat reply:", result.output);
  console.log("Chat History OBJ:", result.chat_history);
  console.log("All messages:", result.chat_history.map((message: any) => message.content));
  console.log("End of Request reached");
  return result;
}
// Adjusted to handle a direct document or lack thereof
async function getChatHistory(phoneNumber: string): Promise<BaseMessage[]> {
  const chatHistoryDocument = await findMessages(phoneNumber);
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

function updateChatHistory(chatHistory: BaseMessage[], chatInput: string, output: string): HumanMessage[] {
  const kwargs = { "timestamp": new Date().toISOString(), "content": chatInput, "phoneNumber": "918411937769" };
  chatHistory.push(new HumanMessage(chatInput, kwargs));
  const kwargs_bot = { "timestamp": new Date().toISOString(), "content": output, "phoneNumber": "918411937769" };
  chatHistory.push(new AIMessage(output, kwargs_bot));
  return chatHistory;
}