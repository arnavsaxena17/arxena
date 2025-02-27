import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { ChatControlsObjType, ChatRequestBody, Jobs, PersonNode, RecruiterProfileType, SendWhatsappUtilityMessageObjectType, whatappUpdateMessageObjType } from 'twenty-shared';
import { ToolCallingAgents } from '../llm-agents/tool-calling-agents';
import { getRecruiterProfileByJob } from '../recruiter-profile';
import { FacebookWhatsappChatApi } from '../whatsapp-api/facebook-whatsapp/facebook-whatsapp-api';

export class ChatControls {
  constructor(private readonly workspaceQueryService: WorkspaceQueryService) {}
  async getTools(candidateJob: Jobs, chatControl: ChatControlsObjType) {
    if (chatControl.chatControlType === 'startChat') {
      return new ToolCallingAgents(this.workspaceQueryService).getStartChatTools(candidateJob);
    } else if (chatControl.chatControlType === 'startVideoInterviewChat') {
      return new ToolCallingAgents(this.workspaceQueryService).getVideoInterviewTools(candidateJob);
    } else if (chatControl.chatControlType === 'startMeetingSchedulingChat') {
      return new ToolCallingAgents(this.workspaceQueryService).getStartMeetingSchedulingTools(candidateJob);
    }
  }
  async runChatControlMessageSending(whatappUpdateMessageObj: whatappUpdateMessageObjType, candidateJob:Jobs, chatControl: ChatControlsObjType, personNode: PersonNode, apiToken: string) {
    let response;
    try {
      const recruiterProfile:RecruiterProfileType = await getRecruiterProfileByJob(candidateJob, apiToken) 
      console.log("This is the recruiterProfile::", recruiterProfile)
      if (whatappUpdateMessageObj?.messages[0]?.content?.toLowerCase().includes('recruitment firm') || whatappUpdateMessageObj?.messages[0]?.content?.toLowerCase().includes('video interview as part of the')) {
        console.log("USING TEMPLATE FOR startChat")
        let messageTemplate: string;
        if (whatappUpdateMessageObj?.messages[0]?.content?.toLowerCase().includes('recruitment firm')) {
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
        const videoInterviewLink = process.env.FRONT_BASE_URL + personNode?.candidates?.edges[0]?.node?.videoInterview?.edges[0]?.node?.interviewLink?.primaryLinkUrl || '';
        console.log('videoInterviewLink::', videoInterviewLink);
        const sendTemplateMessageObj: SendWhatsappUtilityMessageObjectType = {
          recipient: whatappUpdateMessageObj.phoneNumberTo.replace('+', ''),
          template_name: messageTemplate,
          recruiterFirstName: recruiterProfile.name,
          candidateFirstName: whatappUpdateMessageObj.candidateFirstName,
          recruiterName: recruiterProfile.name,
          recruiterJobTitle: recruiterProfile.jobTitle || '',
          recruiterCompanyName: recruiterProfile.companyName,
          recruiterCompanyDescription: recruiterProfile.companyDescription,
          jobPositionName: whatappUpdateMessageObj?.candidateProfile?.jobs?.name,
          companyName: whatappUpdateMessageObj?.candidateProfile?.jobs?.company?.name,
          descriptionOneliner: whatappUpdateMessageObj?.candidateProfile?.jobs?.company?.descriptionOneliner,
          jobCode: whatappUpdateMessageObj?.candidateProfile?.jobs?.jobCode,
          jobLocation: whatappUpdateMessageObj?.candidateProfile?.jobs?.jobLocation,
          videoInterviewLink: videoInterviewLink,
          candidateSource: "Apna Jobs",

        };
        response = await new FacebookWhatsappChatApi(this.workspaceQueryService).sendWhatsappUtilityMessage(sendTemplateMessageObj, apiToken);
      } else {
        console.log('This is the standard message to send from', recruiterProfile.phoneNumber);
        console.log('This is the standard message to send to phone:', whatappUpdateMessageObj.phoneNumberTo);
        const sendTextMessageObj: ChatRequestBody = {
          phoneNumberFrom: recruiterProfile.phoneNumber,
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
