import * as allDataObjects from '../../services/data-model-objects';
import { FetchAndUpdateCandidatesChatsWhatsapps } from './update-chat';
import { axiosRequest, sortWhatsAppMessages } from '../../utils/arx-chat-agent-utils';

import { OpenAIArxMultiStepClient } from '../llm-agents/arx-multi-step-client';
import { ToolsForAgents } from '../llm-agents/prompting-tool-calling';

const readline = require('node:readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

export default class CandidateEngagementArx {
  async createAndUpdateCandidateStartChatChatMessage(chatReply: string, candidateProfileDataNodeObj: allDataObjects.PersonNode, chatControl) {
    // console.log("This is the candidate profile data node obj:", candidateProfileDataNodeObj);
    console.log('This is the chat reply in create And Update Candidate Start Chat Chat Message :', chatReply);
    const recruiterProfile = allDataObjects.recruiterProfile;
    let chatHistory = candidateProfileDataNodeObj?.candidates?.edges[0]?.node?.whatsappMessages?.edges[0]?.node?.messageObj || [];
    if (chatReply === 'startChat' && candidateProfileDataNodeObj?.candidates?.edges[0]?.node?.whatsappMessages?.edges.length === 0) {
      const SYSTEM_PROMPT = await new ToolsForAgents().getSystemPrompt(candidateProfileDataNodeObj);
      chatHistory.push({ role: 'system', content: SYSTEM_PROMPT });
      chatHistory.push({ role: 'user', content: 'startChat' });
    } else {
      chatHistory = candidateProfileDataNodeObj?.candidates?.edges[0]?.node?.whatsappMessages?.edges[0]?.node?.messageObj;
    }
    let whatsappTemplate:string
    if (chatControl === 'startChat') {
      whatsappTemplate = "application03"
    }
    else{
      whatsappTemplate = candidateProfileDataNodeObj?.candidates?.edges[0]?.node?.whatsappProvider || 'application03'
    }
    let whatappUpdateMessageObj: allDataObjects.candidateChatMessageType = {
      candidateProfile: candidateProfileDataNodeObj?.candidates?.edges[0]?.node,
      candidateFirstName: candidateProfileDataNodeObj?.name?.firstName,
      phoneNumberFrom: candidateProfileDataNodeObj?.phone,
      whatsappMessageType :whatsappTemplate,
      phoneNumberTo: recruiterProfile.phone,
      messages: [{ content: chatReply }],
      messageType: 'candidateMessage',
      messageObj: chatHistory,
      whatsappDeliveryStatus: 'startChatTriggered',
      whatsappMessageId: 'NA',
    };
    console.log("Sending a messages")
    await this.updateCandidateEngagementDataInTable(whatappUpdateMessageObj);
    // Adding this for now to be able to send messages to the candidates
    // await new WhatsappAPISelector().sendWhatsappMessage(whatappUpdateMessageObj, candidateProfileDataNodeObj, chatHistory);

    return whatappUpdateMessageObj;
  }

  async processCandidate(personNode: allDataObjects.PersonNode, chatControl: allDataObjects.chatControls) {
    // console.log('The edge is ::', edge);
    console.log('Engagement Type:', "the candidate ::", personNode.name.firstName + " " + personNode.name.lastName);
    try {
      const candidateNode = personNode.candidates.edges[0].node;
      // // console.log('This is candidate Node:', candidateNode);
      // const messagesList: allDataObjects.WhatsAppMessagesEdge[] = candidateNode?.whatsappMessages?.edges;
      const whatsappMessagesEdges: allDataObjects.WhatsAppMessagesEdge[] = await new FetchAndUpdateCandidatesChatsWhatsapps().fetchAllWhatsappMessages(candidateNode.id);
      const messagesList: allDataObjects.MessageNode[] = whatsappMessagesEdges.map(edge => edge.node);

      console.log('Current Messages list:', messagesList);
      let mostRecentMessageArr: allDataObjects.ChatHistoryItem[] = this.getMostRecentMessageFromMessagesList(messagesList);
      // console.log('mostRecentMessageArr before chatCompletion:', mostRecentMessageArr);
      if (mostRecentMessageArr?.length > 0) {
        console.log('Taking MULTI Step Client for - Prompt Engineering type:', process.env.PROMPT_ENGINEERING_TYPE);
        let chatAgent = new OpenAIArxMultiStepClient(personNode);
        await chatAgent.createCompletion(mostRecentMessageArr,chatControl);
      }
      else{
        console.log("mostRecentMessageArr?.length is not greater than 0, hence no engagement:: (length)::", mostRecentMessageArr?.length)
      }
    } catch (error) {
      console.log('This is the error in processCandidate', error);
    }
  }
  getMostRecentMessageFromMessagesList(messagesList: allDataObjects.MessageNode[]) {
    let mostRecentMessageArr: allDataObjects.ChatHistoryItem[] = [];
    console.log("messages list in getMostRecentMessageFromMessagesList::", messagesList);
    if (messagesList) {
      // messagesList.sort((a, b) => new Date(b?.node?.createdAt).getTime() - new Date(a?.node?.createdAt).getTime());
      messagesList.sort((a, b) => new Date(b?.createdAt).getTime() - new Date(a?.createdAt).getTime());
      console.log("messages list after sorting in getMostRecentMessageFromMessagesList::", messagesList);
      mostRecentMessageArr = messagesList[0]?.messageObj;

      console.log("This is the most recent messages arr:", mostRecentMessageArr);
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

  async updateChatHistoryObjCreateWhatsappMessageObj(wamId: string, personNode: allDataObjects.PersonNode, chatHistory: allDataObjects.ChatHistoryItem[]): Promise<allDataObjects.candidateChatMessageType> {
    const candidateNode = personNode.candidates.edges[0].node;
    
    const updatedChatHistoryObj: allDataObjects.candidateChatMessageType = {
      messageObj: chatHistory,
      candidateProfile: candidateNode,
      whatsappMessageType: candidateNode?.whatsappProvider || "application03",
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
    console.log("The number of sorted people::", sortedPeopleData.length)
    const minutesToWait = 2;
    const twoMinutesAgo = new Date(Date.now() - minutesToWait * 60 * 1000);
      const filteredCandidatesToEngage = sortedPeopleData.filter(person => {
        if (person?.candidates?.edges?.length > 0) {
            const candidate = person.candidates.edges[0].node;
            if (candidate.engagementStatus) {
                if (candidate.whatsappMessages?.edges?.length > 0) {
                    const latestMessage = candidate.whatsappMessages.edges[0].node;
                    const messageDate = new Date(latestMessage.createdAt);
                    if (messageDate >= twoMinutesAgo) {
                        console.log("Candidate messaged less than "+ minutesToWait.toString() +" minutes ago::"+candidate.name);
                        return false;
                    }
                    return true;
                }
                return true;
            }
        }
        return false;
      });
      console.log("Number of candidates who are filtered and will be engaged:", filteredCandidatesToEngage.length)
      return  filteredCandidatesToEngage
    }

  async startChatEngagement(peopleCandidateResponseEngagementArr: allDataObjects.PersonNode[]) {
    console.log('Total number of candidates fetched to filter for start chat::', peopleCandidateResponseEngagementArr?.length);
    const filteredCandidatesToStartEngagement = peopleCandidateResponseEngagementArr?.filter(personNode => {
      return personNode?.candidates?.edges?.length > 0 && personNode?.candidates?.edges[0]?.node?.startChat === true;
    });
    console.log('Number of candidates to who have no filteredCandidatesToStartEngagement ::', filteredCandidatesToStartEngagement?.length);
    const filteredCandidatesWhoHaveNoWhatsappHistory = filteredCandidatesToStartEngagement?.filter(personNode => {
      return personNode?.candidates?.edges[0]?.node?.whatsappMessages?.edges.length === 0;
    });
    console.log('Number of candidates to start chat ::', filteredCandidatesWhoHaveNoWhatsappHistory?.length);
    for (let i = 0; i < filteredCandidatesWhoHaveNoWhatsappHistory?.length; i++) {
      const chatReply = 'startChat';
      const chatControl = 'startChat';
      const candidateProfileDataNodeObj = filteredCandidatesWhoHaveNoWhatsappHistory[i];
      await new CandidateEngagementArx().createAndUpdateCandidateStartChatChatMessage(chatReply, candidateProfileDataNodeObj, chatControl);

    }
  }
  async delay(min: number, max: number): Promise<void> {
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, ms));
  }
  
  async engageCandidates(peopleCandidateResponseEngagementArr: allDataObjects.PersonNode[]) {
    console.log("These are the candidates who we want to engage ::",peopleCandidateResponseEngagementArr.length )
    const sortedPeopleData: allDataObjects.PersonNode[] = sortWhatsAppMessages(peopleCandidateResponseEngagementArr);
    const filteredCandidates: allDataObjects.PersonNode[] = this.filterCandidates(sortedPeopleData);
    console.log('Number processCandidateof filtered candidates to engage:', filteredCandidates?.length);
    for (const personNode of filteredCandidates) {
      console.log("This is the personNode?.candidates?.edges[0]?.node:: for which we will start engagement", personNode?.candidates?.edges[0]?.node?.name)
      await new FetchAndUpdateCandidatesChatsWhatsapps().updateEngagementStatusBeforeRunningEngageCandidates(personNode?.candidates?.edges[0]?.node?.id);
      console.log('Updated engagement status to false for candidate and going to process their candidature:', personNode?.name?.firstName);
      const chatControl = 'startChat'; //
      await this.processCandidate(personNode, chatControl);
    }
  }

  async checkCandidateEngagement() {
    console.log("Cron running and cycle started to check candidate engagement");
    const peopleCandidateResponseEngagementArr = await new FetchAndUpdateCandidatesChatsWhatsapps().fetchPeopleToEngageByCheckingOnlyStartChat();
    if (peopleCandidateResponseEngagementArr) {
      await this.engageCandidates(peopleCandidateResponseEngagementArr);
    }
    if (peopleCandidateResponseEngagementArr) {
      await this.startChatEngagement(peopleCandidateResponseEngagementArr);
    }
    return;
  }
}
