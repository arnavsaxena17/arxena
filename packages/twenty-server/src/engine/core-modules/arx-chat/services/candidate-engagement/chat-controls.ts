import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import * as allDataObjects from '../data-model-objects';
import { PromptingAgents } from '../llm-agents/prompting-agents';
import { FacebookWhatsappChatApi } from '../whatsapp-api/facebook-whatsapp/facebook-whatsapp-api';
import { TimeManagement } from './scheduling-agent';
import { UpdateChat } from './update-chat';
import { FilterCandidates } from './filter-candidates';
import { ToolCallingAgents } from '../llm-agents/tool-calling-agents';
import { axiosRequest } from '../../utils/arx-chat-agent-utils';
import * as allGraphQLQueries from '../../graphql-queries/graphql-queries-chatbot';
import { graphQltoUpdateOneCandidate } from 'src/engine/core-modules/candidate-sourcing/graphql-queries';
import { StartChatProcesses } from './chat-control-processes/start-chat-processes';
import { StartVideoInterviewChatProcesses } from './chat-control-processes/start-video-interview-chat-processes';

export class ChatControls {
  constructor(private readonly workspaceQueryService: WorkspaceQueryService) {}
  async createChatControl(candidateId: string, chatControl: allDataObjects.chatControls, apiToken: string) {
    console.log('Dynamically changing the chat controls to true if conditions are being met.');
    console.log('Setting the:::chatControl.chatControlType:::', chatControl.chatControlType, 'to true for candidate::', candidateId);
    const graphqlVariables = { idToUpdate: candidateId, input: { [chatControl.chatControlType]: true } };
    const graphqlQueryObj = JSON.stringify({ query: graphQltoUpdateOneCandidate, variables: graphqlVariables });
    const response = await axiosRequest(graphqlQueryObj, apiToken);
    if (response.data.errors) {
      console.log('Error in startChat:', response.data.errors);
    }
    console.log('Response from create ChatControl', response.data.data.updateCandidate, 'for chat control', chatControl.chatControlType, 'for candidate ID:', candidateId);
    return response.data;
  }

  async getTimeDifferentials(chatControl){
    chatControl

  }

  async updateRecentCandidatesChatControls(apiToken: string) {
    console.log('Updating recent candidates chat controls::');
    const filterCandidates = new FilterCandidates(this.workspaceQueryService);
    const candidateUpdates = [
      { ids: await filterCandidates.getRecentlyUpdatedCandidateIdsWithStatusConversationClosed(apiToken), type: 'startVideoInterviewChat' },
      { ids: await filterCandidates.getCandidateIdsWithVideoInterviewCompleted(apiToken), type: 'startMeetingSchedulingChat' }
    ];

    for (const update of candidateUpdates) {
      console.log(`Number of candidates for ${update.type}::`, update.ids.length);
      for (const candidateId of update.ids) {
        await this.createChatControl(candidateId, { chatControlType: update.type as allDataObjects.chatControlType }, apiToken);
      }
    }
  }
  async getSystemPrompt(personNode: allDataObjects.PersonNode, candidateJob: allDataObjects.Jobs, chatControl: allDataObjects.chatControls, apiToken: string) {
    console.log('This is the chatControl:', chatControl);
    if (chatControl.chatControlType == 'startVideoInterviewChat') {
      return new PromptingAgents(this.workspaceQueryService).getVideoInterviewPrompt(personNode, apiToken);
    } else if (chatControl.chatControlType === 'startChat') {
      return new PromptingAgents(this.workspaceQueryService).getStartChatPrompt(personNode, candidateJob, apiToken);
    } else if (chatControl.chatControlType === 'startMeetingSchedulingChat') {
      return new PromptingAgents(this.workspaceQueryService).getStartMeetingSchedulingPrompt(personNode, candidateJob, apiToken);
    } else {
      return new PromptingAgents(this.workspaceQueryService).getStartChatPrompt(personNode, candidateJob, apiToken);
    }
  }

  getFiltersToEngageBasedOnExistingChatControl(chatControlType: allDataObjects.chatControlType) {
    const filters = {
      startChat: [
        { startChat: { eq: true }, startVideoInterviewChat: { is: 'NULL' }, stopChat: { is: 'NULL' } },
        { startChat: { eq: true }, startVideoInterviewChat: { eq: false }, stopChat: { eq: false } },
        { startChat: { eq: true }, startVideoInterviewChat: { is: 'NULL' }, stopChat: { eq: false } },
        { startChat: { eq: true }, startVideoInterviewChat: { eq: false }, stopChat: { is: 'NULL' } },
      ],
      allStartedAndStoppedChats: [{ startChat: { eq: true } }],
      startVideoInterviewChat: [
        { startVideoInterviewChat: { eq: true }, stopChat: { is: 'NULL' } },
        { startVideoInterviewChat: { eq: true }, stopChat: { eq: false } },
      ],
      startMeetingSchedulingChat: [
        { startMeetingSchedulingChat: { eq: true }, startVideoInterviewChat: { eq: true }, stopChat: { is: 'NULL' } },
        { startMeetingSchedulingChat: { eq: true }, startVideoInterviewChat: { eq: true }, stopChat: { eq: false } },
      ],
    };
    const filtersToUse = filters[chatControlType] || [];
    return filtersToUse;
  }
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
      const SYSTEM_PROMPT = await this.getSystemPrompt(candidatePersonNodeObj, candidateJob, chatControl, apiToken);
      chatHistory.push({ role: 'system', content: SYSTEM_PROMPT });
      chatHistory.push({ role: 'user', content: 'startChat' });
      whatsappTemplate = 'application03';
    } else if (chatReply === 'startVideoInterviewChat' && candidatePersonNodeObj?.candidates?.edges[0]?.node?.whatsappMessages?.edges.length > 0) {
      chatHistory = sortedMessagesList[0]?.messageObj;
      chatHistory.push({ role: 'user', content: 'startVideoInterviewChat' });
      whatsappTemplate = 'application03'; // should change
    } else if (chatReply === 'startMeetingSchedulingChat' && candidatePersonNodeObj?.candidates?.edges[0]?.node?.whatsappMessages?.edges.length > 0) {
      chatHistory = sortedMessagesList[0]?.messageObj;
      chatHistory.push({ role: 'user', content: 'startMeetingSchedulingChat' });
      whatsappTemplate = 'application03'; // should change
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
  isCandidateEligibleForEngagement(candidate: allDataObjects.CandidateNode, chatControl: allDataObjects.chatControls) {
    if (!candidate.engagementStatus || candidate.lastEngagementChatControl !== chatControl.chatControlType) {
      console.log(`Candidate is not being engaged because engagement status is missing or last engagement chat control does not match for candidate: ${candidate.name} with engagement status of ${candidate.engagementStatus}`);
      return false;
    }
    if (chatControl.chatControlType === 'startVideoInterviewChat' && (!candidate.startVideoInterviewChat || !candidate.startChat)) {
      console.log(`Candidate is not being engaged because startVideoInterviewChat or startChat is missing for candidate: ${candidate.name}`);
      return false;
    }
    if (chatControl.chatControlType === 'startMeetingSchedulingChat' && (!candidate.startMeetingSchedulingChat || !candidate.startVideoInterviewChat || !candidate.startChat)) {
      console.log(`Candidate is not being engaged because startMeetingSchedulingChat, startVideoInterviewChat, or startChat is missing for candidate: ${candidate.name}`);
      return false;
    }
    const waitTime = TimeManagement.timeDifferentials.timeDifferentialinMinutesToCheckTimeDifferentialBetweenlastMessage;
    const cutoffTime = new Date(Date.now() - (waitTime * 60 * 1000));

    const twoMinutesAgo = new Date(Date.now() - TimeManagement.timeDifferentials.timeDifferentialinMinutesToCheckTimeDifferentialBetweenlastMessage * 60 * 1000);
    if (candidate.whatsappMessages?.edges?.length > 0) {
      const latestMessage = candidate.whatsappMessages.edges[0].node;
      if (new Date(latestMessage.createdAt) >= cutoffTime) {
        console.log(`Candidate messaged less than ${waitTime} minutes ago:: ${candidate.name} for chatControl: ${chatControl.chatControlType}`);
        return false;
      }
    }
    return true;
  }
  async getTools(candidateJob: allDataObjects.Jobs, chatControl: allDataObjects.chatControls) {
    if (chatControl.chatControlType === 'startChat') {
      return new ToolCallingAgents(this.workspaceQueryService).getStartChatTools(candidateJob);
    } else if (chatControl.chatControlType === 'startVideoInterviewChat') {
      return new ToolCallingAgents(this.workspaceQueryService).getVideoInterviewTools(candidateJob);
    } else if (chatControl.chatControlType === 'startMeetingSchedulingChat') {
      return new ToolCallingAgents(this.workspaceQueryService).getStartMeetingSchedulingTools(candidateJob);
    }
  }
  async filterCandidatesAsPerChatControls(peopleCandidateResponseEngagementArr: allDataObjects.PersonNode[], candidateJob, chatControl: allDataObjects.chatControls, apiToken: string) {
    if (chatControl.chatControlType === 'startVideoInterviewChat') {
      await new StartVideoInterviewChatProcesses(this.workspaceQueryService).setupVideoInterviewLinks(peopleCandidateResponseEngagementArr, candidateJob, chatControl, apiToken);
    }
    const filterCandidates = (personNode: allDataObjects.PersonNode) => {
      const candidate = personNode?.candidates?.edges[0]?.node;
      if (!candidate) return false;
      if (chatControl.chatControlType === 'startChat') {
        return candidate.startChat && candidate.whatsappMessages?.edges.length === 0 && !candidate.startVideoInterviewChat;
      } else if (chatControl.chatControlType === 'startVideoInterviewChat') {
        return candidate.startChat && candidate.whatsappMessages?.edges.length > 0 && candidate.startVideoInterviewChat && candidate.lastEngagementChatControl === 'startChat';
      } else if (chatControl.chatControlType === 'startMeetingSchedulingChat') {
        return candidate.startChat && candidate.whatsappMessages?.edges.length > 0 && candidate.startVideoInterviewChat && candidate.startMeetingSchedulingChat && candidate.lastEngagementChatControl === 'startVideoInterviewChat';
      } else {
        return candidate.startChat && candidate.whatsappMessages?.edges.length > 0;
      }
    };
    const filteredCandidatesToStartEngagement = peopleCandidateResponseEngagementArr?.filter(filterCandidates);
    console.log('Number of candidates to start chat engagement::', filteredCandidatesToStartEngagement?.length, 'for chatControl::', chatControl.chatControlType);
    return filteredCandidatesToStartEngagement;
  }
  async runChatControlMessageSending(whatappUpdateMessageObj: allDataObjects.whatappUpdateMessageObjType, chatControl: allDataObjects.chatControls, personNode: allDataObjects.PersonNode, apiToken: string) {
    let response;
    try {
      if (whatappUpdateMessageObj?.messages[0]?.content?.toLowerCase().includes('recruitment company') || whatappUpdateMessageObj?.messages[0]?.content?.toLowerCase().includes('video interview as part of the')) {
        console.log("USING TEMPLATE FOR startChat")
        let messageTemplate: string;
        if (whatappUpdateMessageObj?.messages[0]?.content?.toLowerCase().includes('recruitment company')) {
          if (chatControl.chatControlType === 'startChat') {
            const currentTimeInIndia = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
            const currentHourInIndia = new Date(currentTimeInIndia).getHours();
            if (currentHourInIndia >= 17) {
              messageTemplate = 'application03_any_source_passive_chat_any';
            } else {
              messageTemplate = 'application03_any_source_passive_chat_any';
            }
          } else {
            messageTemplate = whatappUpdateMessageObj?.whatsappMessageType || 'application03_any_source_passive_chat_any';
          }
        } else if (whatappUpdateMessageObj?.messages[0]?.content?.toLowerCase().includes('video interview as part of the') && whatappUpdateMessageObj?.messages[0]?.content?.toLowerCase().includes('questions at the link here')) {
          console.log("USING TEMPLATE FOR startVideoInterviewChat")
          if (chatControl.chatControlType === 'startVideoInterviewChat') {
            messageTemplate = 'share_video_interview_link_without_button';
          } else {
            messageTemplate = whatappUpdateMessageObj?.whatsappMessageType || 'application03';
          }
        } else if (whatappUpdateMessageObj?.messages[0]?.content?.toLowerCase().includes('and wish to move forward and schedule')) {
          console.log("USING TEMPLATE FOR startMeetingSchedulingChat")
          if (chatControl.chatControlType === 'startMeetingSchedulingChat') {
            messageTemplate = 'walkin_meeting_scheduling';
          } else {
            messageTemplate = whatappUpdateMessageObj?.whatsappMessageType || 'application03';
          }
        } else {
          messageTemplate = 'application03';
        }
        const videoInterviewLink = process.env.FRONT_BASE_URL + personNode?.candidates?.edges[0]?.node?.videoInterview?.edges[0]?.node?.interviewLink?.url || '';
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
          candidateSource: "Apna",

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
    } catch (error) {
      console.log('Error in runChatControlMessageSending:', error);
    }
    return response;
  }
}
