import axios from 'axios';
import {
    AttachmentMessageObject,
    CandidateNode,
    ChatControlsObjType,
    ChatHistoryItem,
    ChatRequestBody,
    Project,
    whatappUpdateMessageObjType
} from 'twenty-shared';

import { FilterCandidates } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/filter-candidates';
import { UpdateChat } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/update-chat';
import { RecruiterProfileService } from 'src/engine/core-modules/arx-chat/services/recruiter-profile';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

const baileysBaseUrl = process.env.SERVER_BASE_URL + '/baileys-whatsapp'; // Adjust the base URL as needed

export class BaileysWhatsappAPI {
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
  ) {}

  async sendWhatsappMessageVIABaileysAPI(
    whatappUpdateMessageObj: whatappUpdateMessageObjType,
    candidate: CandidateNode,
    candidateJob: Project,
    mostRecentMessageArr: ChatHistoryItem[],
    chatControl: ChatControlsObjType,
    apiToken: string,
  ): Promise<{ status: 'success' | 'failed'; message?: string }> {
    console.log('Sending message to whatsapp via baileys api');

    const recruiterProfile = await new RecruiterProfileService(this.staticGraphQLService).getRecruiterProfileByJob(
      candidateJob,
      apiToken,
    );
    if (!recruiterProfile) {
      throw new Error('Recruiter profile not found for job');
    }

    console.log(
      'whatappUpdateMessageObj.messageType',
      whatappUpdateMessageObj.messageType,
    );
    if (whatappUpdateMessageObj.messageType === 'botMessage') {
      console.log(
        'This is the standard message to send fromL',
        recruiterProfile.phoneNumber,
        'for name:',
        whatappUpdateMessageObj.candidateProfile.name,
      );
      console.log(
        'This is the standard message to send to phone:',
        whatappUpdateMessageObj.phoneNumberTo,
        'for name :',
        whatappUpdateMessageObj.candidateProfile.name,
      );
      const sendTextMessageObj: ChatRequestBody = {
        phoneNumberFrom: recruiterProfile.phoneNumber,
        phoneNumberTo: whatappUpdateMessageObj.phoneNumberTo,
        messages: whatappUpdateMessageObj.messages[0].content,
      };
      const response = await this.sendWhatsappTextMessageViaBaileys(
        sendTextMessageObj,
        candidate,
        apiToken,
      );

      console.log(response);
      // console.log('99493:: response is here', response);

      if (!candidate) {
        console.log(
          'Candidate node not found, cannot proceed with sending the message',
        );

        return { status: 'failed', message: 'Candidate node not found' };
      }

      // Check if the response indicates failure
      if (response?.status === 'failed') {
        console.log('Message sending failed, not updating database');
        return { status: 'failed', message: 'Failed to send message via Baileys' };
      }

      const whatappUpdateMessageObjAfterWAMidUpdate =
        await new FilterCandidates(
          this.workspaceQueryService,
          this.staticGraphQLService,
        ).updateChatHistoryObjCreateWhatsappMessageObj(
          response?.messageId || 'placeholdermessageid',
          candidate,
          mostRecentMessageArr,
          chatControl,
          apiToken,
        );


      await new UpdateChat(
        this.workspaceQueryService,
        this.staticGraphQLService,
      ).updateCandidateEngagementDataInTable(
        candidate,
        whatappUpdateMessageObjAfterWAMidUpdate,
        apiToken,
        true,
      );
      const updateCandidateStatusObj = await new UpdateChat(
        this.workspaceQueryService,
        this.staticGraphQLService,
        ).updateCandidateEngagementStatus(
        candidate,
        whatappUpdateMessageObj,
        apiToken,
      );
      
      return { status: 'success' };
    } else {
      console.log(
        'This is send whatsapp message via bailsyes api and is a candidate message and probably id dont know',
      );
      return { status: 'success' };
    }
  }

  async sendWhatsappTextMessageViaBaileys(
    sendTextMessageObj: ChatRequestBody,
    candidate: CandidateNode,
    apiToken: string,
  ) {
    console.log('This is the ssendTextMessageObj for baileys to be sent ::', sendTextMessageObj);
    const sendMessageUrl = `${baileysBaseUrl}/send`;
    console.log("sendMessageUrl", sendMessageUrl);
    const data = {
      fileBuffer: '',
      fileName: '',
      mimetype: '',
      filePath: '',
      WANumber: sendTextMessageObj.phoneNumberTo.startsWith('+')
        ? sendTextMessageObj.phoneNumberTo.replace('+', '')
        : sendTextMessageObj.phoneNumberTo,
      message: sendTextMessageObj.messages,
      fileData: '',
      jid:
        (sendTextMessageObj.phoneNumberTo.startsWith('+')
          ? sendTextMessageObj.phoneNumberTo.replace('+', '')
          : sendTextMessageObj.phoneNumberTo) + '@s.whatsapp.net',
      recruiterId: candidate?.projects?.recruiterId,
    };
    console.log("data", data);
    let response;
    try {
      console.log(
        'Sending message via send API as recruiter ID is ::',
        candidate?.projects?.recruiterId,
      );
      console.log(
        'Sending message via send API as personNode is ::',
          candidate,
      );
      console.log(
        'Sending message via send API as personNodeCandidate is ::',
        candidate?.projects?.recruiterId,
      );
      console.log(
        'Sending message via send API as nodeCandidate is ::',
        candidate?.projects?.company?.name,
      );
      console.log("candidate?.projects?.company?.name", candidate?.projects?.company?.name);
      if (
        !candidate?.projects?.company?.name
      ) {
        console.log('THERE IS NO COMPANIES NAME, SO IT WILL SHOW UNDEFINED');
      } else {
        console.log('THERE IS COMPANIES NAME, SO IT WILL SHOW THE NAME');
      }

      if (
        !candidate?.projects?.recruiterId
      ) {
        console.log('THERE IS NO RECRUITER ID, SO IT WILL SHOW UNDEFINED');
      } else {
        console.log('THERE IS RECRUITER ID, SO IT WILL SHOW THE ID');
      }
      console.log('Trying to send message via send baileys API');
      console.log("response", response);
      response = await axios.post(sendMessageUrl, data, {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
      });
      console.log('Send Message Response status:', response.status);
      // console.log('Send Message Response:', response.data);
      // console.log("response.data.status", response);
      if (response.data.status == 'failed') {
        console.log(
          'Retrying to send the message because sending failed and possibly disconnected, so trying to wait for a few mins and retrying',
        );
        await new Promise((resolve) => setTimeout(resolve, 20000));
        const retryResponse = await axios.post(sendMessageUrl, data, {
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
        });

        console.log(
          'The response after the second attempt is :::',
          retryResponse.data,
        );
        
        // If retry also failed, return the failure status
        if (retryResponse.data.status === 'failed') {
          console.log('Second attempt also failed, returning failure status');
          return { status: 'failed', message: 'Failed to send message after retry' };
        }
        
        // Update response to the retry response
        response = retryResponse;
      } else {
        console.log('Response sent successfully');
      }

      // console.log('Send Message Response data:', response.data);
      // if (response.status !== 200 || 201) {
      //   const response = await axios.post(sendMessageUrl, data);
      //   console.log('Trying a second time because not worked the first time', response.status);
      //   if (response.status !== 200 || 201) {
      //     const response = await axios.post(sendMessageUrl, data);
      //     if (response.status !== 200 || 201) {
      //       console.log('Even third time not worked. SO FUCKEDUP. FIND ANOTHER WAY', response.status);
      //     } else {
      //       console.log('WORKED THE THIRD TIME');
      //     }
      //   } else {
      //     console.log('WORKED THE SECOND TIME');
      //   }
      // }
      return response.data;
    } catch (error: any) {
      console.log("error.response?.data", error);
      console.error(
        'Send Message Error in the first time. Will try to send a test message and then send again:',
        error.response?.data || error.message,
      );
      await new Promise((resolve) => setTimeout(resolve, 10000));
      await this.tryAgaintoSendWhatsappMessage(sendTextMessageObj, apiToken);
    }
  }

  async tryAgaintoSendWhatsappMessage(
    sendTextMessageObj: ChatRequestBody,
    apiToken: string,
  ) {
    try {
      const sendMessageUrl = `${baileysBaseUrl}/send`;
      const data = {
        fileBuffer: '',
        fileName: '',
        mimetype: '',
        filePath: '',
        WANumber: sendTextMessageObj.phoneNumberTo.startsWith('+')
          ? sendTextMessageObj.phoneNumberTo.replace('+', '')
          : sendTextMessageObj.phoneNumberTo,
        message: sendTextMessageObj.messages,
        fileData: '',
        jid:
          (sendTextMessageObj.phoneNumberTo.startsWith('+')
            ? sendTextMessageObj.phoneNumberTo.replace('+', '')
            : sendTextMessageObj.phoneNumberTo) + '@s.whatsapp.net',
      };

      console.log('Trying to send again message via send API');
      const response = await axios.post(sendMessageUrl, data, {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('This is response data when trying again::', response.data);
      if (response.data.status == 'failed') {
        console.log(
          'Retrying to send the message because sending failed and possibly disconnected, so trying to wait for a few mins and retrying',
        );
        await new Promise((resolve) => setTimeout(resolve, 20000));
        const response = await axios.post(sendMessageUrl, data, {
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
        });

        console.log(
          'The response after the second attempt is :::',
          response.data,
        );
      } else {
        console.log('Response sent successfully after the second attempt');
      }
      console.log(
        'Send Message Response in Try sendAgain status:',
        response.status,
      );
      console.log('Send Message Response data second time:', response.data);
    } catch (error: any) {
      console.error(
        'SECOND TIME DID NOT WORK> PLEASE CHECK THE SYSTEM:',
        error.response?.data || error.message,
      );
    }
  }

  async sendAttachmentMessageViaBaileys(
    sendTextMessageObj: AttachmentMessageObject,
    candidate: CandidateNode,
    candidateJob: Project,
    apiToken: string,
  ) {
    const jobProfile = candidate?.projects;

      console.log("sendAttachmentMessageViaBaileys", sendTextMessageObj);
    const uploadFileUrl = `${baileysBaseUrl}/send-wa-message-file`;
    const data = {
      WANumber: sendTextMessageObj.phoneNumberTo,
      jid:
        (sendTextMessageObj.phoneNumberTo.startsWith('+')
          ? sendTextMessageObj.phoneNumberTo.replace('+', '')
          : sendTextMessageObj.phoneNumberTo) + '@s.whatsapp.net',
      fileData: sendTextMessageObj.fileData,
      message: [
        jobProfile?.company?.name && jobProfile?.company?.name !== "" && `Hiring for ${jobProfile?.company?.name}`,
        jobProfile?.company?.domainName?.primaryLinkUrl && `Their site is ${jobProfile?.company?.domainName?.primaryLinkUrl?.replace('https://', '').replace('http://', '')}`,
        jobProfile?.jobLocation && jobProfile?.jobLocation !== "" && `The role will be based in ${jobProfile?.jobLocation}`
      ].filter(Boolean).join('. '),
    };
    console.log("data", data);
    const payloadToSendToWhiskeySockets = {
      recruiterId: candidate?.projects?.recruiterId,
      fileToSendData: data,
    };

    try {
      const response = await axios.post(
        uploadFileUrl,
        payloadToSendToWhiskeySockets,
        {
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (response.data.status == 'failed') {
        console.log(
          'Retryngt o send the at/tachment message again because sending failed and possibly disconnected, so trying to wait for a few mins and retrying',
        );
        await new Promise((resolve) => setTimeout(resolve, 20000));
        const response = await axios.post(
          uploadFileUrl,
          payloadToSendToWhiskeySockets,
          {
            headers: {
              Authorization: `Bearer ${apiToken}`,
              'Content-Type': 'application/json',
            },
          },
        );

        console.log(
          'The response after the second attachment attempt is :::',
          response.data,
        );
      } else {
        console.log('Response sent successfully after the second attempt');
      }
      console.log(
        'Send attachment Message Response in Try sendAgain status:',
        response.status,
      );
      console.log(
        'Send attachment Message Response data second time:',
        response.data,
      );
      console.log('Upload File Response:', response.data);
    } catch (error: any) {
      console.error(
        'Upload File Error:',
        error.response?.data || error.message,
      );
    }
  }
}
