
import axios from 'axios';
import { AgentExecutor } from 'langchain/agents';
// import { fetchCandidates, findMessages, upsertMessages } from 'src/engine/core-modules/recruitment-agent/services/databaseActions/db-master';
import { graphqlQueryToFindEngagedCandidates } from 'src/engine/core-modules/recruitment-agent/services/graphql-queries/graphql-queries-chatbot';
import { ChatOpenAI } from "@langchain/openai";
import { convertToOpenAIFunction } from "@langchain/core/utils/function_calling";
import { ChatPromptTemplate, MessagesPlaceholder, } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { formatToOpenAIFunctionMessages } from "langchain/agents/format_scratchpad";
import { OpenAIFunctionsAgentOutputParser } from "langchain/agents/openai/output_parser";
import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";
import { statusOptions, getSystemPrompt } from 'src/engine/core-modules/recruitment-agent/services/constants';
import *  as allDataObjects from 'src/engine/core-modules/recruitment-agent/services/data-model-objects'; 
import * as allTools from 'src/engine/core-modules/recruitment-agent/services/databaseActions/function-calling-tools';
import updateWhatsappMessageAndCandidateStatusInTable from './updateChat';
// console.log("statusOptions:",statusOptions);
const tools = Object.values(allTools);

const modelName = "gpt-3.5-turbo";
const model = new ChatOpenAI({ modelName: modelName, temperature: 0 });
// const chatHistory: BaseMessage[] = [];
const MEMORY_KEY = "chat_history";
import { sendWhatsappMessageVIAFacebookAPI } from 'src/engine/core-modules/recruitment-agent/services/whatsapp-api/facebook-whatsapp-api';


async function fetchCandidatesToEngage(){
  
  let findPeopleToCheckCandidateEngagementQuery = JSON.stringify({
    query: graphqlQueryToFindEngagedCandidates,
    variables: {}
  });
  let requestConfig = {
    method: 'post',
    maxBodyLength: Infinity,
    url: 'http://localhost:3000/graphql/graphql',
    headers: { 
      'Content-Type': 'application/json', 
      'Authorization': 'Bearer '+ process.env.TWENTY_JWT_SECRET
    },
    data : findPeopleToCheckCandidateEngagementQuery
  };
  try {
      const response = await axios.request(requestConfig);
      return response;
  } catch (error) {
      console.log(error);
  }

}

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


async function startChatEngagement(response){
  
  const filteredCandidatesToStartEngagement = response.data.data.people.edges.filter(edge => {
    return edge.node.candidate.edges.length > 0 && edge.node.candidate.edges[0].node.startChat === true;
  });

  // const filteredCandidatesToStartEngagement = []
  console.log("these are the number of candidates to who have no filteredCandidatesToStartEngagement ::", filteredCandidatesToStartEngagement.length);
  // debugger;
  const filteredCandidatesWhoHaveNoWhatsappHistory = filteredCandidatesToStartEngagement.filter(edge => {
    return edge.node.candidate.edges[0].node.whatsappMessages.edges.length === 0;
  });
  // debugger;
  console.log("these are the number of candidates to start chat ::", filteredCandidatesWhoHaveNoWhatsappHistory.length);
  for (let i = 0; i < filteredCandidatesWhoHaveNoWhatsappHistory.length; i++) {
    const candidateProfile = filteredCandidatesWhoHaveNoWhatsappHistory[i].node.candidate.edges[0].node;
    const recruiterProfile =  allDataObjects.recruiterProfile
    const chatReply = 'hi'



    const whatappUpdateMessageObj:allDataObjects.candidateChatMessageType = {
      candidateProfile:candidateProfile,
      candidateFirstName: filteredCandidatesWhoHaveNoWhatsappHistory[i].node.name.firstName,
      phoneNumberFrom: filteredCandidatesWhoHaveNoWhatsappHistory[i].node.phone,
      phoneNumberTo: recruiterProfile.phone,
      messages: [{ content: chatReply }],
      messageType : "candidateMessage"
    }
    await updateWhatsappMessageAndCandidateStatusInTable(whatappUpdateMessageObj)
    await sendWhatsappMessageVIAFacebookAPI(whatappUpdateMessageObj)
  }
}



async function engageCandidates(response){
  
  const filteredCandidatesToEngage = response.data.data.people.edges.filter(edge => {
    return edge.node.candidate.edges.length > 0 && edge.node.candidate.edges[0].node.engagementStatus === true;
  });
  console.log("these are the engaged candidates checked by the cron in every 5 seconds::");
  console.log("filtered candidates to engage:", JSON.stringify(filteredCandidatesToEngage, null, 2));
  console.log("Number of filtered candidates to engage::", filteredCandidatesToEngage.length);
  for (let i = 0; i < filteredCandidatesToEngage.length; i++) {
    const filteredCandidateMessages = filteredCandidatesToEngage[i].node.candidate.edges[0].node.whatsappMessages.edges;
    const candidateProfile = filteredCandidatesToEngage[i].node.candidate.edges[0].node;
    const recruiterProfile =  allDataObjects.recruiterProfile
    const jobProfile =  allDataObjects.jobProfile
    const historicalChatMesssages = filteredCandidatesToEngage[i].node.candidate.edges[0].node.whatsappMessages.edges;
    const chatHistory = historicalChatMesssages.map(doc => {
      const { content, ...props } = doc; 
      const message = doc.node.message;
      console.log("This is the props node:", props.node)
      if (props.node.messageType === "botMessage") {
        return new AIMessage(message, props.node);
      } else {
        return new HumanMessage(message, props.node);
      }
      });
    const executorWithMemoryAndTools = getExecutorWithPromptAndTools(candidateProfile.phoneNumber);
    const chatInput = historicalChatMesssages[0];
    const result = await executorWithMemoryAndTools.invoke({ input: chatInput, chat_history: chatHistory });
    
    console.log("Chat reply:", result.output);
    const chatReply = result.output
    const whatappUpdateMessageObj:allDataObjects.candidateChatMessageType = {
      candidateProfile:candidateProfile,
      candidateFirstName: filteredCandidatesToEngage[i].node.name.firstName,
      phoneNumberFrom: recruiterProfile.phone,
      phoneNumberTo: filteredCandidatesToEngage[i].node.phone,
      messages: [{ content: chatReply }],
      messageType :"botMessage"
    }
    await updateWhatsappMessageAndCandidateStatusInTable(whatappUpdateMessageObj)
    await sendWhatsappMessageVIAFacebookAPI(whatappUpdateMessageObj)

  }
}

export default async function checkCandidateEngagement() {
  const response = await fetchCandidatesToEngage()
  await startChatEngagement(response );
  await engageCandidates(response )
  return
}