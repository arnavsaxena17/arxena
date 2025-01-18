import * as allDataObjects from '../data-model-objects';
import { FetchAndUpdateCandidatesChatsWhatsapps } from './update-chat';
import { sortWhatsAppMessages } from '../../utils/arx-chat-agent-utils';
import { OpenAIArxMultiStepClient } from '../llm-agents/arx-multi-step-client';
import { ToolsForAgents } from '../llm-agents/prompting-tool-calling';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
const readline = require('node:readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});



export default class CandidateEngagementArx {
  constructor( private readonly workspaceQueryService: WorkspaceQueryService ) {}
  async createAndUpdateCandidateStartChatChatMessage(chatReply: string, candidateProfileDataNodeObj: allDataObjects.PersonNode, chatControl: allDataObjects.chatControls, apiToken: string) {
    const recruiterProfile = allDataObjects.recruiterProfile;
    const messagesList: allDataObjects.MessageNode[] = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).fetchAllWhatsappMessages(candidateProfileDataNodeObj.candidates?.edges[0]?.node.id, apiToken);
    const sortedMessagesList = messagesList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    let chatHistory = sortedMessagesList[0]?.messageObj || [];
    let whatsappTemplate:string
    if (chatReply === 'startChat' && candidateProfileDataNodeObj?.candidates?.edges[0]?.node?.whatsappMessages?.edges.length === 0) {
      const SYSTEM_PROMPT = await new ToolsForAgents(this.workspaceQueryService).getSystemPrompt(candidateProfileDataNodeObj, chatControl,  apiToken);
      chatHistory.push({ role: 'system', content: SYSTEM_PROMPT });
      chatHistory.push({ role: 'user', content: 'startChat' });
      whatsappTemplate = "application03"
    }
    else if (chatReply === 'startVideoInterviewChat' && candidateProfileDataNodeObj?.candidates?.edges[0]?.node?.whatsappMessages?.edges.length > 0) {
      chatHistory = sortedMessagesList[0]?.messageObj;
      chatHistory.push({ role: 'user', content: 'startVideoInterviewChat' });
      whatsappTemplate = "application03"
    } else {
      chatHistory = sortedMessagesList[0]?.messageObj;
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
    
    await this.updateCandidateEngagementDataInTable(candidateProfileDataNodeObj, whatappUpdateMessageObj, apiToken);    
  }

  async processCandidate(personNode: allDataObjects.PersonNode, chatControl: allDataObjects.chatControls, apiToken:string) {
    console.log("Engagement Type for the candidate ::", personNode.name.firstName + " " + personNode.name.lastName);
    try {
      const candidateNode = personNode.candidates.edges[0].node;
      const messagesList: allDataObjects.MessageNode[] = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).fetchAllWhatsappMessages(candidateNode.id, apiToken);
      let mostRecentMessageArr: allDataObjects.ChatHistoryItem[] = this.getMostRecentMessageFromMessagesList(messagesList);
      if (mostRecentMessageArr?.length > 0) {
        console.log('Taking MULTI Step Client for - Prompt Engineering type:', process.env.PROMPT_ENGINEERING_TYPE);
        await new OpenAIArxMultiStepClient(personNode, this.workspaceQueryService ).createCompletion(mostRecentMessageArr,chatControl, apiToken);
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
      mostRecentMessageArr = messagesList[0]?.messageObj;
    }
    return mostRecentMessageArr;
  }

  async updateCandidateEngagementDataInTable(personDataNodeObj:allDataObjects.PersonNode, whatappUpdateMessageObj: allDataObjects.candidateChatMessageType, apiToken:string, isAfterMessageSent: boolean = false) {
    let candidateProfileObj = whatappUpdateMessageObj.messageType !== 'botMessage' ? await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).getCandidateInformation(whatappUpdateMessageObj,apiToken) : whatappUpdateMessageObj.candidateProfile;
    if (candidateProfileObj.name === '') return;
    console.log('Candidate information retrieved successfully');
    const whatsappMessage = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).createAndUpdateWhatsappMessage(candidateProfileObj, whatappUpdateMessageObj,apiToken);
    if (!whatsappMessage || isAfterMessageSent) return;
    const updateCandidateStatusObj = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).updateCandidateEngagementStatus(candidateProfileObj, whatappUpdateMessageObj, apiToken);
    if (!updateCandidateStatusObj) return;
    return { status: 'success', message: 'Candidate engagement status updated successfully' };
  }

  async updateChatHistoryObjCreateWhatsappMessageObj(wamId: string, personNode: allDataObjects.PersonNode, chatHistory: allDataObjects.ChatHistoryItem[], chatControl:allDataObjects.chatControls,  apiToken:string): Promise<allDataObjects.candidateChatMessageType> {
    const candidateNode = personNode.candidates.edges[0].node;
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

  isCandidateEligibleForEngagement = (candidate: allDataObjects.CandidateNode, sortedPeopleData, chatControl) => {
    const minutesToWait = 0;
    const twoMinutesAgo = new Date(Date.now() - minutesToWait * 60 * 1000);

    if (!candidate.engagementStatus || candidate.lastEngagementChatControl !== chatControl) return false;
    if (chatControl === 'startVideoInterviewChat' && (!candidate.startVideoInterviewChat || !candidate.startChat)) return false;
    if (candidate.whatsappMessages?.edges?.length > 0) {
    const latestMessage = candidate.whatsappMessages.edges[0].node;
    if (new Date(latestMessage.createdAt) >= twoMinutesAgo) {
      console.log(`Candidate messaged less than ${minutesToWait} minutes ago:: ${candidate.name} for chatControl: ${chatControl}`);
      return false;
    }
    }
    return true;
  };

  async startChatEngagement(peopleCandidateResponseEngagementArr: allDataObjects.PersonNode[],  chatControl: allDataObjects.chatControls,  apiToken:string) {

    const filterCandidates = (personNode: allDataObjects.PersonNode) => {
      const candidate = personNode?.candidates?.edges[0]?.node;
      if (!candidate) return false;
      if (chatControl === 'startChat') {
      return candidate.startChat && candidate.whatsappMessages?.edges.length === 0 && !candidate.startVideoInterviewChat;
      } else if (chatControl === 'startVideoInterviewChat') {
      return candidate.startChat && candidate.whatsappMessages?.edges.length > 0 && candidate.startVideoInterviewChat && candidate.lastEngagementChatControl !== "startVideoInterviewChat";
      } else {
      return candidate.startChat && candidate.whatsappMessages?.edges.length > 0;
      }
    };
    const filteredCandidatesToStartEngagement = peopleCandidateResponseEngagementArr?.filter(filterCandidates);
    console.log('Number of candidates to start chat after all filters for start chat ::', filteredCandidatesToStartEngagement?.length, "for chatControl:", chatControl);
    for (const candidateProfileDataNodeObj of filteredCandidatesToStartEngagement) {
      const chatReply = chatControl
      await this.createAndUpdateCandidateStartChatChatMessage(chatReply, candidateProfileDataNodeObj, chatControl, apiToken);
    }
  }
  
  async engageCandidates(peopleCandidateResponseEngagementArr: allDataObjects.PersonNode[], chatControl: allDataObjects.chatControls,  apiToken:string) {
    console.log("These are the candidates who we want to engage ::",peopleCandidateResponseEngagementArr.length , "for chat Contro:", chatControl);
    const sortedPeopleData: allDataObjects.PersonNode[] = sortWhatsAppMessages(peopleCandidateResponseEngagementArr);
    const filteredCandidatesToEngage = sortedPeopleData.filter(person => {
      const candidate = person?.candidates?.edges?.[0]?.node;
      return candidate ? this.isCandidateEligibleForEngagement(candidate, sortedPeopleData, chatControl) : false;
    });
    console.log('Number processCandidateof filtered candidates to engage after time scheduling: ', filteredCandidatesToEngage?.length, "for chatcontrol", chatControl);
    for (const personNode of filteredCandidatesToEngage) {
      await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).updateEngagementStatusBeforeRunningEngageCandidates(personNode?.candidates?.edges[0]?.node?.id,apiToken);
      await this.processCandidate(personNode, chatControl,  apiToken);
    }
  }
  
  async setupVideoInterviewLinks(peopleEngagementStartVideoInterviewChatArr:allDataObjects.PersonNode[], chatControl: allDataObjects.chatControls,  apiToken:string) {
    if (chatControl === 'startVideoInterviewChat') {
      let skippedCount = 0;
      let createdCount = 0;

      for (const personNode of peopleEngagementStartVideoInterviewChatArr) {
        const candidateNode = personNode?.candidates?.edges[0]?.node;
        const videoInterview = candidateNode?.videoInterview?.edges[0]?.node;
        
        if (!videoInterview || !videoInterview.interviewLink?.url) {
          await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).createVideoInterviewForCandidate(candidateNode.id, apiToken);
          createdCount++;
        } else {
          skippedCount++;
        }
      }

      console.log(`Total candidates skipped for video interview creation: ${skippedCount}`);
      console.log(`Total video interviews created: ${createdCount}`);
    }
  }

  async checkCandidateEngagement(apiToken:string) {
    try{
      console.log("Cron running and cycle started to check candidate engagement");
      const chatControls: allDataObjects.chatControls[] = ["startChat", "startVideoInterviewChat"];
      for (const chatControl of chatControls) {
        const peopleToEngage = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).fetchSpecificPeopleToEngageBasedOnChatControl(chatControl, apiToken);
        this.checkIfAllInformationForSendingChatMessageIsAvailable(peopleToEngage, chatControl, apiToken);
        console.log(`Number of people to engage for ${chatControl}:`, peopleToEngage.length);
        if (peopleToEngage.length > 0) {
          if (chatControl === "startVideoInterviewChat") {
            await this.setupVideoInterviewLinks(peopleToEngage, chatControl, apiToken);
          }
          await this.startChatEngagement(peopleToEngage, chatControl, apiToken);
          await this.engageCandidates(peopleToEngage, chatControl, apiToken);
        }
      }
      return;
    }
    catch(error){
      console.log("This is the error in checkCandidate Engagement", error);
    }
  }
  checkIfAllInformationForSendingChatMessageIsAvailable(peopleEngagementStartChatArr: allDataObjects.PersonNode[], chatControl: string, apiToken: string) {
    // candidateFirstName
    // recruiterName
    // recruiterJobTitle
    // recruiterCompanyName
    // recruiterCompanyDescription
    // jobPositionName
    // descriptionOneliner
    // jobLocation
    // Attachment For JD
    // fetchQuestionsByJobId(jobId: string)

    // videoInterviewTemplate
    // questionsTemplate
  }
}
