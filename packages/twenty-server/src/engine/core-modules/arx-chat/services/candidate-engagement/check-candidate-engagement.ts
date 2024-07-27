// import { AIMessage, HumanMessage, BaseMessage } from "@langchain/core/messages";
import * as allDataObjects from '../../services/data-model-objects';
import { FetchAndUpdateCandidatesChatsWhatsapps } from './update-chat';
// import { FacebookWhatsappChatApi } from '../../services/whatsapp-api/facebook-whatsapp/facebook-whatsapp-api';
import { WhatsappAPISelector } from '../../services/whatsapp-api/whatsapp-controls';
import { axiosRequest, sortWhatsAppMessages } from '../../utils/arx-chat-agent-utils';
import { ChainValues } from '@langchain/core/utils/types';

import { response } from 'express';
// import { OpenAIArxSingleStepClient } from "../llm-agents/arx-single-step-client";
import { OpenAIArxMultiStepClient } from '../llm-agents/arx-multi-step-client';
import { ToolsForAgents } from '../llm-agents/prompting-tool-calling';
import * as allGraphQLQueries from './graphql-queries-chatbot';

const readline = require('node:readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

export default class CandidateEngagementArx {
  async createAndUpdateCandidateHiChatMessage(chatReply: string, candidateProfileDataNodeObj: allDataObjects.PersonNode) {
    // console.log("This is the candidate profile data node obj:", candidateProfileDataNodeObj);
    console.log('This is the chat reply:', chatReply);
    const recruiterProfile = allDataObjects.recruiterProfile;
    let chatHistory = candidateProfileDataNodeObj?.candidates?.edges[0]?.node?.whatsappMessages?.edges[0]?.node?.messageObj || [];
    if (chatReply === 'hi' && candidateProfileDataNodeObj?.candidates?.edges[0]?.node?.whatsappMessages?.edges.length === 0) {
      const SYSTEM_PROMPT = await new ToolsForAgents().getSystemPrompt(candidateProfileDataNodeObj);
      chatHistory.push({ role: 'system', content: SYSTEM_PROMPT });
      chatHistory.push({ role: 'user', content: 'Hi' });
    } else {
      chatHistory = candidateProfileDataNodeObj?.candidates?.edges[0]?.node?.whatsappMessages?.edges[0]?.node?.messageObj;
    }
    let whatappUpdateMessageObj: allDataObjects.candidateChatMessageType = {
      // executorResultObj: {},
      candidateProfile: candidateProfileDataNodeObj?.candidates?.edges[0]?.node,
      candidateFirstName: candidateProfileDataNodeObj?.name?.firstName,
      phoneNumberFrom: candidateProfileDataNodeObj?.phone,
      phoneNumberTo: recruiterProfile.phone,
      messages: [{ content: chatReply }],
      messageType: 'candidateMessage',
      messageObj: chatHistory,
      whatsappDeliveryStatus: 'startChatTriggered',
      whatsappMessageId: 'NA',
    };
    await this.updateCandidateEngagementDataInTable(whatappUpdateMessageObj);
    // Adding this for now to be able to send messages to the candidates
    // await new WhatsappAPISelector().sendWhatsappMessage(whatappUpdateMessageObj, candidateProfileDataNodeObj, chatHistory);

    return whatappUpdateMessageObj;
  }

  async processCandidate(personNode: allDataObjects.PersonNode, engagementType: 'remind' | 'engage') {
    // console.log('The edge is ::', edge);
    console.log('Engagement Type:', engagementType);
    try {
      const candidateNode = personNode.candidates.edges[0].node;
      // console.log('This is candidate Node:', candidateNode);
      const messagesList: allDataObjects.WhatsAppMessagesEdge[] = candidateNode?.whatsappMessages?.edges;
      // console.log('Current Messages list:', messagesList);
      let mostRecentMessageArr: allDataObjects.ChatHistoryItem[] = this.getMostRecentMessageFromMessagesList(messagesList);
      // console.log('mostRecentMessageArr before chatCompletion:', mostRecentMessageArr);
      if (mostRecentMessageArr?.length > 0) {
        console.log('Taking MULTI Step Client for - Prompt Engineering type:', process.env.PROMPT_ENGINEERING_TYPE);
        let chatAgent = new OpenAIArxMultiStepClient(personNode);
        await chatAgent.createCompletion(mostRecentMessageArr, personNode, engagementType);
      }
    } catch (error) {
      console.log('This is the error in processCandidate', error);
      debugger;
    }
  }
  getMostRecentMessageFromMessagesList(messagesList: allDataObjects.WhatsAppMessagesEdge[]) {
    let mostRecentMessageArr: allDataObjects.ChatHistoryItem[] = [];
    if (messagesList) {
      messagesList.sort((a, b) => new Date(b.node.createdAt).getTime() - new Date(a.node.createdAt).getTime());
      mostRecentMessageArr = messagesList[0]?.node?.messageObj;
      // console.log(mostRecentMessageArr);
    }
    return mostRecentMessageArr;
  }

  async updateCandidateEngagementDataInTable(whatappUpdateMessageObj: allDataObjects.candidateChatMessageType, isAfterMessageSent: boolean = false) {
    // console.log("Candidate information before processing:", whatappUpdateMessageObj);
    let candidateProfileObj = whatappUpdateMessageObj.messageType !== 'botMessage' ? await new FetchAndUpdateCandidatesChatsWhatsapps().getCandidateInformation(whatappUpdateMessageObj) : whatappUpdateMessageObj.candidateProfile;
    // console.log('Candidate information after processing:', candidateProfileObj);
    // console.log( 'Whatsapp Objs :::', candidateProfileObj.whatsappMessages.edges.map((edge: any) => edge.node.messageObj), );
    if (candidateProfileObj.name === '') return;
    console.log('Candidate information retrieved successfully');
    const whatsappMessage = await new FetchAndUpdateCandidatesChatsWhatsapps().createAndUpdateWhatsappMessage(candidateProfileObj, whatappUpdateMessageObj);
    if (!whatsappMessage || isAfterMessageSent) return;
    const updateCandidateStatusObj = await new FetchAndUpdateCandidatesChatsWhatsapps().updateCandidateEngagementStatus(candidateProfileObj, whatappUpdateMessageObj);
    if (!updateCandidateStatusObj) return;
    // await new WhatsappAPISelector().sendWhatsappMessage(whatappUpdateMessageObj);
    return { status: 'success', message: 'Candidate engagement status updated successfully' };
  }

  async updateChatHistoryObjCreateWhatsappMessageObj(wamId: string, personNode: allDataObjects.PersonNode, chatHistory: allDataObjects.ChatHistoryItem[]) {
    const candidateNode = personNode.candidates.edges[0].node;
    const updatedChatHistoryObj = {
      // executorResultObj: result,
      messageObj: chatHistory,
      candidateProfile: candidateNode,
      candidateFirstName: personNode.name?.firstName,
      phoneNumberFrom: allDataObjects.recruiterProfile?.phone,
      phoneNumberTo: personNode.phone,
      messages: chatHistory.slice(-1),
      messageType: 'botMessage',
      whatsappDeliveryStatus: 'created',
      whatsappMessageId: wamId,
    };
    return updatedChatHistoryObj;
  }

  filterCandidates(sortedPeopleData: allDataObjects.PersonNode[]) {
    // console.log("This is filter candidates:", sortedPeopleData)
    return sortedPeopleData?.filter(edge => edge?.candidates?.edges?.length > 0 && edge?.candidates?.edges[0]?.node?.engagementStatus);
  }

  async startChatEngagement(candidateResponseEngagementArr: allDataObjects.PersonNode[]) {
    console.log('Total number of candidates fetched to filter for start chat::', candidateResponseEngagementArr?.length);
    const filteredCandidatesToStartEngagement = candidateResponseEngagementArr?.filter(personNode => {
      // if (personNode.name.firstName === 'Ninad') {
      //   console.log('This is the Ninads candidate:', personNode);
      // }
      return personNode?.candidates?.edges?.length > 0 && personNode?.candidates?.edges[0]?.node?.startChat === true;
    });
    console.log('these are the number of candidates to who have no filteredCandidatesToStartEngagement ::', filteredCandidatesToStartEngagement?.length);
    const filteredCandidatesWhoHaveNoWhatsappHistory = filteredCandidatesToStartEngagement?.filter(personNode => {
      return personNode?.candidates?.edges[0]?.node?.whatsappMessages?.edges.length === 0;
    });
    console.log('these are the number of candidates to start chat ::', filteredCandidatesWhoHaveNoWhatsappHistory?.length);
    for (let i = 0; i < filteredCandidatesWhoHaveNoWhatsappHistory?.length; i++) {
      const chatReply = 'hi';
      const candidateProfileDataNodeObj = filteredCandidatesWhoHaveNoWhatsappHistory[i];
      await new CandidateEngagementArx().createAndUpdateCandidateHiChatMessage(chatReply, candidateProfileDataNodeObj);
      // const updateCandidateStatusObj = await new FetchAndUpdateCandidatesChatsWhatsapps().setCandidateEngagementStatusToFalse(candidateProfileDataNodeObj.candidates.edges[0].node);
    }
  }

  async engageCandidates(candidateResponseEngagementArr: allDataObjects.PersonNode[]) {
    // console.log("This is candidateResponseEngagementObj:", candidateResponseEngagementArr)
    const sortedPeopleData: allDataObjects.PersonNode[] = sortWhatsAppMessages(candidateResponseEngagementArr);
    const filteredCandidates: allDataObjects.PersonNode[] = this.filterCandidates(sortedPeopleData);
    console.log('Filtered candidates to engage:', filteredCandidates);
    const listOfCandidatesToRemind: allDataObjects.PersonNode[] = candidateResponseEngagementArr?.filter((edge: allDataObjects.PersonNode) => {
      edge?.candidates?.edges[0]?.node?.candidateReminders?.edges?.filter(reminderEdge => reminderEdge?.node?.remindCandidateAtTimestamp < new Date().toISOString() && reminderEdge?.node?.isReminderActive);
    });

    console.log('Number processCandidateof filtered candidates to engage:', filteredCandidates?.length);
    for (const personNode of filteredCandidates) {
      // await new FetchAndUpdateCandidatesChatsWhatsapps().setCandidateEngagementStatusToFalse(edge?.node?.candidates?.edges[0]?.node);
      await new FetchAndUpdateCandidatesChatsWhatsapps().updateEngagementStatusBeforeRunningEngageCandidates(personNode?.candidates?.edges[0]?.node?.id);
      console.log('Updated engagement status to false for candidate:', personNode?.name?.firstName);
      await this.processCandidate(personNode, 'engage');
    }
  }

  async checkCandidateEngagement() {
    // await this.checkAvailableRemindersAndSend();
    const limit = 2500;
    const candidateResponseEngagementArr = await new FetchAndUpdateCandidatesChatsWhatsapps().fetchCandidatesToEngage(limit);
    // console.log("Received response to check candidate engagement:resposne", candidateResponseEngagementArr)
    await this.startChatEngagement(candidateResponseEngagementArr);
    await this.engageCandidates(candidateResponseEngagementArr);
    return;
  }
}
