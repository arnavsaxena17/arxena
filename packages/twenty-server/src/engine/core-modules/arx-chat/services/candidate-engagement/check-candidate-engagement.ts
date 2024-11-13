import * as allDataObjects from '../../services/data-model-objects';
import { FetchAndUpdateCandidatesChatsWhatsapps } from './update-chat';
import { sortWhatsAppMessages } from '../../utils/arx-chat-agent-utils';
import { OpenAIArxMultiStepClient } from '../llm-agents/arx-multi-step-client';
import { ToolsForAgents } from '../llm-agents/prompting-tool-calling';

const readline = require('node:readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

export default class CandidateEngagementArx {
  async createAndUpdateCandidateStartChatChatMessage(chatReply: string, candidateProfileDataNodeObj: allDataObjects.PersonNode, chatControl: allDataObjects.chatControls) {
    // console.log("This is the candidate profile data node obj:", candidateProfileDataNodeObj);
    console.log('This is the chat reply in create And Update Candidate Start Chat Chat Message :', chatReply);
    const recruiterProfile = allDataObjects.recruiterProfile;
    let chatHistory = candidateProfileDataNodeObj?.candidates?.edges[0]?.node?.whatsappMessages?.edges[0]?.node?.messageObj || [];
    if (chatReply === 'startChat' && candidateProfileDataNodeObj?.candidates?.edges[0]?.node?.whatsappMessages?.edges.length === 0) {
      const SYSTEM_PROMPT = await new ToolsForAgents().getSystemPrompt(candidateProfileDataNodeObj, chatControl);
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
      lastEngagementChatControl: chatControl,
      messageType: 'candidateMessage',
      messageObj: chatHistory,
      whatsappDeliveryStatus: 'startChatTriggered',
      whatsappMessageId: 'NA',
    };
    console.log("Sending a messages")
    await this.updateCandidateEngagementDataInTable(whatappUpdateMessageObj);
    // await new WhatsappAPISelector().sendWhatsappMessage(whatappUpdateMessageObj, candidateProfileDataNodeObj, chatHistory);
    return whatappUpdateMessageObj;
  }

  async processCandidate(personNode: allDataObjects.PersonNode, chatControl: allDataObjects.chatControls) {
    console.log("Engagement Type the candidate ::", personNode.name.firstName + " " + personNode.name.lastName);
    try {
      const candidateNode = personNode.candidates.edges[0].node;
      const messagesList: allDataObjects.MessageNode[] = await new FetchAndUpdateCandidatesChatsWhatsapps().fetchAllWhatsappMessages(candidateNode.id);
      let mostRecentMessageArr: allDataObjects.ChatHistoryItem[] = this.getMostRecentMessageFromMessagesList(messagesList);
      if (mostRecentMessageArr?.length > 0) {
        console.log('Taking MULTI Step Client for - Prompt Engineering type:', process.env.PROMPT_ENGINEERING_TYPE);
        await new OpenAIArxMultiStepClient(personNode).createCompletion(mostRecentMessageArr,chatControl);
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
    if (messagesList) {
      messagesList.sort((a, b) => new Date(b?.createdAt).getTime() - new Date(a?.createdAt).getTime());
      // console.log("messages list after sorting in getMostRecentMessageFromMessagesList::", messagesList);
      mostRecentMessageArr = messagesList[0]?.messageObj;
      console.log("This is the most recent messages arr:", mostRecentMessageArr);
    }
    return mostRecentMessageArr;
  }

  async updateCandidateEngagementDataInTable(whatappUpdateMessageObj: allDataObjects.candidateChatMessageType, isAfterMessageSent: boolean = false) {
    let candidateProfileObj = whatappUpdateMessageObj.messageType !== 'botMessage' ? await new FetchAndUpdateCandidatesChatsWhatsapps().getCandidateInformation(whatappUpdateMessageObj) : whatappUpdateMessageObj.candidateProfile;
    if (candidateProfileObj.name === '') return;
    console.log('Candidate information retrieved successfully');
    const whatsappMessage = await new FetchAndUpdateCandidatesChatsWhatsapps().createAndUpdateWhatsappMessage(candidateProfileObj, whatappUpdateMessageObj);
    if (!whatsappMessage || isAfterMessageSent) return;
    const updateCandidateStatusObj = await new FetchAndUpdateCandidatesChatsWhatsapps().updateCandidateEngagementStatus(candidateProfileObj, whatappUpdateMessageObj);
    if (!updateCandidateStatusObj) return;
    return { status: 'success', message: 'Candidate engagement status updated successfully' };
  }

  async updateChatHistoryObjCreateWhatsappMessageObj(wamId: string, personNode: allDataObjects.PersonNode, chatHistory: allDataObjects.ChatHistoryItem[], chatControl:allDataObjects.chatControls): Promise<allDataObjects.candidateChatMessageType> {
    const candidateNode = personNode.candidates.edges[0].node;
    console.log("This is the candidateNode in updateChatHistoryObjCreateWhatsappMessageObj::", candidateNode);
    const updatedChatHistoryObj: allDataObjects.candidateChatMessageType = {
      messageObj: chatHistory,
      candidateProfile: candidateNode,
      whatsappMessageType: candidateNode?.whatsappProvider || "application03",
      candidateFirstName: personNode.name?.firstName,
      phoneNumberFrom: allDataObjects.recruiterProfile?.phone,
      phoneNumberTo: personNode.phone,
      lastEngagementChatControl: chatControl,
      messages: chatHistory.slice(-1),
      messageType: 'botMessage',
      whatsappDeliveryStatus: 'created',
      whatsappMessageId: wamId,
    };
    return updatedChatHistoryObj;
  }

  async filterCandidatesWhereEngagementStatusIsTrueAndByLastMessagedTime(sortedPeopleData: allDataObjects.PersonNode[], chatControl: allDataObjects.chatControls): Promise<allDataObjects.PersonNode[]> {
    console.log("The number of sorted people::", sortedPeopleData.length)
    const minutesToWait = 2;
    const twoMinutesAgo = new Date(Date.now() - minutesToWait * 60 * 1000);
    const filteredCandidatesToEngage = sortedPeopleData.filter(person => {
      if (person?.candidates?.edges?.length > 0) {
        const candidate = person.candidates.edges[0].node;
        if (!candidate.engagementStatus) {
          return false;
        }
        if (candidate.lastEngagementChatControl !== chatControl) {
          console.log(`Skipping candidate ${candidate.name} because engagement was initiated by ${candidate.lastEngagementChatControl} not ${chatControl}`);
          return false;
        }
        if (chatControl === 'startVideoInterviewChat') {
          if (!candidate.startVideoInterviewChat || !candidate.startChat) {
            return false;
          }
        }
        if (candidate.whatsappMessages?.edges?.length > 0) {
          const latestMessage = candidate.whatsappMessages.edges[0].node;
          const messageDate = new Date(latestMessage.createdAt);
          if (messageDate >= twoMinutesAgo) {
            console.log("Candidate messaged less than "+ minutesToWait.toString() +" minutes ago::" + candidate.name, "for chatControl:", chatControl);
            return false;
          }
          return true;
        }
        return true;
      }
      return false;
    });
    console.log("Number of candidates who are filtered and will be engaged:", filteredCandidatesToEngage.length, "for chatControl:", chatControl)
    return filteredCandidatesToEngage;
  }
  
  async startChatEngagement(peopleCandidateResponseEngagementArr: allDataObjects.PersonNode[],  chatControl: allDataObjects.chatControls) {
    console.log('Total number of candidates fetched to filter for start chat::', peopleCandidateResponseEngagementArr?.length, "for chatControl:", chatControl);
    let filteredCandidatesToStartEngagement: allDataObjects.PersonNode[];
    if (chatControl === 'startChat') {
      filteredCandidatesToStartEngagement = peopleCandidateResponseEngagementArr?.filter(personNode => {
        return personNode?.candidates?.edges?.length > 0 && personNode?.candidates?.edges[0]?.node?.startChat === true && personNode?.candidates?.edges[0]?.node?.whatsappMessages?.edges.length === 0 && personNode?.candidates?.edges[0]?.node?.startVideoInterviewChat === false;
      });
      console.log('Number of candidates to who have no filteredCandidates StartEngagement ::', filteredCandidatesToStartEngagement?.length, "for chatControl:", chatControl);
    }
    else if (chatControl === 'startVideoInterviewChat') {
      filteredCandidatesToStartEngagement = peopleCandidateResponseEngagementArr?.filter(personNode => {
        return personNode?.candidates?.edges?.length > 0 && personNode?.candidates?.edges[0]?.node?.startChat === true && personNode?.candidates?.edges[0]?.node?.whatsappMessages?.edges.length >0 && personNode?.candidates?.edges[0]?.node?.startVideoInterviewChat === true && personNode?.candidates?.edges[0]?.node?.lastEngagementChatControl !== "startVideoInterviewChat";
      });
      console.log('Number of candidates to who have no filteredCandidates StartEngagement ::', filteredCandidatesToStartEngagement?.length, "for chatControl:", chatControl);
    }
    else{
      filteredCandidatesToStartEngagement = peopleCandidateResponseEngagementArr?.filter(personNode => {
        return personNode?.candidates?.edges?.length > 0 && personNode?.candidates?.edges[0]?.node?.startChat === true && personNode?.candidates?.edges[0]?.node?.whatsappMessages?.edges.length >0;
      });
    }
    console.log('Number of candidates to start chat ::', filteredCandidatesToStartEngagement?.length," for chatControl:", chatControl);
    for (let i = 0; i < filteredCandidatesToStartEngagement?.length; i++) {
      const chatReply = chatControl;
      const candidateProfileDataNodeObj = filteredCandidatesToStartEngagement[i];
      await new CandidateEngagementArx().createAndUpdateCandidateStartChatChatMessage(chatReply, candidateProfileDataNodeObj, chatControl);

    }
  }
  async delay(min: number, max: number): Promise<void> {
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, ms));
  }
  
  async engageCandidates(peopleCandidateResponseEngagementArr: allDataObjects.PersonNode[], chatControl: allDataObjects.chatControls) {
    console.log("These are the candidates who we want to engage ::",peopleCandidateResponseEngagementArr.length , "for chat Contro:", chatControl);
    const sortedPeopleData: allDataObjects.PersonNode[] = sortWhatsAppMessages(peopleCandidateResponseEngagementArr);
    const filteredCandidates: allDataObjects.PersonNode[] = await this.filterCandidatesWhereEngagementStatusIsTrueAndByLastMessagedTime(sortedPeopleData, chatControl);
    console.log('Number processCandidateof filtered candidates to engage after time scheduling: ', filteredCandidates?.length, "for chatcontrol", chatControl);
    for (const personNode of filteredCandidates) {
      console.log("This is the personNode?.candidates?.edges[0]?.node:: for which we will start engagement", personNode?.candidates?.edges[0]?.node?.name, "for chatControl:", chatControl);
      await new FetchAndUpdateCandidatesChatsWhatsapps().updateEngagementStatusBeforeRunningEngageCandidates(personNode?.candidates?.edges[0]?.node?.id);
      console.log('Updated engagement status to false for candidate and going to process their candidature:', personNode?.name?.firstName, "for chat Control", chatControl);
      await this.processCandidate(personNode, chatControl);
    }
  }

  async setupVideoInterviewLinks(peopleEngagementStartVideoInterviewChatArr:allDataObjects.PersonNode[], chatControl: allDataObjects.chatControls) {
    if (chatControl === 'startVideoInterviewChat') {
      for (const personNode of peopleEngagementStartVideoInterviewChatArr) {
        const candidateNode = personNode?.candidates?.edges[0]?.node;
        const aiInterviewStatus = candidateNode?.aIInterviewStatus?.edges[0]?.node;
        
        if (!aiInterviewStatus || !aiInterviewStatus.interviewLink?.url) {
          console.log(`Creating video interview link for candidate: ${candidateNode.name}`);
          await new FetchAndUpdateCandidatesChatsWhatsapps().createVideoInterviewForCandidate(candidateNode.id );
        } else {
          console.log(`Skipping candidate ${candidateNode.name} as they already have a video interview link.`);
        }
      }

    }
  }

  async checkCandidateEngagement() {
    try{
      console.log("Cron running and cycle started to check candidate engagement");
      let chatControl:allDataObjects.chatControls 
      chatControl = "startChat";
      const peopleEngagementStartChatArr = await new FetchAndUpdateCandidatesChatsWhatsapps().fetchSpecificPeopleToEngageBasedOnChatControl(chatControl);
      if (peopleEngagementStartChatArr) {
        await this.engageCandidates(peopleEngagementStartChatArr, chatControl);
      }
      if (peopleEngagementStartChatArr) {
        await this.startChatEngagement(peopleEngagementStartChatArr, chatControl);
      }
      chatControl = "startVideoInterviewChat";
      const peopleEngagementStartVideoInterviewChatArr = await new FetchAndUpdateCandidatesChatsWhatsapps().fetchSpecificPeopleToEngageBasedOnChatControl(chatControl);
      console.log("Number of people for videointerview to start engagement or engage::", peopleEngagementStartVideoInterviewChatArr.length, "for chatControl:", chatControl);
      if (peopleEngagementStartVideoInterviewChatArr) {
        await this.setupVideoInterviewLinks(peopleEngagementStartVideoInterviewChatArr, chatControl);
      }      
      if (peopleEngagementStartVideoInterviewChatArr) {
        await this.startChatEngagement(peopleEngagementStartVideoInterviewChatArr, chatControl);
      }      
      if (peopleEngagementStartVideoInterviewChatArr) {
        await this.engageCandidates(peopleEngagementStartVideoInterviewChatArr, chatControl);
      }
      return;
    }
    catch(error){
      console.log("This is the error in checkCandidate Engagement", error);
    }
  }
}
