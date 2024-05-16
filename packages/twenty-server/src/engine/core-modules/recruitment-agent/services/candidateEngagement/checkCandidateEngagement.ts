
// import axios, { AxiosResponse } from 'axios';
// import { AgentExecutor } from 'langchain/agents';
// import { fetchCandidates, findMessages, upsertMessages } from 'src/engine/core-modules/recruitment-agent/services/databaseActions/db-master';
import { graphqlQueryToFindEngagedCandidates } from 'src/engine/core-modules/recruitment-agent/services/graphql-queries/graphql-queries-chatbot';
import { ChatOpenAI } from "@langchain/openai";
// import { convertToOpenAIFunction } from "@langchain/core/utils/function_calling";
// import { ChatPromptTemplate, MessagesPlaceholder, } from "@langchain/core/prompts";
// import { RunnableSequence } from "@langchain/core/runnables";
// import { formatToOpenAIFunctionMessages } from "langchain/agents/format_scratchpad";
// import { OpenAIFunctionsAgentOutputParser } from "langchain/agents/openai/output_parser";
import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";
// import { statusOptions, getSystemPrompt } from 'src/engine/core-modules/recruitment-agent/services/constants';
import *  as allDataObjects from 'src/engine/core-modules/recruitment-agent/services/data-model-objects'; 
import * as allTools from 'src/engine/core-modules/recruitment-agent/services/databaseActions/function-calling-tools';
import { LLMChatAgent } from 'src/engine/core-modules/recruitment-agent/services/llm-agents/llm-chat-agent';
// import { updateWhatsappMessageAndCandidateStatusInTable } from './updateChat';
import { UpdateChat } from './updateChat';
// console.log("statusOptions:",statusOptions);
const tools = Object.values(allTools);
const modelName = "gpt-3.5-turbo";
const model = new ChatOpenAI({ modelName: modelName, temperature: 0 });
// const chatHistory: BaseMessage[] = [];
const MEMORY_KEY = "chat_history";
// import { sendWhatsappMessageVIAFacebookAPI } from 'src/engine/core-modules/recruitment-agent/services/whatsapp-api/facebook-whatsapp-api';

import { FacebookWhatsappChatApi } from 'src/engine/core-modules/recruitment-agent/services/whatsapp-api/facebook-whatsapp-api';
import axios from 'axios';

export default class CandidateEngagement{

  async fetchCandidatesToEngage(){
    let findPeopleToCheckCandidateEngagementQuery = JSON.stringify({
      query: graphqlQueryToFindEngagedCandidates,
      variables: {}
    });
    console.log("Going to use this API Key:", process.env.TWENTY_JWT_SECRET)
    let requestConfig = {
      method: 'post',
      maxBodyLength: Infinity,
      url: 'http://localhost:3000/graphql',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': 'Bearer '+ process.env.TWENTY_JWT_SECRET
      },
      data : findPeopleToCheckCandidateEngagementQuery
    };
    try {
        const response = await axios.request(requestConfig);
        // console.log("Response received:", JSON.stringify(response.data))
        return response;
    } catch (error) {
        console.log(error);
    }
  }

  async startChatEngagement(response){
    // debugger;
    console.log("Total number of candidates fetched to filter for start chat::", response?.data?.data?.people?.edges?.length)
    const filteredCandidatesToStartEngagement = response?.data?.data?.people?.edges?.filter(edge => {
      return edge?.node?.candidates?.edges?.length > 0 && edge?.node?.candidates?.edges[0]?.node?.startChat === true;
    });
    
    // const filteredCandidatesToStartEngagement = []
    console.log("these are the number of candidates to who have no filteredCandidatesToStartEngagement ::", filteredCandidatesToStartEngagement?.length);
    const filteredCandidatesWhoHaveNoWhatsappHistory = filteredCandidatesToStartEngagement?.filter(edge => {
      return edge?.node?.candidates?.edges[0]?.node?.whatsappMessages?.edges.length === 0;
    });
  
    console.log("these are the number of candidates to start chat ::", filteredCandidatesWhoHaveNoWhatsappHistory?.length);
    for (let i = 0; i < filteredCandidatesWhoHaveNoWhatsappHistory?.length; i++) {
      const chatReply = 'hi';
      console.log("This is the filteredCandidatesWhoHaveNoWhatsappHistory:", filteredCandidatesWhoHaveNoWhatsappHistory[i])
      const candidateProfileDataNodeObj = filteredCandidatesWhoHaveNoWhatsappHistory[i];

      const whatappUpdateMessageObj = await new CandidateEngagement().createAndUpdateCandidateChatMessage(chatReply, candidateProfileDataNodeObj);
      await new FacebookWhatsappChatApi().sendWhatsappMessageVIAFacebookAPI(whatappUpdateMessageObj);
    }
  }
  
  async  createAndUpdateCandidateChatMessage(chatReply:string, candidateProfileDataNodeObj:any){
    console.log("This is the candidate profile data node obj:", candidateProfileDataNodeObj)
    const recruiterProfile =  allDataObjects.recruiterProfile;
    let whatappUpdateMessageObj:allDataObjects.candidateChatMessageType;
    if(chatReply === 'hi'){
      console.log("This is the recruiterProfile phoneNumberFrom:", recruiterProfile.phone)
      console.log("This is the recruiterProfile candidateProfileDataNodeObj?.node?.phone:", candidateProfileDataNodeObj?.node?.phone)
    }

    // This manipulation because the object is different for the candidateProfileDataNodeObj
    if(candidateProfileDataNodeObj?.node){
      whatappUpdateMessageObj = {
        candidateProfile:candidateProfileDataNodeObj?.node?.candidates?.edges[0]?.node,
        candidateFirstName: candidateProfileDataNodeObj?.node?.name?.firstName,
        phoneNumberFrom: candidateProfileDataNodeObj?.node?.phone,
        phoneNumberTo: recruiterProfile.phone,
        messages: [{ content: chatReply }],
        messageType : "candidateMessage"
      }
    }
    else{
      whatappUpdateMessageObj = {
        candidateProfile:candidateProfileDataNodeObj,
        candidateFirstName: candidateProfileDataNodeObj.first_name,
        phoneNumberFrom: candidateProfileDataNodeObj?.phoneNumber,
        phoneNumberTo: recruiterProfile.phone,
        messages: [{ content: chatReply }],
        messageType : "candidateMessage"
      }
    }
    await new UpdateChat().updateWhatsappMessageAndCandidateStatusInTable(whatappUpdateMessageObj)
    return whatappUpdateMessageObj
  }
  
  // Function to sort WhatsApp messages of each candidate
 sortWhatsAppMessages(peopleData) {
  const sortedPeopleData = peopleData; // Deep copy to avoid mutating the original data

  sortedPeopleData?.edges?.forEach(personEdge => {
    personEdge?.node?.candidates?.edges.forEach(candidateEdge => {
      candidateEdge?.node?.whatsappMessages?.edges.sort((a, b) => {
        // Sorting in descending order by the createdAt timestamp
        return new Date(b.node.createdAt).getTime() - new Date(a.node.createdAt).getTime();
      });
    });
  });
  return sortedPeopleData;

}
  
  async engageCandidates(response){
    const sortedPeopleData = new CandidateEngagement().sortWhatsAppMessages(response?.data?.data?.people);

    const filteredCandidatesToEngage = sortedPeopleData?.edges?.filter(edge => {
      return edge?.node?.candidates?.edges?.length > 0 && edge?.node?.candidates?.edges[0]?.node?.engagementStatus === true;
    });
  
    console.log("these are the engaged candidates checked by the cron in every 5 seconds::");
    console.log("filtered candidates to engage:", JSON.stringify(filteredCandidatesToEngage, null, 2));
    console.log("Number of filtered candidates to engage::", filteredCandidatesToEngage?.length);
    for (let i = 0; i < filteredCandidatesToEngage?.length; i++) {
      const filteredCandidateMessages = filteredCandidatesToEngage[i]?.node?.candidates?.edges[0]?.node?.whatsappMessages?.edges;
      const candidateProfile = filteredCandidatesToEngage[i]?.node?.candidates?.edges[0]?.node;
      const recruiterProfile =  allDataObjects?.recruiterProfile
      const jobProfile =  allDataObjects?.jobProfile
      const historicalChatMesssages = filteredCandidatesToEngage[i]?.node?.candidates?.edges[0]?.node?.whatsappMessages?.edges;
      console.log("This is the historical chat messages:", JSON.stringify(historicalChatMesssages))
      console.log("This is the number of historical chat messages:", historicalChatMesssages.length)
  
      const chatHistory = historicalChatMesssages.map(doc => {
        const { content, ...props } = doc;
        const message = doc?.node?.message;
        console.log("This is the props node:", props.node);
        if (props?.node?.messageType === "botMessage" || props?.node?.name === "botMessage") {
          return new AIMessage(message);
        } else {
          return new HumanMessage(message);
        }
      });

      console.log("This is the chat history:", JSON.stringify(chatHistory, null, 2));
      const executorWithMemoryAndTools = new LLMChatAgent().getExecutorWithPromptAndTools(candidateProfile?.phoneNumber, candidateProfile);
      const chatInput = historicalChatMesssages[0].node.message;
      console.log("This is the chat input going in:", chatInput);
      console.log("This is the chat history length:", chatHistory.length, "This is the chat chatInput :", chatInput);

      const result = await executorWithMemoryAndTools.invoke({ input: chatInput, chat_history: chatHistory });
      console.log("This is result from executorWithMemoryAndTools.invoke:", JSON.stringify(result, null, 2))
      console.log("This is the result.chat_his", result.chat_history);

      console.log("Chat reply:", result?.output);
      const chatReply = result?.output;
      const whatappUpdateMessageObj:allDataObjects.candidateChatMessageType = {
        candidateProfile:candidateProfile,
        candidateFirstName: filteredCandidatesToEngage[i]?.node?.name?.firstName,
        phoneNumberFrom: recruiterProfile?.phone,
        phoneNumberTo: filteredCandidatesToEngage[i]?.node?.phone,
        messages: [{ content: chatReply }],
        messageType :"botMessage"
      }
  
      await new UpdateChat().updateWhatsappMessageAndCandidateStatusInTable(whatappUpdateMessageObj)
      await new FacebookWhatsappChatApi().sendWhatsappMessageVIAFacebookAPI(whatappUpdateMessageObj)
  
    }
  }
  
  async  checkCandidateEngagement() {
    const response = await new CandidateEngagement().fetchCandidatesToEngage()
    console.log("This si the reponse::")
    await new CandidateEngagement().startChatEngagement(response );
    await new CandidateEngagement().engageCandidates(response )
    return
  }

}


