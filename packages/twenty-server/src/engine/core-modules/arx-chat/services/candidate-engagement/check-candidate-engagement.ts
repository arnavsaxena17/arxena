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
  async createAndUpdateCandidateStartChatChatMessage(chatReply: string, candidateProfileDataNodeObj: allDataObjects.PersonNode) {
    // console.log("This is the candidate profile data node obj:", candidateProfileDataNodeObj);
    console.log('This is the chat reply in createAndUpdateCandidateStartChatChatMessage :', chatReply);
    const recruiterProfile = allDataObjects.recruiterProfile;
    let chatHistory = candidateProfileDataNodeObj?.candidates?.edges[0]?.node?.whatsappMessages?.edges[0]?.node?.messageObj || [];
    if (chatReply === 'startChat' && candidateProfileDataNodeObj?.candidates?.edges[0]?.node?.whatsappMessages?.edges.length === 0) {
      const SYSTEM_PROMPT = await new ToolsForAgents().getSystemPrompt(candidateProfileDataNodeObj);
      chatHistory.push({ role: 'system', content: SYSTEM_PROMPT });
      chatHistory.push({ role: 'user', content: 'startChat' });
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

  filterCandidates(sortedPeopleData: allDataObjects.PersonNode[]): allDataObjects.PersonNode[] {
  const minutesToWait = 1
  const twoMinutesAgo = new Date(Date.now() - minutesToWait * 60 * 1000);
    // return sortedPeopleData?.filter(edge => edge?.candidates?.edges?.length > 0 && edge?.candidates?.edges[0]?.node?.engagementStatus);
    // THis is for when we want to engage people only after 3 minutes of receiving their response
    return sortedPeopleData.filter(person => {
        // Check if the person has candidates
        if (person.candidates?.edges?.length > 0) {
            const candidate = person.candidates.edges[0].node;
            // Check if the candidate has engagement status
            if (candidate.engagementStatus) {
                // Check if the candidate has WhatsApp messages
                if (candidate.whatsappMessages?.edges?.length > 0) {
                    // Get the latest WhatsApp message
                    const latestMessage = candidate.whatsappMessages.edges[0].node;
                    // Check if the latest message is older than 3 minutes
                    const messageDate = new Date(latestMessage.createdAt);
                    if (messageDate >= twoMinutesAgo) {
                        console.log("Candidate messaged less than "+minutesToWait.toString()+" minutes ago:");
                        return false;
                    }
                    return true;
                }
                // If there are no WhatsApp messages, include this candidate
                return true;
            }
        }
        // If there are no candidates or the candidate has no engagement status, exclude this person
        return false;
    });
  }

  async startChatEngagement(peopleCandidateResponseEngagementArr: allDataObjects.PersonNode[]) {
    console.log('Total number of candidates fetched to filter for start chat::', peopleCandidateResponseEngagementArr?.length);
    const filteredCandidatesToStartEngagement = peopleCandidateResponseEngagementArr?.filter(personNode => {
      return personNode?.candidates?.edges?.length > 0 && personNode?.candidates?.edges[0]?.node?.startChat === true;
    });
    console.log('these are the number of candidates to who have no filteredCandidatesToStartEngagement ::', filteredCandidatesToStartEngagement?.length);
    const filteredCandidatesWhoHaveNoWhatsappHistory = filteredCandidatesToStartEngagement?.filter(personNode => {
      return personNode?.candidates?.edges[0]?.node?.whatsappMessages?.edges.length === 0;
    });
    console.log('these are the number of candidates to start chat ::', filteredCandidatesWhoHaveNoWhatsappHistory?.length);
    for (let i = 0; i < filteredCandidatesWhoHaveNoWhatsappHistory?.length; i++) {
      const chatReply = 'startChat';
      const candidateProfileDataNodeObj = filteredCandidatesWhoHaveNoWhatsappHistory[i];

      await new CandidateEngagementArx().createAndUpdateCandidateStartChatChatMessage(chatReply, candidateProfileDataNodeObj);

      // const updateCandidateStatusObj = await new FetchAndUpdateCandidatesChatsWhatsapps().setCandidateEngagementStatusToFalse(candidateProfileDataNodeObj.candidates.edges[0].node);
    }
  }


  async delay(min: number, max: number): Promise<void> {
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, ms));
  }
// This is the engagement we created for baileys bot which we are not using anymore
  // async startChatEngagement(peopleCandidateResponseEngagementArr: allDataObjects.PersonNode[]) {
  //   console.log('Total number of candidates fetched to filter for start chat::', peopleCandidateResponseEngagementArr?.length);
  //   const filteredCandidatesToStartEngagement = peopleCandidateResponseEngagementArr?.filter(personNode => 
  //     personNode?.candidates?.edges?.length > 0 && personNode?.candidates?.edges[0]?.node?.startChat === true
  //   );
  //   console.log('Number of candidates with filteredCandidatesToStartEngagement::', filteredCandidatesToStartEngagement?.length);
  //   const filteredCandidatesWhoHaveNoWhatsappHistory = filteredCandidatesToStartEngagement?.filter(personNode => 
  //     personNode?.candidates?.edges[0]?.node?.whatsappMessages?.edges.length === 0
  //   );
  //   console.log('Number of candidates to start chat::', filteredCandidatesWhoHaveNoWhatsappHistory?.length);
  //   // Process candidates in batches
  //   for (let i = 0; i < filteredCandidatesWhoHaveNoWhatsappHistory.length; i += 15) {
  //     // Determine batch size (8 to 15)
  //     const batchSize = Math.floor(Math.random() * (15 - 8 + 1)) + 8;
  //     const batch = filteredCandidatesWhoHaveNoWhatsappHistory.slice(i, i + batchSize);
  //     console.log(`Processing batch of ${batch.length} candidates`);
  //     for (const candidateProfileDataNodeObj of batch) {
  //       const chatReply = 'startChat';
  //       await new CandidateEngagementArx().createAndUpdateCandidateStartChatChatMessage(chatReply, candidateProfileDataNodeObj);
  //       // Delay between messages (40 to 72 seconds)
  //       await this.delay(40000, 72000);
  //     }
  //     // Delay between batches (5 minutes)
  //     if (i + batchSize < filteredCandidatesWhoHaveNoWhatsappHistory.length) {
  //       console.log('Waiting 5 minutes before processing next batch...');
  //       await this.delay(240000, 300000);
  //     }
  //   }
  //   console.log('Finished processing all candidates');
  // }
  
  async engageCandidates(peopleCandidateResponseEngagementArr: allDataObjects.PersonNode[]) {
    // console.log("This is candidateResponseEngagementObj:", candidateResponseEngagementArr)
    const sortedPeopleData: allDataObjects.PersonNode[] = sortWhatsAppMessages(peopleCandidateResponseEngagementArr);
    const filteredCandidates: allDataObjects.PersonNode[] = this.filterCandidates(sortedPeopleData);
    // console.log('Filtered candidates to engage:', filteredCandidates);
    const listOfCandidatesToRemind: allDataObjects.PersonNode[] = peopleCandidateResponseEngagementArr?.filter((edge: allDataObjects.PersonNode) => {
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
      // const candidateResponseEngagementArr = await new FetchAndUpdateCandidatesChatsWhatsapps().fetchCandidatesToEngage(limit);
      const peopleCandidateResponseEngagementArr = await new FetchAndUpdateCandidatesChatsWhatsapps().fetchPeopleToEngageByCheckingOnlyStartChat();
      // console.log("Received response to check candidate engagement:resposne", candidateResponseEngagementArr)
      if (peopleCandidateResponseEngagementArr) {
        await this.engageCandidates(peopleCandidateResponseEngagementArr);
      }
      if (peopleCandidateResponseEngagementArr) {
        await this.startChatEngagement(peopleCandidateResponseEngagementArr);
      }

      return;
  }
}
