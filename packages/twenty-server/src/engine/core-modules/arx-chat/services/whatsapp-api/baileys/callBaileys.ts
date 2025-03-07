import axios from 'axios';
import {
  AttachmentMessageObject,
  ChatControlsObjType,
  ChatHistoryItem,
  ChatRequestBody,
  Jobs,
  PersonNode,
  whatappUpdateMessageObjType,
} from 'twenty-shared';

import { FilterCandidates } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/filter-candidates';
import { UpdateChat } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/update-chat';
import { getRecruiterProfileByJob } from 'src/engine/core-modules/arx-chat/services/recruiter-profile';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

const baseUrl = process.env.SERVER_BASE_URL + '/whatsapp'; // Adjust the base URL as needed

export class BaileysWhatsappAPI {
  constructor(private readonly workspaceQueryService: WorkspaceQueryService) {}

  async sendWhatsappMessageVIABaileysAPI(
    whatappUpdateMessageObj: whatappUpdateMessageObjType,
    personNode: PersonNode,
    candidateJob: Jobs,
    mostRecentMessageArr: ChatHistoryItem[],
    chatControl: ChatControlsObjType,
    apiToken: string,
  ) {
    console.log('Sending message to whatsapp via baileys api');

    const recruiterProfile = await getRecruiterProfileByJob(
      candidateJob,
      apiToken,
    );

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
        personNode,
        apiToken,
      );

      console.log(response);
      // console.log('99493:: response is here', response);
      const candidateNode = personNode?.candidates?.edges?.find(
        (edge) => edge.node.jobs.id == candidateJob.id,
      )?.node;

      if (!candidateNode) {
        console.log(
          'Candidate node not found, cannot proceed with sending the message',
        );

        return;
      }

      const whatappUpdateMessageObjAfterWAMidUpdate =
        await new FilterCandidates(
          this.workspaceQueryService,
        ).updateChatHistoryObjCreateWhatsappMessageObj(
          response?.messageId || 'placeholdermessageid',
          personNode,
          candidateNode,
          mostRecentMessageArr,
          chatControl,
          apiToken,
        );
      const candidateProfileObj =
        whatappUpdateMessageObj.messageType !== 'botMessage'
          ? await new FilterCandidates(
              this.workspaceQueryService,
            ).getCandidateInformation(whatappUpdateMessageObj, apiToken)
          : whatappUpdateMessageObj.candidateProfile;

      await new UpdateChat(
        this.workspaceQueryService,
      ).updateCandidateEngagementDataInTable(
        whatappUpdateMessageObjAfterWAMidUpdate,
        apiToken,
        true,
      );
      const updateCandidateStatusObj = await new UpdateChat(
        this.workspaceQueryService,
      ).updateCandidateEngagementStatus(
        candidateProfileObj,
        whatappUpdateMessageObj,
        apiToken,
      );
    } else {
      console.log(
        'This is send whatsapp message via bailsyes api and is a candidate message',
      );
    }
  }

  async sendWhatsappTextMessageViaBaileys(
    sendTextMessageObj: ChatRequestBody,
    personNode: PersonNode,
    apiToken: string,
  ) {
    // console.log('This is the ssendTextMessageObj for baileys to be sent ::', sendTextMessageObj);
    const sendMessageUrl = `${baseUrl}/send`;
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
      recruiterId: personNode?.candidates?.edges[0]?.node?.jobs?.recruiterId,
    };
    let response;

    try {
      console.log(
        'Sending message via send API as recruiter ID is ::',
        personNode?.candidates?.edges[0]?.node?.jobs?.recruiterId,
      );
      console.log(
        'Sending message via send API as personNode is ::',
        personNode,
      );
      console.log(
        'Sending message via send API as personNodeCandidate is ::',
        personNode?.candidates?.edges[0]?.node?.jobs?.recruiterId,
      );
      console.log(
        'Sending message via send API as nodeCandidate is ::',
        personNode?.candidates?.edges[0]?.node?.jobs?.company?.name,
      );
      if (!personNode?.candidates?.edges[0]?.node?.jobs?.company.name) {
        console.log('THERE IS NO COMPANIES NAME, SO IT WILL SHOW UNDEFINED');
      } else {
        console.log('THERE IS COMPANIES NAME, SO IT WILL SHOW THE NAME');
      }
      if (!personNode?.candidates?.edges[0]?.node?.jobs?.recruiterId) {
        console.log('THERE IS NO RECRUITER ID, SO IT WILL SHOW UNDEFINED');
      } else {
        console.log('THERE IS RECRUITER ID, SO IT WILL SHOW THE ID');
      }
      console.log('Trying to send message via send API');
      response = await axios.post(sendMessageUrl, data, {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
      });
      console.log('Send Message Response status:', response.status);
      console.log('Send Message Response:', response.data);
      if (response.data.status == 'failed') {
        console.log(
          'Retryngt o send the message because sending failed and possibly disconnected, so trying to wait for a few mins and retrying',
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
      const sendMessageUrl = `${baseUrl}/send`;
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
    personNode: PersonNode,
    apiToken: string,
  ) {
    const jobProfile = personNode?.candidates?.edges[0]?.node?.jobs;
    const uploadFileUrl = `${baseUrl}/send-wa-message-file`;
    const data = {
      WANumber: sendTextMessageObj.phoneNumberTo,
      jid:
        (sendTextMessageObj.phoneNumberTo.startsWith('+')
          ? sendTextMessageObj.phoneNumberTo.replace('+', '')
          : sendTextMessageObj.phoneNumberTo) + '@s.whatsapp.net',
      fileData: sendTextMessageObj.fileData,
      message: `Hiring for ${jobProfile.company.name}. Their site is ${jobProfile.company.domainName}. The role will be based in ${jobProfile.jobLocation}.`,
    };
    const payloadToSendToWhiskeySockets = {
      recruiterId: personNode?.candidates?.edges[0]?.node?.jobs?.recruiterId,
      fileToSendData: data,
    };

    try {
      const response = await axios.post(
        uploadFileUrl,
        payloadToSendToWhiskeySockets,
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
