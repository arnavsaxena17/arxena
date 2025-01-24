import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import * as allDataObjects from '../data-model-objects';
import { PromptingAgents } from '../llm-agents/prompting-agents';
import { FacebookWhatsappChatApi } from '../whatsapp-api/facebook-whatsapp/facebook-whatsapp-api';
export class ChatControls {
  constructor(private readonly workspaceQueryService: WorkspaceQueryService) {}

  async getChatTemplateFromChatControls(
    chatControl: allDataObjects.chatControls,
    sortedMessagesList: allDataObjects.MessageNode[],
    candidateJob: allDataObjects.Jobs,
    candidatePersonNodeObj: allDataObjects.PersonNode,
    apiToken: string,
    chatReply: allDataObjects.chatControlType,
    recruiterProfile: allDataObjects.recruiterProfileType,
  ) {
    let whatsappTemplate: string;
    let chatHistory = sortedMessagesList[0]?.messageObj || [];
    if (chatReply === 'startChat' && candidatePersonNodeObj?.candidates?.edges[0]?.node?.whatsappMessages?.edges.length === 0) {
      const SYSTEM_PROMPT = await new PromptingAgents(this.workspaceQueryService).getSystemPrompt(candidatePersonNodeObj, candidateJob, chatControl, apiToken);
      chatHistory.push({ role: 'system', content: SYSTEM_PROMPT });
      chatHistory.push({ role: 'user', content: 'startChat' });
      whatsappTemplate = 'application03';
    } else if (chatReply === 'startVideoInterviewChat' && candidatePersonNodeObj?.candidates?.edges[0]?.node?.whatsappMessages?.edges.length > 0) {
      chatHistory = sortedMessagesList[0]?.messageObj;
      chatHistory.push({ role: 'user', content: 'startVideoInterviewChat' });
      whatsappTemplate = 'application03';
    } else {
      chatHistory = sortedMessagesList[0]?.messageObj;
      whatsappTemplate = candidatePersonNodeObj?.candidates?.edges[0]?.node?.whatsappProvider || 'application03';
    }
    let whatappUpdateMessageObj: allDataObjects.whatappUpdateMessageObjType = {
      candidateProfile: candidatePersonNodeObj?.candidates?.edges[0]?.node,
      candidateFirstName: candidatePersonNodeObj?.name?.firstName,
      phoneNumberFrom: candidatePersonNodeObj?.phone,
      whatsappMessageType: whatsappTemplate,
      phoneNumberTo: recruiterProfile.phone,
      messages: [{ content: chatReply }],
      lastEngagementChatControl: chatControl.chatControlType,
      messageType: 'candidateMessage',
      messageObj: chatHistory,
      whatsappDeliveryStatus: 'startChatTriggered',
      whatsappMessageId: 'NA',
    };
    return whatappUpdateMessageObj;
  }


    isCandidateEligibleForEngagement = (candidate: allDataObjects.CandidateNode, chatControl) => {
      const minutesToWait = 0;
      const twoMinutesAgo = new Date(Date.now() - minutesToWait * 60 * 1000);
  
      if (!candidate.engagementStatus || candidate.lastEngagementChatControl !== chatControl) {
        console.log(`Candidate is not being engaged because engagement status is missing or last engagement chat control does not match for candidate: ${candidate.name}`, "candidate.engagementStatus::", candidate.engagementStatus, "candidate.lastEngagementChatControl::", candidate.lastEngagementChatControl, "chatControl::", chatControl);
        return false;
      }
      if (chatControl === 'startVideoInterviewChat' && (!candidate.startVideoInterviewChat || !candidate.startChat)) {
        console.log(`Candidate is not being engaged because startVideoInterviewChat or startChat is missing for candidate: ${candidate.name}`);
        return false;
      }
      if (chatControl === 'startMeetingSchedulingChat' && (!candidate.startMeetingSchedulingChat || !candidate.startVideoInterviewChat || !candidate.startChat)) {
        console.log(`Candidate is not being engaged because startMeetingSchedulingChat, startVideoInterviewChat, or startChat is missing for candidate: ${candidate.name}`);
        return false;
      }
      if (candidate.whatsappMessages?.edges?.length > 0) {
        const latestMessage = candidate.whatsappMessages.edges[0].node;
        if (new Date(latestMessage.createdAt) >= twoMinutesAgo) {
        console.log(`Candidate messaged less than ${minutesToWait} minutes ago:: ${candidate.name} for chatControl: ${chatControl}`);
        return false;
        }
      }
      return true;
    };
  filterCandidatesAsPerChatControls(peopleCandidateResponseEngagementArr: allDataObjects.PersonNode[], chatControl: allDataObjects.chatControls) {
    const filterCandidates = (personNode: allDataObjects.PersonNode) => {
      const candidate = personNode?.candidates?.edges[0]?.node;
      if (!candidate) return false;
      if (chatControl.chatControlType === 'startChat') {
        return candidate.startChat && candidate.whatsappMessages?.edges.length === 0 && !candidate.startVideoInterviewChat;
      } else if (chatControl.chatControlType === 'startVideoInterviewChat') {
        return candidate.startChat && candidate.whatsappMessages?.edges.length > 0 && candidate.startVideoInterviewChat && candidate.lastEngagementChatControl !== 'startVideoInterviewChat';
      } else if (chatControl.chatControlType === 'startMeetingSchedulingChat') {
        return candidate.startChat && candidate.whatsappMessages?.edges.length > 0 && candidate.startVideoInterviewChat && candidate.startMeetingSchedulingChat && candidate.lastEngagementChatControl !== 'startMeetingSchedulingChat';
      } else {
        return candidate.startChat && candidate.whatsappMessages?.edges.length > 0;
      }
    };
    const filteredCandidatesToStartEngagement = peopleCandidateResponseEngagementArr?.filter(filterCandidates);
    return filteredCandidatesToStartEngagement;
  }

  async runChatControlMessageSending(whatappUpdateMessageObj: allDataObjects.whatappUpdateMessageObjType, chatControl: allDataObjects.chatControls, personNode: allDataObjects.PersonNode, apiToken:string) {
    let response;

    if (whatappUpdateMessageObj?.messages[0]?.content?.toLowerCase().includes('based recruitment company') || whatappUpdateMessageObj?.messages[0]?.content?.toLowerCase().includes('video interview as part of the')) {
      let messageTemplate: string;
      if (whatappUpdateMessageObj?.messages[0]?.content?.toLowerCase().includes('based recruitment company')) {
        if (chatControl.chatControlType === 'startChat') {
          const currentTimeInIndia = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
          const currentHourInIndia = new Date(currentTimeInIndia).getHours();
          if (currentHourInIndia >= 17) {
            messageTemplate = 'application03';
          } else {
            messageTemplate = 'application03';
          }
        } else {
          messageTemplate = whatappUpdateMessageObj?.whatsappMessageType || 'application03';
        }
      } else if (whatappUpdateMessageObj?.messages[0]?.content?.toLowerCase().includes('video interview as part of the') && whatappUpdateMessageObj?.messages[0]?.content?.toLowerCase().includes('questions at the link here')) {
        if (chatControl.chatControlType === 'startVideoInterviewChat') {
          messageTemplate = 'share_video_interview_link_without_button';
        } else {
          messageTemplate = whatappUpdateMessageObj?.whatsappMessageType || 'application03';
        }
      }
      else{
        messageTemplate = 'application03';
      }
      const videoInterviewLink = process.env.SERVER_BASE_URL + personNode?.candidates?.edges[0]?.node?.videoInterview?.edges[0]?.node?.interviewLink?.url || '';
      console.log('videoInterviewLink::', videoInterviewLink);
      const sendTemplateMessageObj: allDataObjects.sendWhatsappUtilityMessageObjectType = {
        recipient: whatappUpdateMessageObj.phoneNumberTo.replace('+', ''),
        template_name: messageTemplate,
        recruiterFirstName: allDataObjects.recruiterProfile.name,
        candidateFirstName: whatappUpdateMessageObj.candidateFirstName,
        recruiterName: allDataObjects.recruiterProfile.name,
        recruiterJobTitle: allDataObjects.recruiterProfile.job_title,
        recruiterCompanyName: allDataObjects.recruiterProfile.job_company_name,
        recruiterCompanyDescription: allDataObjects.recruiterProfile.company_description_oneliner,
        jobPositionName: whatappUpdateMessageObj?.candidateProfile?.jobs?.name,
        companyName: whatappUpdateMessageObj?.candidateProfile?.jobs?.company?.name,
        descriptionOneliner: whatappUpdateMessageObj?.candidateProfile?.jobs?.company?.descriptionOneliner,
        jobCode: whatappUpdateMessageObj?.candidateProfile?.jobs?.jobCode,
        jobLocation: whatappUpdateMessageObj?.candidateProfile?.jobs?.jobLocation,
        videoInterviewLink: videoInterviewLink,
      };
      response = await new FacebookWhatsappChatApi(this.workspaceQueryService).sendWhatsappUtilityMessage(sendTemplateMessageObj, apiToken);
    } else {
      console.log('This is the standard message to send from', allDataObjects.recruiterProfile.phone);
      console.log('This is the standard message to send to phone:', whatappUpdateMessageObj.phoneNumberTo);
      const sendTextMessageObj: allDataObjects.ChatRequestBody = {
        phoneNumberFrom: allDataObjects.recruiterProfile.phone,
        phoneNumberTo: whatappUpdateMessageObj.phoneNumberTo,
        messages: whatappUpdateMessageObj.messages[0].content,
      };
      response = await new FacebookWhatsappChatApi(this.workspaceQueryService).sendWhatsappTextMessage(sendTextMessageObj, apiToken);
    }  
    return  
  }
}
