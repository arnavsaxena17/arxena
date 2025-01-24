import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import * as allDataObjects from '../data-model-objects';
import { PromptingAgents } from '../llm-agents/prompting-agents';

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

  filterCandidatesAsPerChatControls (peopleCandidateResponseEngagementArr: allDataObjects.PersonNode[], chatControl: allDataObjects.chatControls)  {
    const filterCandidates = (personNode: allDataObjects.PersonNode) => {
      const candidate = personNode?.candidates?.edges[0]?.node;
      if (!candidate) return false;
      if (chatControl.chatControlType === 'startChat') {
      return candidate.startChat && candidate.whatsappMessages?.edges.length === 0 && !candidate.startVideoInterviewChat;
      } else if (chatControl.chatControlType === 'startVideoInterviewChat') {
      return candidate.startChat && candidate.whatsappMessages?.edges.length > 0 && candidate.startVideoInterviewChat && candidate.lastEngagementChatControl !== "startVideoInterviewChat";
      } else if (chatControl.chatControlType === 'startMeetingSchedulingChat') {
      return candidate.startChat && candidate.whatsappMessages?.edges.length > 0 && candidate.startVideoInterviewChat && candidate.startMeetingSchedulingChat && candidate.lastEngagementChatControl !== "startMeetingSchedulingChat";
      } else {
      return candidate.startChat && candidate.whatsappMessages?.edges.length > 0;
      }
    };
    const filteredCandidatesToStartEngagement = peopleCandidateResponseEngagementArr?.filter(filterCandidates);
    return filteredCandidatesToStartEngagement;
  };
}
