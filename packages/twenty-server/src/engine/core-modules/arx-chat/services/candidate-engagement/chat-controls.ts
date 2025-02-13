import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import * as allDataObjects from '../data-model-objects';
import { FacebookWhatsappChatApi } from '../whatsapp-api/facebook-whatsapp/facebook-whatsapp-api';
import { ToolCallingAgents } from '../llm-agents/tool-calling-agents';

export class ChatControls {
  constructor(private readonly workspaceQueryService: WorkspaceQueryService) {}
  async getTools(candidateJob: allDataObjects.Jobs, chatControl: allDataObjects.chatControls) {
    if (chatControl.chatControlType === 'startChat') {
      return new ToolCallingAgents(this.workspaceQueryService).getStartChatTools(candidateJob);
    } else if (chatControl.chatControlType === 'startVideoInterviewChat') {
      return new ToolCallingAgents(this.workspaceQueryService).getVideoInterviewTools(candidateJob);
    } else if (chatControl.chatControlType === 'startMeetingSchedulingChat') {
      return new ToolCallingAgents(this.workspaceQueryService).getStartMeetingSchedulingTools(candidateJob);
    }
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
          candidateSource: "Apna Jobs",

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
