
// import { AIMessage, HumanMessage, BaseMessage } from "@langchain/core/messages";
import *  as allDataObjects from '../../services/data-model-objects'; 
import { LLMChatAgent } from '../../services/llm-agents/llm-chat-agent';
import { FetchAndUpdateCandidatesChatsWhatsapps } from './update-chat';
// import { FacebookWhatsappChatApi } from '../../services/whatsapp-api/facebook-whatsapp/facebook-whatsapp-api';
import { WhatsappAPISelector } from '../../services/whatsapp-api/whatsapp-controls';
import { sortWhatsAppMessages } from '../../utils/recruitmentAgentUtils';
import { ChainValues } from "@langchain/core/utils/types";
import { chat } from 'googleapis/build/src/apis/chat';
import { getSystemPrompt } from 'src/engine/core-modules/recruitment-agent/services/llm-agents/langchain-system-prompt';
import OpenAI from "openai";
import { response } from 'express';
const modelName = "gpt-4o"

const openai = new OpenAI();
const readline = require('node:readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
export default class CandidateEngagement {
  async startChatEngagement(candidateResponseEngagementObj:allDataObjects.RootObject){
    console.log("Total number of candidates fetched to filter for start chat::", candidateResponseEngagementObj?.people?.edges?.length)
    const filteredCandidatesToStartEngagement = candidateResponseEngagementObj?.people?.edges?.filter(edge => {
      return edge?.node?.candidates?.edges?.length > 0 && edge?.node?.candidates?.edges[0]?.node?.startChat === true;
    });
    console.log("these are the number of candidates to who have no filteredCandidatesToStartEngagement ::", filteredCandidatesToStartEngagement?.length);
    const filteredCandidatesWhoHaveNoWhatsappHistory = filteredCandidatesToStartEngagement?.filter(edge => {
      return edge?.node?.candidates?.edges[0]?.node?.whatsappMessages?.edges.length === 0;
    });
    console.log("these are the number of candidates to start chat ::", filteredCandidatesWhoHaveNoWhatsappHistory?.length);
    for (let i = 0; i < filteredCandidatesWhoHaveNoWhatsappHistory?.length; i++) {
      const chatReply = 'hi';
      // const name = await this.askQuestion("What's your name?");
      // console.log("This is the filteredCandidatesWhoHaveNoWhatsappHistory:", filteredCandidatesWhoHaveNoWhatsappHistory[i])
      const candidateProfileDataNodeObj = filteredCandidatesWhoHaveNoWhatsappHistory[i];
      await new CandidateEngagement().createAndUpdateCandidateHiChatMessage(chatReply, candidateProfileDataNodeObj);
    }
  }
  askQuestion(question: string): Promise<string> {
    return new Promise((resolve) => {
      rl.question(question, (answer: string) => {
        resolve(answer);
      });
    });
  }


  async createAndUpdateCandidateHiChatMessage(chatReply:string, candidateProfileDataNodeObj:allDataObjects.PersonEdge){
    // console.log("This is the candidate profile data node obj:", candidateProfileDataNodeObj);
    console.log("This is the chat reply:", chatReply);
    const recruiterProfile =  allDataObjects.recruiterProfile;
    let whatappUpdateMessageObj:allDataObjects.candidateChatMessageType;
    let chatHistory = candidateProfileDataNodeObj?.node?.candidates?.edges[0]?.node?.whatsappMessages?.edges[0]?.node?.messageObj || [];
    if (chatReply === 'hi' && candidateProfileDataNodeObj?.node?.candidates?.edges[0]?.node?.whatsappMessages?.edges.length === 0) {
      console.log("This is the first time chat history is being created for the candidate");
      // const SYSTEM_PROMPT = getSystemPrompt(candidateProfileDataNodeObj)
      const SYSTEM_PROMPT = "This isthe system prompt for the first time chat history creation for the candidate"
      chatHistory.push({role: "system", content: SYSTEM_PROMPT});
      chatHistory.push({role: "user", content: "Hi"});
      // console.log("This is the chatHistoryObj:", chatHistoryObj);
      // chatHistory.push(chatHistoryObj);
      // console.log("This is kwargs:", kwargs);
      // console.log("This is kwargs chatHistory:", chatHistory);
      
      // console.log("This is chatHistory::", chatHistory);
    }else{
      chatHistory = candidateProfileDataNodeObj?.node?.candidates?.edges[0]?.node?.whatsappMessages?.edges[0]?.node?.messageObj;
    }
    whatappUpdateMessageObj = {
      executorResultObj: {},
      candidateProfile:candidateProfileDataNodeObj?.node?.candidates?.edges[0]?.node,
      candidateFirstName: candidateProfileDataNodeObj?.node?.name?.firstName,
      phoneNumberFrom: candidateProfileDataNodeObj?.node?.phone,
      phoneNumberTo: recruiterProfile.phone,
      messages: [{ content: chatReply }],
      messageType : "candidateMessage",
      messageObj: chatHistory
    };

    await this.updateAndSendWhatsappMessageAndCandidateEngagementStatusInTable(whatappUpdateMessageObj);
    return whatappUpdateMessageObj;
  }

  async createAndUpdateIncomingCandidateChatMessage(chatReply:string, candidateProfileDataNodeObj:allDataObjects.CandidateNode){
    // console.log("This is the candidate profile data node obj:", candidateProfileDataNodeObj);

    const recruiterProfile =  allDataObjects.recruiterProfile;
    let whatappUpdateMessageObj:allDataObjects.candidateChatMessageType;
    const messagesList = candidateProfileDataNodeObj?.whatsappMessages?.edges;
    // Ensure messagesList is not undefined before sorting
    console.log("This is the messageObj:", messagesList.map((edge:any) => edge.node.messageObj))
    let mostRecentMessageObj;
    if (messagesList) {
      console.log("This is the messagesList:", messagesList);
      messagesList.sort((a, b) => new Date(b.node.createdAt).getTime() - new Date(a.node.createdAt).getTime());
      mostRecentMessageObj = messagesList[0]?.node.messageObj;
    }
    else{
      console.log("Just having to take the first one")
      mostRecentMessageObj = candidateProfileDataNodeObj?.whatsappMessages.edges[0].node.messageObj;
    }

    console.log("These are message kwargs length:", mostRecentMessageObj?.length)
    console.log("This is the most recent message object being considered::", mostRecentMessageObj);
    // chatHistory = await this.getChatHistoryFromMongo(mostRecentMessageObj);
    mostRecentMessageObj.push({role: "user", content: chatReply});
    whatappUpdateMessageObj = {
      executorResultObj: {},
      candidateProfile:candidateProfileDataNodeObj,
      candidateFirstName: candidateProfileDataNodeObj.name,
      phoneNumberFrom: candidateProfileDataNodeObj?.phoneNumber,
      phoneNumberTo: recruiterProfile.phone,
      messages: [{ content: chatReply }],
      messageType : "candidateMessage",
      messageObj: mostRecentMessageObj
    };
    await this.updateAndSendWhatsappMessageAndCandidateEngagementStatusInTable(whatappUpdateMessageObj);
    return whatappUpdateMessageObj;
  }



async processCandidate(edge: allDataObjects.PersonEdge) {
  console.log("The edge is ::", edge)
  try{
    const candidateNode = edge.node.candidates.edges[0].node;
    const personNode = edge.node;
    console.log("This is candidate Node:", candidateNode)
    console.log("This is the candidateNode?.whatsappMessages?.edges length::", candidateNode?.whatsappMessages?.edges.length)
    const messagesList = candidateNode?.whatsappMessages?.edges;
    console.log("Current Messages list:", messagesList)
    // Ensure messagesList is not undefined before sorting
    let mostRecentMessageArr
    if (messagesList) {
      console.log("This is the messagesList:", messagesList)
      messagesList.sort((a, b) => new Date(b.node.createdAt).getTime() - new Date(a.node.createdAt).getTime());
      mostRecentMessageArr = messagesList[0]?.node?.messageObj;
      console.log(mostRecentMessageArr);
    }
    const chatInput = candidateNode?.whatsappMessages?.edges[0]?.node?.message;
    console.log("Most recent message array:", mostRecentMessageArr)
    if (mostRecentMessageArr?.length > 0) {
      const response = await openai.chat.completions.create({ model: modelName, messages: mostRecentMessageArr});
      console.log("Response:", response)
      
      // @ts-ignore
      mostRecentMessageArr.push({role: "assistant", content: response?.choices[0].message.content});
      
      const whatappUpdateMessageObj = await this.updateChatHistoryObjCreateWhatsappMessageObj(response, candidateNode, edge, chatInput, mostRecentMessageArr);
      await this.updateAndSendWhatsappMessageAndCandidateEngagementStatusInTable(whatappUpdateMessageObj);
    }
  }
  catch (error){
    console.log("This is the error in processCandidate", error)
    debugger;
  }
  
}

// async updateChatHistoryObjAfterProcessCandidate(result:ChainValues, chatInput:string, chatHistory:BaseMessage[]){
//   console.log("This is chat chatReply", chatInput)
//   console.log("Number of messages in the current chat hisotry in updateChatHistoryObj:", chatHistory.length)
//   const kwargs = { "timestamp": new Date().toISOString(), "content": chatInput, "messageType":"candidateMessage", "phoneNumber": "1234567890", "source": "updateChatHistoryObj"};
//   console.log("This is kwrargs in updateChatHistoryObj: in updateChatHistoryObj", kwargs)
//   chatHistory.push(new HumanMessage(chatInput, kwargs));
//   const kwargs_bot = { "timestamp": new Date().toISOString(), "content": result.output,"messageType":"botMessage", "phoneNumber": "1234567890", "tool_calls": result.tool_calls , "source":"updateChatHistoryObj" };
//   chatHistory.push(new AIMessage(result.output, kwargs_bot));
//   console.log("Number of messages in the future chat hisotry in updateChatHistoryObj", chatHistory.length)
//   return chatHistory;
// }

// async updateIncomingChatHistoryObj(chatInput:string, chatHistory:BaseMessage[]){
//   console.log("This is chat chatReply in updateIncomingChatHistoryObj", chatInput)
//   console.log("Number of messages in the current chat hisotry: in updateIncomingChatHistoryObj", chatHistory.length)
//   const kwargs = { "timestamp": new Date().toISOString(), "content": chatInput, "messageType":"candidateMessage", "phoneNumber": "1234567890", "source": "updateIncomingChatHistoryObj"};
//   console.log("This is kwrargs in updateIncomingChatHistoryObj:", kwargs)
//   chatHistory.push(new HumanMessage(chatInput, kwargs));
  
//   console.log("Number of messages in the future chat hisotryin updateIncomingChatHistoryObj:", chatHistory.length)
//   return chatHistory;
// }

// async updateChatHistoryinMongo(chatHistory: BaseMessage[], chatInput: string, result:any): Promise<HumanMessage[]> {
//   console.log("This is chat chatInput", chatInput)
//   console.log("Number of messages in the current chat hisotry:", chatHistory.length)
//   const kwargs = { "timestamp": new Date().toISOString(), "content": chatInput, "phoneNumber": "1234567890" };
//   console.log("This is kwrargs:", kwargs)
//   chatHistory.push(new HumanMessage(chatInput, kwargs));
//   const kwargs_bot = { "timestamp": new Date().toISOString(), "content": result.output, "phoneNumber": "1234567890", "tool_calls": result.tool_calls  };
//   chatHistory.push(new AIMessage(result.output, kwargs_bot));
//   console.log("Number of messages in the future chat hisotry:", chatHistory.length)
//   return chatHistory;
// }

// async  getChatHistoryFromMongo(phoneNumber: string): Promise<BaseMessage[]> {
//   console.log("Going to get cht hisoty for phone number:", phoneNumber)
//   // 
//   // const chatHistoryDocument = await findMessages(phoneNumber);
//   const chatHistoryDocument = await new LLMChatAgent().getChatHistoryFromMongo(phoneNumber);
//   console.log("This is the chathistory document:", chatHistoryDocument)
//   if (!chatHistoryDocument || !chatHistoryDocument.messages) {
//       // Handle the case where no document is found or there are no messages
//       console.error('No chat history found or no messages in the document.');
//       return [];
//   }
//   console.log("Received chat history document now creating chat history so that the chat history can be appended to the")
//   // debugger;
  
//   // Assumes messages are stored in an array within the document
//   console.log("Number of messages in the chat history:", chatHistoryDocument.messages.length)
//   const chatHistory = chatHistoryDocument.messages.map((doc: { [x: string]: any; content: any; }) => {
//       if (!doc?.tool_calls){
//         return new HumanMessage(doc);
//       }
//       else{
//         console.log("Got AI message")
//         return new AIMessage(doc);
//       }
//   });
//     console.log("This is the length of the final chat history object being sent out :", chatHistory.length)
//   return chatHistory;
// }

// async getChatHistory(messages:any) {
//   console.log("Getting chat history from messages length" , messages?.length)
//   console.log("This is the messages in buildChatHistory:", messages)
//   let chatHistoryObj:BaseMessage[] = []
//   if (!messages) {
//     return []
//   }
//   if (messages?.length != 0 ){
//     chatHistoryObj = messages?.map((message:{ [x: string]: any; content: any; }) => {
//       if( message?.id.includes('HumanMessage')) {
//         console.log("Where tool calls is not available", message)
//         return new HumanMessage(message)
//       }
//       else{
//         console.log("Where tool calls is available", message)
//         return new AIMessage(message)
//       }
//     });
//   }
  // if (chatHistoryObj.some(obj => obj.content === undefined)) {
  //   console.log("This is the chatHistoryObj with undefined content in getChatHistory:", chatHistoryObj)
  //   console.log("This is the chatHistoryObj with undefined content having messages in  getChatHistory:", messages)
  // }
//   console.log("This is the chatHistoryObj got from getChatHistory:", chatHistoryObj)
//   console.log("these are the number of chats in chathisotry obj in getChatHistory:", chatHistoryObj.length)
//   return chatHistoryObj 
// }

async updateAndSendWhatsappMessageAndCandidateEngagementStatusInTable(whatappUpdateMessageObj: allDataObjects.candidateChatMessageType) {
  console.log("Candidate information before processing:", whatappUpdateMessageObj);
  let candidateProfileObj = whatappUpdateMessageObj.messageType !== "botMessage" ? await new FetchAndUpdateCandidatesChatsWhatsapps().getCandidateInformation(whatappUpdateMessageObj) : whatappUpdateMessageObj.candidateProfile;
  console.log("Candidate information after processing:", candidateProfileObj);
  console.log("Whatsapp Objs :::", candidateProfileObj.whatsappMessages.edges.map((edge:any) => edge.node.messageObj))
  if (candidateProfileObj.name === '') return;
  console.log("Candidate information retrieved successfully");
  const whatsappMessage = await new FetchAndUpdateCandidatesChatsWhatsapps().createAndUpdateWhatsappMessage(candidateProfileObj, whatappUpdateMessageObj);
  if (!whatsappMessage) return;
  console.log("Whatsapp message created successfully");
  const updateCandidateStatusObj = await new FetchAndUpdateCandidatesChatsWhatsapps().updateCandidateEngagementStatus(candidateProfileObj, whatappUpdateMessageObj);
  if (!updateCandidateStatusObj) return;

  console.log("Candidate engagement status updated successfully");
  console.log("Got whatsapp api selector to send messages")
  // await new FacebookWhatsappChatApi().sendWhatsappMessageVIAFacebookAPI(whatappUpdateMessageObj);
  await new WhatsappAPISelector().sendWhatsappMessage(whatappUpdateMessageObj)
  return { "status": "success", "message": "Candidate engagement status updated successfully" };
}
  
  async updateChatHistoryObjCreateWhatsappMessageObj(result:ChainValues, candidateNode:allDataObjects.CandidateNode, edge:any, chatInput:string,  chatHistory) {
  console.log("This is candidate Node", candidateNode)
  console.log("This is candidate Edge", edge)
    // const updatedChatHistoryObj = await this.updateChatHistoryObjAfterProcessCandidate(result, chatInput,  chatHistory);
    return {
        executorResultObj: result,
        messageObj : chatHistory,
        candidateProfile: candidateNode,
        candidateFirstName: edge.node.name?.firstName,
        phoneNumberFrom: allDataObjects.recruiterProfile?.phone,
        phoneNumberTo: edge.node.phone,
        messages: [{ content: result?.output || result?.choices[0]?.message?.content }],
        messageType: "botMessage"
    };
  }

  async engageCandidates(candidateResponseEngagementObj:allDataObjects.RootObject) {
    // console.log("This is candidateResponseEngagementObj:", candidateResponseEngagementObj)
    const sortedPeopleData = sortWhatsAppMessages(candidateResponseEngagementObj?.people);
    const filteredCandidates = this.filterCandidates(sortedPeopleData);
    console.log("Filtered candidates to engage:", filteredCandidates);
    console.log("Number of filtered candidates to engage:", filteredCandidates?.length);
    for (const edge of filteredCandidates) {
        await this.processCandidate(edge);
    }
  }


  async  checkCandidateEngagement() {
    const response = await new FetchAndUpdateCandidatesChatsWhatsapps().fetchCandidatesToEngage()
    const candidateResponseEngagementObj = response?.data?.data;
    await this.startChatEngagement(candidateResponseEngagementObj);
    await this.engageCandidates(candidateResponseEngagementObj);
    return
  }

  filterCandidates(sortedPeopleData:allDataObjects.People) {
    // console.log("This is filter candidates:", sortedPeopleData)
    return sortedPeopleData?.edges?.filter(edge =>
        edge?.node?.candidates?.edges?.length > 0 && edge?.node?.candidates?.edges[0]?.node?.engagementStatus
    );
  }

}